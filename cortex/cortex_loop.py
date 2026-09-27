"""
cortex/cortex_loop.py
Cortex Loop — the top-level cognitive coordination engine for Microfixd.

This is the "brain stem" that coordinates the full multi-agent society.
It does NOT call agents directly — it routes through the Society orchestrator,
which enforces the wiring graph and constitution rules.

Pipeline per task:
  1. Task interpretation (complexity, intent, required agents)
  2. RAG enrichment (inject relevant memories into context)
  3. Uncertainty check (flag ambiguity before planning)
  4. Doctrine check (block forbidden patterns early)
  5. Planning (planner agent builds structured plan)
  6. Execution (executor agent runs tools/organs per plan)
  7. Evaluation (evaluation agent scores against doctrine)
  8. Critique (critic agent suggests improvements)
  9. Reflection (reflection agent logs patterns + proposes improvements)
  10. Memory log (all steps persisted to memory/cortex_log.jsonl)

All steps respect constitution rules. Errors are emitted as bus events (rule-005).
"""
import json
import sys
import time
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from cortex.task_interpreter    import interpret, InterpretedTask
from agents.society             import Society
from ledger.ledger              import (boot as ledger_boot, load_ledger_slice,
                                        patch_ledger)
from eventbus.bus               import publish
from memory.store               import save_memory, recall_memories

ORGAN_ID    = "brain"
LOG_FILE    = Path(__file__).parent.parent / "memory" / "cortex_log.jsonl"


# ── Memory helpers ────────────────────────────────────────────────────────────

def _log_to_memory(entry: dict):
    """Append full cortex run to cortex_log.jsonl (append-only)."""
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def _load_recent_logs(n: int = 5) -> list:
    if not LOG_FILE.exists():
        return []
    lines = LOG_FILE.read_text().strip().splitlines()
    return [json.loads(l) for l in lines[-n:]]


def _enrich_with_memory(task: str, top_k: int = 3) -> list:
    """Pull top-k relevant memories to inject into agent context."""
    result = recall_memories(task, top_k=top_k, min_score=0.1)
    return [
        {"score": round(sc, 3), "content": m["content"]}
        for sc, m in result.memories
    ]


# ── Doctrine pre-check ────────────────────────────────────────────────────────

def _doctrine_precheck(task: InterpretedTask) -> tuple:
    """
    Fast doctrine check before any agent is invoked.
    Returns (allowed: bool, reasons: list[str])
    """
    reasons = list(task.doctrine_warnings)
    # Hard-block if constitution bypass detected
    for w in reasons:
        if "bypass" in w.lower() or "blocked" in w.lower():
            return False, reasons
    return True, reasons


# ── Result publisher ──────────────────────────────────────────────────────────

def _publish_result(result: dict):
    publish({
        "intent":    "cortex_result",
        "schema_id": "cortex_result_v1",
        "payload":   result,
        "state_delta": {}
    })


# ── Main cortex loop ──────────────────────────────────────────────────────────

