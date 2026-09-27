/**
 * Gemini Provider — Google Gemini 2.0 Flash / Pro
 * Primary provider for Microfixd (already configured).
 * Best for: multimodal, long context, fast inference.
 */
import { GoogleGenerativeAI } from "../../../lib/googleGenai";
import { makeResponse } from "../protocol";
import type { CrossAIRequest, CrossAIResponse, AIProvider } from "../protocol";

const genai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? "");

const MODEL_MAP: Record<string, string> = {
  fastest:  "gemini-2.0-flash-exp",
  smartest: "gemini-2.0-pro-exp",
  cheapest: "gemini-2.0-flash-exp",
  default:  "gemini-2.0-flash-exp",
};

export async function callGemini(req: CrossAIRequest): Promise<CrossAIResponse> {
  const t0    = Date.now();
  const model = genai.getGenerativeModel({ model: MODEL_MAP[req.routing] ?? MODEL_MAP.default });

  try {
    const prompt = [
      req.system ? `System: ${req.system}` : "",
      req.messages.map(m => `${m.role}: ${m.content}`).join("\n"),
    ].filter(Boolean).join("\n\n");

    const result  = await model.generateContent(prompt);
    const content = result.response.text();

    return makeResponse(req.request_id, "gemini", req.from, content, Date.now() - t0, {
      model: MODEL_MAP[req.routing] ?? MODEL_MAP.default,
    });
  } catch (err) {
    return {
      request_id: req.request_id, from: "gemini", to: req.from,
      content: "", success: false, error: String(err),
      latency_ms: Date.now() - t0, ts: new Date().toISOString(),
    };
  }
}

export const geminiProvider = { id: "gemini" as AIProvider, call: callGemini, available: true };
