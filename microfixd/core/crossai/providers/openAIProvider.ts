/**
 * OpenAI Provider — GPT-4o, GPT-4o-mini, o1
 * Best for: tool use, structured output, code generation
 */
import OpenAI from "openai";
import { makeResponse } from "../protocol";
import type { CrossAIRequest, CrossAIResponse, AIProvider } from "../protocol";

const client = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "" });

const MODEL_MAP: Record<string, string> = {
  fastest:   "gpt-4o-mini",
  smartest:  "gpt-4o",
  cheapest:  "gpt-4o-mini",
  default:   "gpt-4o",
};

export async function callOpenAI(req: CrossAIRequest): Promise<CrossAIResponse> {
  const t0    = Date.now();
  const model = MODEL_MAP[req.routing] ?? MODEL_MAP.default;

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = req.messages.map(m => ({
      role:    m.role as "system" | "user" | "assistant",
      content: m.content,
    }));
    if (req.system) messages.unshift({ role: "system", content: req.system });

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens:  req.max_tokens ?? 2048,
      temperature: req.temperature ?? 0.7,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    return makeResponse(req.request_id, "openai", req.from, content, Date.now() - t0, {
      model: completion.model,
      usage: {
        input_tokens:  completion.usage?.prompt_tokens ?? 0,
        output_tokens: completion.usage?.completion_tokens ?? 0,
        total_tokens:  completion.usage?.total_tokens ?? 0,
      },
    });
  } catch (err) {
    return {
      request_id: req.request_id,
      from: "openai", to: req.from,
      content: "", success: false,
      error: String(err), latency_ms: Date.now() - t0,
      ts: new Date().toISOString(),
    };
  }
}

export const openAIProvider = { id: "openai" as AIProvider, call: callOpenAI, available: !!process.env.OPENAI_API_KEY };
