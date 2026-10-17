/** Retired compatibility API. Durable execution lives in server/planner/executionSpine.ts. */
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

/** @deprecated Submit through /api/planner/missions with authenticated tenant scope. */
export async function execute(_task:ExecutionTask):Promise<ExecutionResult>{
 throw new Error('LEGACY_EXECUTION_RETIRED_USE_DURABLE_PLANNER');
}

export function getCircuitBreakerStatus() {
  return []; // Durable execution uses persisted attempts and reconciliation, not this legacy RAM breaker.
}
