/**
 * Claude Provider — Anthropic Claude 3.5 Sonnet / Haiku
 * Best for: reasoning, long context, safety-critical tasks
 */
import Anthropic from "@anthropic-ai/sdk";
import { makeResponse } from "../protocol";
import type { CrossAIRequest, CrossAIResponse, AIProvider } from "../protocol";

const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "" });

const MODEL_MAP: Record<string, string> = {
  fastest:   "claude-haiku-20240307",
  smartest:  "claude-3-5-sonnet-20241022",
  cheapest:  "claude-haiku-20240307",
  default:   "claude-3-5-sonnet-20241022",
};

export async function callClaude(req: CrossAIRequest): Promise<CrossAIResponse> {
  const t0    = Date.now();
  const model = MODEL_MAP[req.routing] ?? MODEL_MAP.default;

  try {
    const messages = req.messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const system = req.system ?? req.messages.find(m => m.role === "system")?.content;

    const resp = await client.messages.create({
      model,
      max_tokens:  req.max_tokens ?? 2048,
      system:      system ?? "You are a helpful AI assistant.",
      messages,
    });

    const content = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    return makeResponse(req.request_id, "claude", req.from, content, Date.now() - t0, {
      model: resp.model,
      usage: {
        input_tokens:  resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
        total_tokens:  resp.usage.input_tokens + resp.usage.output_tokens,
      },
    });
  } catch (err) {
    return {
      request_id: req.request_id,
      from: "claude", to: req.from,
      content: "", success: false,
      error: String(err), latency_ms: Date.now() - t0,
      ts: new Date().toISOString(),
    };
  }
}

export const claudeProvider = { id: "claude" as AIProvider, call: callClaude, available: !!process.env.ANTHROPIC_API_KEY };
