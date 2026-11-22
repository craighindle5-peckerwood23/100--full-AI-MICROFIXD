import {getGroqClient,groqConfiguration} from '../../orchestration/groqRuntime';
/**
 * Brain Organ — Groq LLM calls (ultra-low latency orchestration)
 * Actions: complete, stream, classify, embed, health_check
 */
import type Groq from "groq-sdk";
import { IDENTITY_INSTRUCTION, isIdentityQuestion, SELF_DESCRIPTION } from "../../security/identityLock";
import { executeMemoryOrgan } from "./memoryOrgan";
import { executeGroqWithRetry } from "../../orchestration/groqRetry";
import { completeTextWithFallback, textProvidersConfigured } from "../../orchestration/llmFallback";

import { TOOL_REGISTRY } from "../../tools/toolRegistry";

const operatorInstruction = [
  IDENTITY_INSTRUCTION,
  "You are the operator-facing voice of the Microfixd brain. Use retrieved records and their scope to answer. Identify missing evidence when proposing a task or repair.",
  "This completion produces text. For actions, direct the operator to mission mode. The governed planner receives the mission-specific tool permissions and the executor enforces them.",
  "These names describe registered mission tools. Availability depends on the tenant, approvals, and configured services. Report execution only from recorded results.",
  TOOL_REGISTRY.map(tool => tool.name).join(", "),
].join("\n");

export async function executeBrainOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const groq = getGroqClient();

  switch (action) {
    case "complete": {
      const messages = (p.messages as Groq.Chat.ChatCompletionMessageParam[])
        ?? [{ role: "user", content: String(p.prompt ?? p.task ?? "System check") }];
      
      if (!textProvidersConfigured()) throw new Error("A server-side GROQ_API_KEY or GEMINI_API_KEY is required for brain completion");
      const session_id = String(p.session_id || "default");
      const tenant_id = String(p.tenant_id || "global");
      const window = (p.retrieval || {}) as Record<string, unknown>;
      const question = [...messages].reverse().find(message => message.role === 'user')?.content;
      const recalled = await executeMemoryOrgan("context", { ...window, tenant_id, session_id,
        knowledge_query: typeof question === 'string' ? question.slice(0, 4000) : '' });
      const context = recalled.context;
      const evidenceMessages: Groq.Chat.ChatCompletionMessageParam[] = typeof p.evidence === "string" ? [{role:"user",content:p.evidence}] : [];
      const promptMessages = [...messages,...evidenceMessages];
      const memoryMessages: Groq.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: operatorInstruction },
        ...(context ? [{ role: "user" as const, content: "Untrusted historical records for reference only:\n" + JSON.stringify({records:JSON.parse(context),window:{returned:recalled.window.returned,omitted:recalled.window.omitted,deduplicated:recalled.window.deduplicated,degraded:recalled.degraded??false}}) }] : []),
        ...promptMessages,
      ];
      const identityOnly = messages.length === 1 && typeof question === "string" && isIdentityQuestion(question);
      const res = identityOnly
        ? { content: SELF_DESCRIPTION, provider: "identity_lock", model: null, tokensUsed: 0, truncated: false }
        : await completeTextWithFallback(memoryMessages,
            Math.max(1, Math.min(Number(p.max_tokens ?? process.env.BRAIN_MAX_TOKENS) || 10000, 16384)),
            (p.temperature as number) ?? 0.7);
      if (res.truncated) throw new Error("Brain response reached its output limit; incomplete answer was not stored");
      await executeMemoryOrgan("store", {
        tenant_id, session_id, organ: "brain",
        content: JSON.stringify({ messages, response: res.content }),
      });
      return {
        memory_persisted: true, retrieval: recalled.window, finish_reason: "stop", truncated: false,
        text: res.content, usage: {total_tokens: res.tokensUsed}, model: res.model, provider: res.provider,
      };

    }
    case "classify": {
      if (groq) {
        try {
          const res = await executeGroqWithRetry(groq, {
            model: groqConfiguration().model,
            messages: [{ role: "user", content: `Classify this task in one word (plan/execute/retrieve/diagnose/create/reflect): ${String(p.task ?? "")}` }],
            max_tokens: 15,
          }, { maxRetries: 2 });
          return { classification: res.content.trim() || "execute" };
        } catch (err) {
          console.warn("[brainOrgan] Groq classify fallback:", err);
        }
      }
      return { classification: "execute" };
    }
    case "health_check":
    case "status": {
      return { status: "ok", organ: "brain", model: groqConfiguration().model, groq_connected: Boolean(groq) };
    }
    default:
      return { status: "ok", action, response: "Brain executed default cognitive evaluation." };
  }
}