def cortex_loop(
    raw_task: str,
    context:  Optional[dict] = None,
    dry_run:  bool = False,
) -> dict:
    """
    Full cortex loop. Entry point for all high-level cognition.

    Parameters
    ----------
    raw_task : str   — Raw task string from user or calling agent
    context  : dict  — Optional pre-existing context (organ state, prior turns)
    dry_run  : bool  — If True, skips execution + memory writes (planning only)

    Returns
    -------
    dict with keys: task, plan, execution, evaluation, critique, reflection,
                    memory_context, uncertainty_flags, doctrine_warnings,
                    elapsed_s, success
    """
    ts_start = time.time()
    ts       = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    print(f"\n[cortex] ── New task ({ts}) ──")
    print(f"[cortex] raw_task: '{raw_task[:80]}'")

    # ── Step 1: Interpret task ────────────────────────────────────────────────
    interpreted = interpret(raw_task, context)
    print(f"[cortex] intent={interpreted.cognitive_intent}  "
          f"complexity={interpreted.complexity}({interpreted.complexity_score})  "
          f"agents={interpreted.required_agents}")

    # Patch ledger with current cortex state
    patch_ledger(f"organs.{ORGAN_ID}.cortex", {
        "status":           "running",
        "current_task":     raw_task[:120],
        "cognitive_intent": interpreted.cognitive_intent,
        "complexity":       interpreted.complexity,
        "started_at":       ts,
    }, organ_id=ORGAN_ID)

    # ── Step 2: RAG enrichment ────────────────────────────────────────────────
    memory_context = _enrich_with_memory(raw_task)
    if memory_context:
        print(f"[cortex] Memory: {len(memory_context)} relevant hit(s) injected")

    # ── Step 3: Uncertainty flags ─────────────────────────────────────────────
    if interpreted.uncertainty_flags:
        print(f"[cortex] Uncertainty: {interpreted.uncertainty_flags}")

    # ── Step 4: Doctrine pre-check ────────────────────────────────────────────
    allowed, doctrine_warnings = _doctrine_precheck(interpreted)
    if not allowed:
        print(f"[cortex] ✗ Doctrine blocked: {doctrine_warnings}")
        result = {
            "task": raw_task, "success": False,
            "blocked_by": "doctrine",
            "doctrine_warnings": doctrine_warnings,
            "plan": None, "execution": None,
            "evaluation": None, "critique": None, "reflection": None,
            "memory_context": memory_context,
            "elapsed_s": round(time.time() - ts_start, 2),
        }
        _publish_result(result)
        return result

    # ── Step 5–9: Society runs the agent pipeline ─────────────────────────────
    enriched_context = {
        **(context or {}),
        **interpreted.enriched_context,
        "memory_context": memory_context,
        "recent_logs":    _load_recent_logs(3),
        "dry_run":        dry_run,
    }

    society  = Society()
    pipeline = society.run_pipeline(
        task=raw_task,
        context=enriched_context,
        agents=interpreted.required_agents,
        dry_run=dry_run,
    )

    # ── Step 10: Memory log ───────────────────────────────────────────────────
    elapsed = round(time.time() - ts_start, 2)
    result  = {
        "task":              raw_task,
        "cognitive_intent":  interpreted.cognitive_intent,
        "complexity":        interpreted.complexity,
        "plan":              pipeline.get("plan"),
        "execution":         pipeline.get("execution"),
        "evaluation":        pipeline.get("evaluation"),
        "critique":          pipeline.get("critique"),
        "reflection":        pipeline.get("reflection"),
        "memory_context":    memory_context,
        "uncertainty_flags": interpreted.uncertainty_flags,
        "doctrine_warnings": doctrine_warnings,
        "elapsed_s":         elapsed,
        "success":           pipeline.get("success", True),
        "ts":                ts,
        "dry_run":           dry_run,
    }

    if not dry_run:
        _log_to_memory(result)
        # Store summary in memory for future recall
        summary = (f"Task: {raw_task[:80]} | "
                   f"Intent: {interpreted.cognitive_intent} | "
                   f"Plan: {str(pipeline.get('plan',''))[:120]}")
        save_memory(summary,
                    tags=["cortex_log", interpreted.cognitive_intent],
                    source="cortex_loop",
                    scope="global")

    patch_ledger(f"organs.{ORGAN_ID}.cortex", {
        "status":     "idle",
        "last_run_ts": ts,
        "last_elapsed_s": elapsed,
        "last_success": result["success"],
    }, organ_id=ORGAN_ID)

    _publish_result(result)
    print(f"[cortex] Done in {elapsed}s — success={result['success']}")
    return result


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Microfixd Cortex Loop")
    parser.add_argument("--task",    type=str, help="Task string")
    parser.add_argument("--context", type=str, default="{}", help="JSON context")
    parser.add_argument("--dry-run", action="store_true", help="Plan only, no execution")
    parser.add_argument("--stdin",   action="store_true",
                        help="Read JSON {task, context} from stdin")
    args = parser.parse_args()

    ledger_boot()

    if args.stdin:
        data   = json.loads(sys.stdin.read())
        task   = data.get("task", "")
        ctx    = data.get("context", {})
    else:
        task   = args.task or input("Task> ").strip()
        ctx    = json.loads(args.context)

    result = cortex_loop(task, ctx, dry_run=args.dry_run)
    print(json.dumps(result, indent=2, default=str))
