import { runCode } from "../sandbox/codeRunner";
/**
 * server/tools/toolOrchestrator.ts
 * TOOL ORCHESTRATOR
 * Routes Groq tool calls to real organ implementations.
 * Works with Groq's function-calling API.
 *
 * Flow:
 *   1. User message → Groq with tools list
 *   2. Groq decides which tool(s) to call
 *   3. Orchestrator executes them against real organs
 *   4. Results returned to Groq for final synthesis
 *   5. Final answer returned to user
 */
import Groq from "groq-sdk";
import { TOOL_REGISTRY, getToolsForGroq, getTool } from "./toolRegistry";
import { organRegistry } from "../organs/organRegistry";
import { executePlaywrightOrgan } from "../organs/organs/playwrightOrgan";
import { executeMemoryOrgan }     from "../organs/organs/memoryOrgan";
import { executeGithubOrgan }     from "../organs/organs/githubOrgan";
import { executeSecurityOrgan }   from "../organs/organs/securityOrgan";
import { executeEvolutionOrgan }  from "../organs/organs/evolutionOrgan";
import { executeCrawlOrgan }      from "../organs/organs/crawlOrgan";
import { executeReflexOrgan }     from "../organs/organs/reflexOrgan";
import { executeWorldModelOrgan } from "../organs/organs/worldModelOrgan";
import { broadcast }              from "../index";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

const ORGAN_EXECUTORS: Record<string, (action: string, payload: unknown) => Promise<unknown>> = {
  playwright:             executePlaywrightOrgan,
  memory:                 executeMemoryOrgan,
  github_connector:       executeGithubOrgan,
  security_spine:         executeSecurityOrgan,
  evolution_engine:       executeEvolutionOrgan,
  crawl_engine:           executeCrawlOrgan,
  reflex:                 executeReflexOrgan,
  world_thinking_engine:  executeWorldModelOrgan,
  orchestration_oversight: executeWorldModelOrgan,
  sandbox: async (action, payload) => {
    const p = payload as Record<string, unknown>;
    return runCode(String(p.code ?? ""), String(p.lang ?? "typescript"), "tool_orchestrator", p.approval_id as string | undefined);
  },
};

export interface OrchestrationResult {
  final_answer:  string;
  tools_called:  { name: string; result: unknown; latency_ms: number }[];
  total_latency: number;
  model:         string;
}

export async function orchestrateWithTools(
  userMessage: string,
  systemPrompt?: string,
  maxIterations = 5,
): Promise<OrchestrationResult> {
  const t0       = Date.now();
  const toolsCalled: OrchestrationResult["tools_called"] = [];
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [];

  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userMessage });

  let finalAnswer = "";
  let model       = "";

  for (let iter = 0; iter < maxIterations; iter++) {
    const completion = await groq.chat.completions.create({
      model:       "qwen/qwen3.8-27b",
      messages,
      tools:       getToolsForGroq() as Groq.Chat.ChatCompletionTool[],
      tool_choice: "auto",
      max_tokens:  500,
    });

    model = completion.model;
    const choice  = completion.choices[0];
    const message = choice.message;

    messages.push(message as Groq.Chat.ChatCompletionMessageParam);

    // No tool calls — we have a final answer
    if (!message.tool_calls?.length) {
      finalAnswer = message.content ?? "";
      break;
    }

    // Execute all tool calls in parallel
    const toolResults = await Promise.allSettled(
      message.tool_calls.map(async (tc) => {
        const t1     = Date.now();
        const tool   = getTool(tc.function.name);
        if (!tool) return { tool_call_id: tc.id, content: `Unknown tool: ${tc.function.name}` };

        const args   = JSON.parse(tc.function.arguments);
        const executor = ORGAN_EXECUTORS[tool.organ];
        let result: unknown;

        if (executor) {
          organRegistry.setStatus(tool.organ as Parameters<typeof organRegistry.setStatus>[0], "busy");
          result = await executor(tool.action, args);
          organRegistry.recordExec(tool.organ, true, Date.now() - t1, tool.action);
          organRegistry.setStatus(tool.organ as Parameters<typeof organRegistry.setStatus>[0], "active");
        } else {
          result = { error: `No executor for organ: ${tool.organ}` };
        }

        const latency = Date.now() - t1;
        toolsCalled.push({ name: tc.function.name, result, latency_ms: latency });
        broadcast("tool:called", { name: tc.function.name, organ: tool.organ, latency_ms: latency });

        return { tool_call_id: tc.id, content: JSON.stringify(result) };
      })
    );

    // Add tool results to messages
    for (const r of toolResults) {
      if (r.status === "fulfilled") {
        messages.push({ role: "tool", tool_call_id: r.value.tool_call_id, content: r.value.content } as Groq.Chat.ChatCompletionMessageParam);
      }
    }
  }

  return {
    final_answer:  finalAnswer || "Task completed.",
    tools_called:  toolsCalled,
    total_latency: Date.now() - t0,
    model,
  };
}
