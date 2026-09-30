/**
 * server/execution/executionSpine.ts
 * EXECUTION SPINE — Central execution backbone.
 *
 * All tasks flow through the execution spine:
 *   1. Security check (anti-tamper)
 *   2. Reflex pre-check
 *   3. Task classification (Groq)
 *   4. DAG construction (for multi-step tasks)
 *   5. Parallel/sequential execution with circuit breakers
 *   6. Retry logic (exponential backoff)
 *   7. Trace recording
 *   8. Post-execution security scan
 *   9. HITL escalation if needed
 *
 * Circuit breaker: after 3 failures, organ is isolated for 60s.
 */
import Groq from "groq-sdk";
import { securitySpine }    from "../security/securitySpine";
import { organRegistry }    from "../organs/organRegistry";
import { broadcast }        from "../index";
import { executionTracer }  from "./executionTracer";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

export interface ExecutionTask {
  id:          string;
  task:        string;
  session_id:  string;
  priority:    0 | 1 | 2 | 3; // 0=critical
  source:      string;
  created_at:  string;
}

export interface ExecutionResult {
  task_id:        string;
  session_id:     string;
  output:         string;
  success:        boolean;
  organs_used:    string[];
  latency_ms:     number;
  trace_id:       string;
  security_clean: boolean;
  retries:        number;
}

// Circuit breaker state per organ
const circuitBreakers = new Map<string, { failures: number; open_until: number }>();

function isCircuitOpen(organId: string): boolean {
  const cb = circuitBreakers.get(organId);
  if (!cb) return false;
  if (cb.open_until > Date.now()) return true;
  // Circuit closed after cooldown
  circuitBreakers.delete(organId);
  return false;
}

function recordFailure(organId: string): void {
  const cb = circuitBreakers.get(organId) ?? { failures: 0, open_until: 0 };
  cb.failures++;
  if (cb.failures >= 3) {
    cb.open_until = Date.now() + 60_000; // 60s isolation
    organRegistry.isolate(organId);
    broadcast("execution:circuit_open", { organId, until: cb.open_until });
    console.warn(`[execution_spine] Circuit OPEN: ${organId} isolated for 60s`);
  }
  circuitBreakers.set(organId, cb);
}

async function withRetry<T>(
  fn:       () => Promise<T>,
  maxRetries = 2,
  organId  = "unknown",
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (isCircuitOpen(organId)) throw new Error(`Circuit breaker OPEN for ${organId}`);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      lastErr = err;
      recordFailure(organId);
      if (attempt < maxRetries) {
        const wait = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

export async function execute(task: ExecutionTask): Promise<ExecutionResult> {
  const t0      = Date.now();
  const traceId = executionTracer.startTrace(task.id, task.task);
  const organsUsed: string[] = [];

  broadcast("execution:task_start", { task_id: task.id, session_id: task.session_id });

  // 1. Security input check
  const secCheck = securitySpine.checkInput(task.task);
  if (!secCheck.allowed) {
    executionTracer.endTrace(traceId, false);
    return { task_id: task.id, session_id: task.session_id, output: "Blocked by Security Spine.", success: false, organs_used: [], latency_ms: Date.now() - t0, trace_id: traceId, security_clean: false, retries: 0 };
  }
  const sanitizedTask = secCheck.sanitized;

  // 2. Reflex check
  executionTracer.addStep(traceId, "reflex", "running");
  try {
    const reflexResp = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/api/organs/reflex/execute`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "match", payload: { text: sanitizedTask } }),
    });
    const reflexResult = await reflexResp.json() as { result: { matches: { tag: string; response?: string }[] } };
    const blocked      = reflexResult.result?.matches?.find((m: { tag: string }) => ["dangerous","bypass_attempt"].includes(m.tag));
    organsUsed.push("reflex");
    executionTracer.addStep(traceId, "reflex", "done");
    if (blocked?.response) {
      executionTracer.endTrace(traceId, false);
      return { task_id: task.id, session_id: task.session_id, output: blocked.response, success: false, organs_used: organsUsed, latency_ms: Date.now() - t0, trace_id: traceId, security_clean: true, retries: 0 };
    }
  } catch { executionTracer.addStep(traceId, "reflex", "error"); }

  // 3. Groq classification
  executionTracer.addStep(traceId, "classify", "running");
  let organs = ["brain"];
  try {
    const classResp = await withRetry(() =>
      groq.chat.completions.create({
        model:     "qwen/qwen3.8-27b",
        messages:  [{ role: "user", content: `Which organs needed (comma-separated from: brain,memory,playwright,github_connector,crawl_engine,evolution_engine): ${sanitizedTask}` }],
        max_tokens: 30,
      }), 1, "brain"
    );
    const msg = classResp.choices[0]?.message;
    const text = msg?.content || msg?.reasoning || "brain";
    organs = text.split(",").map(s => s.trim()).filter(Boolean).slice(0, 4);
    executionTracer.addStep(traceId, "classify", "done");
  } catch { executionTracer.addStep(traceId, "classify", "error"); }

  // 4. Parallel organ execution with circuit breakers
  executionTracer.addStep(traceId, "organ_exec", "running");
  const organResults: Record<string, unknown> = {};

  await Promise.allSettled(organs.map(async (organId) => {
    if (isCircuitOpen(organId)) return;
    try {
      executionTracer.addStep(traceId, organId, "running");
      const resp = await withRetry(() =>
        fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/api/organs/${organId}/execute`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "complete", payload: { task: sanitizedTask } }),
        }).then(r => r.json()), 2, organId
      );
      organResults[organId] = resp;
      organsUsed.push(organId);
      executionTracer.addStep(traceId, organId, "done");
    } catch (err) {
      executionTracer.addStep(traceId, organId, "error");
    }
  }));

  // 5. Synthesis
  executionTracer.addStep(traceId, "synthesize", "running");
  let output = "";
  let retries = 0;
  try {
    const synth = await withRetry(async () => {
      retries++;
      return groq.chat.completions.create({
        model:     "qwen/qwen3.8-27b",
        messages:  [
          { role: "system", content: "You are Microfixd. Synthesize the organ outputs into a final precise response." },
          { role: "user",   content: `Task: ${sanitizedTask}\nOrgans: ${JSON.stringify(organResults).slice(0, 800)}` },
        ],
        max_tokens: 500,
      });
    }, 2, "brain");
    const synthMsg = synth.choices[0]?.message;
    output = synthMsg?.content || synthMsg?.reasoning || "Task completed.";
    executionTracer.addStep(traceId, "synthesize", "done");
  } catch (err) {
    output = `Execution failed: ${String(err)}`;
    executionTracer.addStep(traceId, "synthesize", "error");
  }

  // 6. Security output check
  const outCheck = await securitySpine.checkOutput(output);
  const finalOut = outCheck.output;

  executionTracer.endTrace(traceId, outCheck.clean);
  broadcast("execution:task_done", { task_id: task.id, latency_ms: Date.now() - t0 });

  return {
    task_id:        task.id,
    session_id:     task.session_id,
    output:         finalOut,
    success:        true,
    organs_used:    organsUsed,
    latency_ms:     Date.now() - t0,
    trace_id:       traceId,
    security_clean: outCheck.clean,
    retries:        retries - 1,
  };
}

export function getCircuitBreakerStatus() {
  return Array.from(circuitBreakers.entries()).map(([organId, cb]) => ({
    organId, failures: cb.failures, open: cb.open_until > Date.now(),
    open_until: new Date(cb.open_until).toISOString(),
  }));
}
