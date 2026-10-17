/** Retired local tool loop. Submit tools through /api/tools/execute or /api/planner/missions. */
export interface OrchestrationResult {
  tokens_used: number;
  provider: 'groq' | 'openrouter';
  final_answer:  string;
  tools_called:  { name: string; result: unknown; latency_ms: number }[];
  total_latency: number;
  model:         string;
}

export async function orchestrateWithTools(_message:string,_systemPrompt?:string,_iterations=5,_sessionId='default'):Promise<OrchestrationResult>{
 throw new Error('LOCAL_TOOL_LOOP_RETIRED_USE_DURABLE_PLANNER');
}
