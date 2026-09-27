/**
 * Groq Provider — ultra-low latency inference
 * Models: llama-3.1-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
 */
import Groq from "groq-sdk";
import { makeResponse } from "../protocol";
import type { CrossAIRequest, CrossAIResponse, AIProvider } from "../protocol";

const client = new Groq({ apiKey: import.meta.env.VITE_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? "" });

const MODEL_MAP: Record<string, string> = {
  fastest:   "llama-3.1-8b-instant",
  smartest:  "llama-3.1-70b-versatile",
  cheapest:  "llama-3.1-8b-instant",
  default:   "llama-3.1-70b-versatile",
};

export async function callGroq(req: CrossAIRequest): Promise<CrossAIResponse> {
  const t0    = Date.now();
  const model = MODEL_MAP[req.routing] ?? MODEL_MAP.default;

  try {
    const messages = req.messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));
    if (req.system) messages.unshift({ role: "system", content: req.system });

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens:  req.max_tokens ?? 2048,
      temperature: req.temperature ?? 0.7,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    return makeResponse(req.request_id, "groq", req.from, content, Date.now() - t0, {
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
      from: "groq", to: req.from,
      content: "", success: false,
      error: String(err), latency_ms: Date.now() - t0,
      ts: new Date().toISOString(),
    };
  }
}

export const groqProvider = { id: "groq" as AIProvider, call: callGroq, available: !!process.env.GROQ_API_KEY };
