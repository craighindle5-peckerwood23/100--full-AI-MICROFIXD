/**
 * server/execution/executionTracer.ts
 * Full execution trace recorder.
 * Stores: task → steps → latencies → outcome.
 * Used for: debugging, flame graphs, analytics.
 */

export interface TraceStep {
  name:   string;
  status: "running" | "done" | "error";
  t:      number; // relative ms from trace start
}

export interface TraceRecord {
  id:         string;
  task_id:    string;
  task:       string;
  steps:      TraceStep[];
  started_at: number;
  ended_at?:  number;
  success?:   boolean;
  latency_ms?: number;
}

const traces = new Map<string, TraceRecord>();

class ExecutionTracer {
  startTrace(taskId: string, task: string): string {
    const id = `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    traces.set(id, { id, task_id: taskId, task, steps: [], started_at: Date.now() });
    return id;
  }

  addStep(traceId: string, name: string, status: TraceStep["status"]): void {
    const trace = traces.get(traceId);
    if (!trace) return;
    trace.steps.push({ name, status, t: Date.now() - trace.started_at });
  }

  endTrace(traceId: string, success: boolean): void {
    const trace = traces.get(traceId);
    if (!trace) return;
    trace.ended_at  = Date.now();
    trace.latency_ms = trace.ended_at - trace.started_at;
    trace.success    = success;
  }

  getTrace(id: string): TraceRecord | undefined { return traces.get(id); }
  listTraces(limit = 20): TraceRecord[]          { return Array.from(traces.values()).slice(-limit); }
}

export const executionTracer = new ExecutionTracer();
