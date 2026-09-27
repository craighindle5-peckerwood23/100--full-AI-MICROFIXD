export interface MicrofixdStateType {
  task?: string;
  session_id?: string;
  messages?: Array<{ role: string; content: string }>;
  steps?: Record<string, { output: string; success: boolean }>;
  final_output?: string;
  eval_score?: number;
  [key: string]: unknown;
}
