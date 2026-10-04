/** Host execution is disabled until an isolated, approval-gated worker exists.
 * This guard is central: REST, MCP and internal callers cannot bypass it.
 */
import { randomUUID } from "node:crypto";
export interface CodeRunResult {
  success: boolean; stdout: string; stderr: string; exit_code: number;
  elapsed_ms: number; lang: string; session_id: string; exec_id: string;
}
export async function runCode(code: string, lang: string, sessionId: string): Promise<CodeRunResult> {
  return {
    success: false, stdout: "",
    stderr: "SANDBOX_DISABLED: Host code execution is prohibited. An isolated worker with no host secrets, restricted network/filesystem, resource limits and artifact-bound human approval is required.",
    exit_code: 126, elapsed_ms: 0, lang: String(lang), session_id: String(sessionId), exec_id: randomUUID(),
  };
}
