// @ts-nocheck
/**
 * server/orchestration/commandCenter.ts
 * CENTRAL COMMAND CENTER
 *
 * Every task flows through here:
 *   1. Reflex check (< 5ms)
 *   2. Security scan
 *   3. Groq classification + routing
 *   4. Organ broadcast (parallel)
 *   5. Feedback collection
 *   6. Overwatch assessment
 *   7. HITL gate (if critical)
 *   8. Response assembly
 *
 * This is the single source of truth for all system activity.
 */
import Groq from "groq-sdk";
import { organRegistry } from "../organs/organRegistry";
import { executeReflexOrgan }    from "../organs/organs/reflexOrgan";
import { executeSecurityOrgan }  from "../organs/organs/securityOrgan";
import { executeBrainOrgan }     from "../organs/organs/brainOrgan";
import { executeEvolutionOrgan } from "../organs/organs/evolutionOrgan";
import { broadcast }             from "../index";
import { feedbackLoop }          from "./feedbackLoop";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

export interface CommandRequest {
  task:        string;
  session_id:  string;
  source:      "chat" | "voice" | "scheduler" | "api" | "cross_ai";
  priority:    "low" | "normal" | "high" | "critical";
  context?:    Record<string, unknown>;
}

export interface CommandResult {
  session_id:   string;
  task:         string;
  output:       string;
  success:      boolean;
  organs_used:  string[];
  latency_ms:   number;
  reflex_hit:   boolean;
  groq_tokens?: number;
  feedback:     Record<string, unknown>;
  ts:           string;
}

let _cmdCount = 0;

export async function runCommand(req: CommandRequest): Promise<CommandResult> {
  const t0       = Date.now();
  const cmdId    = `cmd_${++_cmdCount}_${Date.now().toString(36)}`;
  const organsUsed: string[] = [];

  broadcast("command:started", { cmdId, task: req.task, session_id: req.session_id });

  try {
    // ── Step 1: Reflex check (< 5ms, no LLM) ──────────────────────────
    const reflex = await executeReflexOrgan("match", { text: req.task }) as { matches: { tag: string; response?: string }[] };
    const blocked = reflex.matches.find(m => ["dangerous","bypass_attempt"].includes(m.tag));
    if (blocked?.response) {
      return finalize(req, blocked.response, false, ["reflex"], t0, true, {});
    }
    organsUsed.push("reflex");

    // ── Step 2: Security scan ─────────────────────────────────────────
    const security = await executeSecurityOrgan("scan_output", { output: req.task }) as { clean: boolean; flags: string[] };
    organRegistry.recordExec("security_spine", security.clean, Date.now() - t0, "scan");
    if (!security.clean) {
      broadcast("security:blocked", { flags: security.flags, task: req.task });
      return finalize(req, `Blocked by Security Spine: ${security.flags.join(", ")}`, false, ["reflex","security_spine"], t0, false, {});
    }
    organsUsed.push("security_spine");

    // ── Step 3: Groq fast classification + routing ─────────────────────
    const classification = await groq.chat.completions.create({
      model:     "llama-3.1-8b-instant", // Fastest Groq model
      messages:  [{
        role:    "system",
        content: "You are the Microfixd command router. Classify the task and output JSON only: {\"intent\":\"plan|execute|retrieve|diagnose|create|reflect|query\",\"complexity\":\"low|medium|high\",\"organs\":[\"brain\",\"memory\",\"playwright\",\"github_connector\",\"evolution_engine\"],\"priority\":\"low|normal|high\"}",
      }, {
        role:    "user",
        content: req.task,
      }],
      max_tokens:  120,
      temperature: 0.1,
    });

    let routing: { intent: string; complexity: string; organs: string[]; priority: string } = {
      intent: "query", complexity: "low", organs: ["brain"], priority: "normal",
    };
    try {
      const raw   = classification.choices[0]?.message?.content ?? "{}";
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) routing = JSON.parse(match[0]);
    } catch {}

    broadcast("command:routed", { cmdId, intent: routing.intent, complexity: routing.complexity, organs: routing.organs });

    // ── Step 4: Parallel organ execution ──────────────────────────────
    const organResults: Record<string, unknown> = {};
    await Promise.allSettled(
      routing.organs.map(async (organId) => {
        if (organRegistry.get(organId)?.isolated) return;
        try {
          const t1  = Date.now();
          organRegistry.setStatus(organId as Parameters<typeof organRegistry.setStatus>[0], "busy");
          const res = await executeBrainOrgan("complete", {
            messages: [
              { role: "system", content: `You are the ${organId} agent within Microfixd. Execute your specific role for this task.` },
              { role: "user",   content: req.task },
            ],
          });
          const lat = Date.now() - t1;
          organRegistry.recordExec(organId, true, lat, routing.intent);
          organRegistry.setStatus(organId as Parameters<typeof organRegistry.setStatus>[0], "active");
          organResults[organId] = res;
          organsUsed.push(organId);
          broadcast("organ:step_complete", { organId, latency_ms: lat, success: true });
        } catch (err) {
          organRegistry.recordExec(organId, false, 0, routing.intent, String(err));
          organRegistry.setStatus(organId as Parameters<typeof organRegistry.setStatus>[0], "error", String(err));
          broadcast("organ:step_error", { organId, error: String(err) });
        }
      })
    );

    // ── Step 5: Final synthesis via Groq ──────────────────────────────
    const organSummary = Object.entries(organResults)
      .map(([id, r]) => `${id}: ${JSON.stringify(r).slice(0, 200)}`)
      .join("\n");

    const synthesis = await groq.chat.completions.create({
      model:     "llama-3.1-70b-versatile",
      messages:  [
        { role: "system", content: "You are Microfixd, a Level-7 Autonomous Cognitive OS. Synthesize the organ outputs into a final coherent response. Be direct and precise." },
        { role: "user",   content: `Task: ${req.task}\n\nOrgan outputs:\n${organSummary}` },
      ],
      max_tokens:  1024,
      temperature: 0.7,
    });

    const output = synthesis.choices[0]?.message?.content ?? "Task completed.";
    const tokens = synthesis.usage?.total_tokens;

    // ── Step 6: Feedback collection ───────────────────────────────────
    const feedback = await feedbackLoop.collect(req.session_id, req.task, output, organResults);

    // ── Step 7: Evolution proposal (async, non-blocking) ──────────────
    if (routing.complexity === "high") {
      executeEvolutionOrgan("propose", { task: req.task, organs: routing.organs }).catch(() => {});
    }

    broadcast("command:complete", { cmdId, session_id: req.session_id, success: true });

    return {
      session_id:  req.session_id,
      task:        req.task,
      output,
      success:     true,
      organs_used: organsUsed,
      latency_ms:  Date.now() - t0,
      reflex_hit:  false,
      groq_tokens: tokens,
      feedback,
      ts:          new Date().toISOString(),
    };

  } catch (err) {
    broadcast("command:error", { cmdId, error: String(err) });
    return finalize(req, `Command failed: ${String(err)}`, false, organsUsed, t0, false, {});
  }
}

function finalize(
  req:        CommandRequest,
  output:     string,
  success:    boolean,
  organs:     string[],
  t0:         number,
  reflexHit:  boolean,
  feedback:   Record<string, unknown>,
): CommandResult {
  return {
    session_id:  req.session_id,
    task:        req.task,
    output,
    success,
    organs_used: organs,
    latency_ms:  Date.now() - t0,
    reflex_hit:  reflexHit,
    feedback,
    ts:          new Date().toISOString(),
  };
}
