export interface ClientGroqDebugLog {
  id: string;
  timestamp: string;
  model: string;
  attempt: number;
  maxAttempts: number;
  status: "success" | "retry" | "failure";
  latencyMs: number;
  statusCode?: number;
  errorMessage?: string;
  promptPreview: string;
}

const clientLogs: ClientGroqDebugLog[] = [];
export const CLIENT_VERIFIED_GROQ_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
];

export function getClientGroqDebugLogs(): ClientGroqDebugLog[] {
  return [...clientLogs];
}

/**
 * Browser-side resilient Groq API fetch with exponential backoff and model failover
 */
export async function fetchGroqWithRetry(
  apiKey: string,
  payload: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  },
  maxRetries = 3
): Promise<string> {
  const baseDelayMs = 400;
  const maxDelayMs = 2500;
  let currentModel = payload.model || CLIENT_VERIFIED_GROQ_MODELS[0];
  let currentMaxTokens = Math.min(payload.max_tokens ?? 500, 750);
  let lastError: any = null;

  const promptPreview = (payload.messages[payload.messages.length - 1]?.content || "").slice(0, 70);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const t0 = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...payload,
          model: currentModel,
          max_tokens: currentMaxTokens,
          temperature: payload.temperature ?? 0.6,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latency = Date.now() - t0;

      if (!res.ok) {
        const errorText = await res.text();
        const errJson = (() => { try { return JSON.parse(errorText); } catch { return {}; } })();
        const errMsg = errJson?.error?.message || errorText.slice(0, 150);

        // 404 Model Not Found -> Fallback
        if (res.status === 404 || errMsg.includes("model_not_found")) {
          const nextModel = CLIENT_VERIFIED_GROQ_MODELS.find(m => m !== currentModel) || CLIENT_VERIFIED_GROQ_MODELS[0];
          clientLogs.unshift({
            id: `client-groq-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            model: currentModel,
            attempt,
            maxAttempts: maxRetries,
            status: "retry",
            latencyMs: latency,
            statusCode: 404,
            errorMessage: `Model '${currentModel}' not found. Failover to '${nextModel}'.`,
            promptPreview,
          });
          currentModel = nextModel;
          continue;
        }

        // 429 Rate Limit -> Clamp max_tokens & backoff
        if (res.status === 429 || errMsg.includes("Limit") || errMsg.includes("OTPM")) {
          currentMaxTokens = Math.max(120, Math.floor(currentMaxTokens * 0.6));
          const waitMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
          clientLogs.unshift({
            id: `client-groq-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            model: currentModel,
            attempt,
            maxAttempts: maxRetries,
            status: "retry",
            latencyMs: latency,
            statusCode: 429,
            errorMessage: `Rate limit 429: reduced max_tokens to ${currentMaxTokens}. Backing off ${waitMs}ms.`,
            promptPreview,
          });
          if (attempt < maxRetries) await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        throw new Error(`Groq HTTP ${res.status}: ${errMsg}`);
      }

      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      const content = msg?.content || msg?.reasoning || "";

      clientLogs.unshift({
        id: `client-groq-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        model: currentModel,
        attempt,
        maxAttempts: maxRetries,
        status: "success",
        latencyMs: latency,
        promptPreview,
      });
      if (clientLogs.length > 50) clientLogs.pop();

      return content || "No response content from Groq.";
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      const latency = Date.now() - t0;

      clientLogs.unshift({
        id: `client-groq-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        model: currentModel,
        attempt,
        maxAttempts: maxRetries,
        status: attempt < maxRetries ? "retry" : "failure",
        latencyMs: latency,
        errorMessage: err?.message || String(err),
        promptPreview,
      });

      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 150);
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + jitter, maxDelayMs);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`[Groq Failed after ${maxRetries} attempts]: ${lastError?.message || lastError}`);
}
