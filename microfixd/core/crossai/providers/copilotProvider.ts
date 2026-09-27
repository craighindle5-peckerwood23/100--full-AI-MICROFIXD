/**
 * Microsoft Copilot / Azure OpenAI Provider
 * Uses Azure OpenAI endpoint for enterprise Copilot integration.
 * Best for: Microsoft ecosystem, enterprise compliance, Teams integration.
 *
 * SETUP:
 *   AZURE_OPENAI_API_KEY=your_key
 *   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
 *   AZURE_OPENAI_DEPLOYMENT=gpt-4o (your deployment name)
 */
import OpenAI from "openai";
import { makeResponse } from "../protocol";
import type { CrossAIRequest, CrossAIResponse, AIProvider } from "../protocol";

const AZURE_KEY        = process.env.AZURE_OPENAI_API_KEY ?? "";
const AZURE_ENDPOINT   = process.env.AZURE_OPENAI_ENDPOINT ?? "";
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
const AZURE_API_VER    = "2024-02-01";

const client = AZURE_KEY ? new OpenAI({
  apiKey:   AZURE_KEY,
  baseURL:  `${AZURE_ENDPOINT}openai/deployments/${AZURE_DEPLOYMENT}`,
  defaultHeaders: { "api-key": AZURE_KEY },
  defaultQuery:   { "api-version": AZURE_API_VER },
}) : null;

export async function callCopilot(req: CrossAIRequest): Promise<CrossAIResponse> {
  const t0 = Date.now();

  if (!client) {
    return {
      request_id: req.request_id, from: "copilot", to: req.from,
      content: "", success: false,
      error: "Azure OpenAI not configured. Set AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT.",
      latency_ms: Date.now() - t0, ts: new Date().toISOString(),
    };
  }

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = req.messages.map(m => ({
      role: m.role as "system" | "user" | "assistant", content: m.content,
    }));
    if (req.system) messages.unshift({ role: "system", content: req.system });

    const completion = await client.chat.completions.create({
      model:       AZURE_DEPLOYMENT,
      messages,
      max_tokens:  req.max_tokens ?? 2048,
      temperature: req.temperature ?? 0.7,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    return makeResponse(req.request_id, "copilot", req.from, content, Date.now() - t0, {
      model: `azure/${AZURE_DEPLOYMENT}`,
      usage: {
        input_tokens:  completion.usage?.prompt_tokens ?? 0,
        output_tokens: completion.usage?.completion_tokens ?? 0,
        total_tokens:  completion.usage?.total_tokens ?? 0,
      },
    });
  } catch (err) {
    return {
      request_id: req.request_id, from: "copilot", to: req.from,
      content: "", success: false, error: String(err),
      latency_ms: Date.now() - t0, ts: new Date().toISOString(),
    };
  }
}

export const copilotProvider = { id: "copilot" as AIProvider, call: callCopilot, available: !!AZURE_KEY };
