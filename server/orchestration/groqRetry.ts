import Groq from "groq-sdk";
import { broadcast } from "../events";

export interface GroqDebugLog {
  id: string;
  timestamp: string;
  model: string;
  attempt: number;
  maxAttempts: number;
  status: "success" | "retry" | "failure" | "fallback";
  latencyMs: number;
  tokensUsed?: number;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
  promptPreview: string;
  responsePreview?: string;
  fallbackModel?: string;
}

const MAX_DEBUG_LOGS = 100;
const debugLogs: GroqDebugLog[] = [];

// Verified models ordered by speed and availability
export const VERIFIED_GROQ_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

export function getGroqDebugLogs(limit = 50): GroqDebugLog[] {
  return debugLogs.slice(-limit);
}

export function recordGroqDebugLog(log: GroqDebugLog): void {
  debugLogs.push(log);
  if (debugLogs.length > MAX_DEBUG_LOGS) {
    debugLogs.shift();
  }
  broadcast("groq:debug_event", log);
}

export interface GroqRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fallbackModels?: string[];
  initialMaxTokens?: number;
}

/**
 * Robust Groq API Execution Wrapper with Exponential Backoff, Jitter,
 * Model Failover, Token Dynamic Clamping, and Detailed Diagnostic Logging.
 */
export async function executeGroqWithRetry(
  groq: Groq,
  requestParams: {
    model?: string;
    messages: Groq.Chat.ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    tools?: Groq.Chat.ChatCompletionTool[];
    tool_choice?: Groq.Chat.ChatCompletionToolChoiceOption;
    response_format?: { type: "json_object" | "text" };
  },
  options: GroqRetryOptions = {}
): Promise<{
  completion: Groq.Chat.ChatCompletion;
  content: string;
  modelUsed: string;
  totalLatencyMs: number;
  attempts: number;
}> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const fallbackModels = options.fallbackModels ?? VERIFIED_GROQ_MODELS;
  
  let currentModel = requestParams.model || fallbackModels[0];
  let currentMaxTokens = Math.max(1, Math.min(Number(requestParams.max_tokens) || 2048, 8192));
  
  const startTime = Date.now();
  let lastError: any = null;
  const promptPreview = String(
    requestParams.messages[requestParams.messages.length - 1]?.content || ""
  ).slice(0, 80);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStart = Date.now();
    try {
      const completion = await groq.chat.completions.create({
        ...requestParams,
        model: currentModel,
        max_tokens: currentMaxTokens,
      });

      const attemptLatency = Date.now() - attemptStart;
      const totalLatency = Date.now() - startTime;
      const msg = completion.choices[0]?.message;
      const content = msg?.content || msg?.reasoning || "";
      const tokensUsed = completion.usage?.total_tokens;

      recordGroqDebugLog({
        id: `groq-${Date.now()}-${attempt}`,
        timestamp: new Date().toISOString(),
        model: currentModel,
        attempt,
        maxAttempts: maxRetries,
        status: "success",
        latencyMs: attemptLatency,
        tokensUsed,
        promptPreview,
        responsePreview: content.slice(0, 100),
      });

      return {
        completion,
        content,
        modelUsed: currentModel,
        totalLatencyMs: totalLatency,
        attempts: attempt,
      };
    } catch (err: any) {
      lastError = err;
      const attemptLatency = Date.now() - attemptStart;
      const statusCode = err?.status || err?.statusCode || 500;
      const errorMsg = err?.message || String(err);
      const errorCode = err?.code || err?.type || "UNKNOWN_ERROR";

      console.warn(
        `[GroqRetry] Attempt ${attempt}/${maxRetries} failed for model '${currentModel}' (Status ${statusCode}): ${errorMsg}`
      );

      // Handle 404 Model Not Found -> Immediately switch to next verified model
      if (statusCode === 404 || errorMsg.includes("model_not_found") || errorMsg.includes("does not exist")) {
        const nextModel = fallbackModels.find(m => m !== currentModel) || fallbackModels[0];
        recordGroqDebugLog({
          id: `groq-fail-${Date.now()}-${attempt}`,
          timestamp: new Date().toISOString(),
          model: currentModel,
          attempt,
          maxAttempts: maxRetries,
          status: "retry",
          latencyMs: attemptLatency,
          statusCode,
          errorCode: "MODEL_NOT_FOUND",
          errorMessage: `Model ${currentModel} not found. Switching to ${nextModel}.`,
          promptPreview,
          fallbackModel: nextModel,
        });
        currentModel = nextModel;
        continue;
      }

      // Handle 429 Rate Limit / Output Token Exceeded -> Clamp tokens and backoff
      if (statusCode === 429 || errorMsg.includes("Limit") || errorMsg.includes("OTPM")) {
        currentMaxTokens = Math.max(150, Math.floor(currentMaxTokens * 0.65));
        const retryAfterSec = Number(err?.headers?.["retry-after"] || 1);
        const waitMs = Math.max(retryAfterSec * 1000, baseDelayMs * Math.pow(2, attempt - 1));

        recordGroqDebugLog({
          id: `groq-ratelimit-${Date.now()}-${attempt}`,
          timestamp: new Date().toISOString(),
          model: currentModel,
          attempt,
          maxAttempts: maxRetries,
          status: "retry",
          latencyMs: attemptLatency,
          statusCode: 429,
          errorCode: "RATE_LIMIT_EXCEEDED",
          errorMessage: `Rate limit hit. Reducing max_tokens to ${currentMaxTokens} and waiting ${waitMs}ms.`,
          promptPreview,
        });

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, waitMs));
        }
        continue;
      }

      // Record generic retry
      recordGroqDebugLog({
        id: `groq-err-${Date.now()}-${attempt}`,
        timestamp: new Date().toISOString(),
        model: currentModel,
        attempt,
        maxAttempts: maxRetries,
        status: attempt < maxRetries ? "retry" : "failure",
        latencyMs: attemptLatency,
        statusCode,
        errorCode,
        errorMessage: errorMsg,
        promptPreview,
      });

      // Exponential backoff with jitter for transient errors (500, 502, 503, ECONNRESET, timeout)
      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 200);
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + jitter, maxDelayMs);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // All retries exhausted -> Throw structured error
  const totalElapsed = Date.now() - startTime;
  const failureLog: GroqDebugLog = {
    id: `groq-fatal-${Date.now()}`,
    timestamp: new Date().toISOString(),
    model: currentModel,
    attempt: maxRetries,
    maxAttempts: maxRetries,
    status: "failure",
    latencyMs: totalElapsed,
    statusCode: lastError?.status || 500,
    errorCode: lastError?.code || "RETRIES_EXHAUSTED",
    errorMessage: `All ${maxRetries} Groq retries failed: ${lastError?.message || lastError}`,
    promptPreview,
  };
  recordGroqDebugLog(failureLog);

  throw new Error(`[Groq Execution Failed after ${maxRetries} attempts in ${totalElapsed}ms]: ${lastError?.message || lastError}`);
}
