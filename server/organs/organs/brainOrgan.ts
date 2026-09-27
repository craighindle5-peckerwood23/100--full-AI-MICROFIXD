/**
 * Brain Organ — Groq LLM calls (ultra-low latency orchestration)
 * Actions: complete, stream, classify, embed
 */
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
const DEFAULT_MODEL = "llama-3.1-70b-versatile";

export async function executeBrainOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  switch (action) {
    case "complete": {
      const messages = p.messages as Groq.Chat.ChatCompletionMessageParam[]
        ?? [{ role: "user", content: String(p.prompt ?? p.task ?? "") }];
      const completion = await groq.chat.completions.create({
        model:       (p.model as string) ?? DEFAULT_MODEL,
        messages,
        temperature: (p.temperature as number) ?? 0.7,
        max_tokens:  (p.max_tokens as number) ?? 2048,
      });
      return {
        text:    completion.choices[0]?.message?.content ?? "",
        usage:   completion.usage,
        model:   completion.model,
        latency: completion.usage?.total_tokens,
      };
    }
    case "classify": {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant", // Fast model for classification
        messages: [{ role: "user", content: `Classify this task in one word (plan/execute/retrieve/diagnose/create/reflect): ${String(p.task ?? "")}` }],
        max_tokens: 10,
      });
      return { classification: completion.choices[0]?.message?.content?.trim() ?? "query" };
    }
    case "health_check": {
      const completion = await groq.chat.completions.create({
        model:     "llama-3.1-8b-instant",
        messages:  [{ role: "user", content: "Respond with: BRAIN_OK" }],
        max_tokens: 5,
      });
      return { status: "ok", response: completion.choices[0]?.message?.content };
    }
    default:
      throw new Error(`Brain organ: unknown action '${action}'`);
  }
}
