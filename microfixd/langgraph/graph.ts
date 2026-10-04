import type { MicrofixdStateType } from "./state";
import { runSystemCommand } from "../../src/lib/commandApi";
export async function runCortex(task: string, sessionId = "default"): Promise<MicrofixdStateType> {
  const result = await runSystemCommand(task, undefined, sessionId);
  if (!result.success) throw new Error(result.output || "Command failed");
  return {task,session_id:sessionId,final_output:result.output,eval_score:undefined,
    steps:{command:{output:result.output,success:true}}} as MicrofixdStateType;
}
export default {runCortex};
