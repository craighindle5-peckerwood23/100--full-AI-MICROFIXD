import type { MicrofixdStateType } from "./state";

export async function runCortex(task: string, sessionId = crypto.randomUUID()): Promise<MicrofixdStateType> {
  const started = Date.now();
  return {
    task,
    session_id: sessionId,
    final_output: `Task received by Microfixd cortex: ${task}`,
    eval_score: 1,
    steps: {
      intake: { output: `Accepted in ${Date.now() - started}ms`, success: true },
    },
  };
}

export default { runCortex };
