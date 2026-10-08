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
  const maxRetries = options.maxRetries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const fallbackModels = options.fallbackModels ?? VERIFIED_GROQ_MODELS;
  
  let currentModel = requestParams.model || fallbackModels[0];
  let currentMaxTokens = Math.max(1, Math.min(Number(requestParams.max_tokens) || 512, 16384));
  
  const startTime = Date.now();
  let lastError: any = null;
  let attemptsMade=0;
  const attemptedModels=new Set<string>();
  const promptPreview = String(
    requestParams.messages[requestParams.messages.length - 1]?.content || ""
  ).slice(0, 80);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attemptsMade=attempt;attemptedModels.add(currentModel);
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
      const content = msg?.content || "";
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

      if(statusCode===401 || statusCode===403) break; // Credential failures cannot be repaired by retrying.
      // Handle 404 Model Not Found -> Immediately switch to next verified model
      if (statusCode === 404 || /model_not_found|model_decommissioned|does not exist|decommissioned/i.test(errorMsg)) {
        const nextModel = fallbackModels.find(m => !attemptedModels.has(m));
        if(!nextModel)break;
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

      // Input limits cannot be repaired by reducing output tokens. Keep the
      // complete prompt and try a distinct model with its own token budget.
      const inputLimit = /input tokens per minute|ITPM/i.test(errorMsg);
      const outputLimit = /output tokens per minute|OTPM/i.test(errorMsg);
      if ((statusCode === 413 || statusCode === 429) && !outputLimit) {
        const nextModel = fallbackModels.find(m => !attemptedModels.has(m));
        if (nextModel) {
          recordGroqDebugLog({
            id: `groq-limit-${Date.now()}-${attempt}`,
            timestamp: new Date().toISOString(), model: currentModel,
            attempt, maxAttempts: maxRetries, status: "fallback",
            latencyMs: attemptLatency, statusCode,
            errorCode: inputLimit ? "INPUT_TOKEN_LIMIT" : "RATE_LIMIT_EXCEEDED",
            errorMessage: errorMsg, promptPreview, fallbackModel: nextModel,
          });
          currentModel = nextModel;
          continue;
        }
        // An oversized input will never fit this model on a later retry.
        if (statusCode === 413 || /request too large/i.test(errorMsg)) break;
      }

      // Handle 429 Rate Limit / Output Token Exceeded -> Clamp tokens and backoff
      if (statusCode === 429 || errorMsg.includes("Limit") || errorMsg.includes("OTPM")) {
        const reportedLimit = outputLimit
          ? Number(errorMsg.match(/Limit\s+(\d+)/i)?.[1]) : NaN;
        const reportedUsed = outputLimit
          ? Number(errorMsg.match(/Used\s+(\d+)/i)?.[1]) : NaN;
        const available = Number.isFinite(reportedLimit) && Number.isFinite(reportedUsed)
          ? Math.max(0, reportedLimit - reportedUsed) : NaN;
        currentMaxTokens = Math.max(1, Math.min(
          Math.floor(currentMaxTokens * 0.65),
          Number.isFinite(reportedLimit) ? Math.floor(reportedLimit * 0.9) : currentMaxTokens,
          Number.isFinite(available) && available > 0 ? Math.floor(available * 0.9) : currentMaxTokens
        ));
        const waitHint = Number(errorMsg.match(/try again in\s+([\d.]+)s/i)?.[1]);
        const retryAfterSec = Number(err?.headers?.get?.("retry-after") ?? err?.headers?.["retry-after"] ?? (Number.isFinite(waitHint) ? waitHint : 1));
        const waitMs = outputLimit && /request too large/i.test(errorMsg) ? 0 : Math.max((Number.isFinite(retryAfterSec)?retryAfterSec:1) * 1000, baseDelayMs * Math.pow(2, attempt - 1));
        if(waitMs>maxDelayMs) {
          const nextModel = fallbackModels.find(m => !attemptedModels.has(m));
          if (nextModel) { currentModel = nextModel; continue; }
          break; // Surface long provider cooldowns when every model is exhausted.
        }

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
    attempt: attemptsMade,
    maxAttempts: maxRetries,
    status: "failure",
    latencyMs: totalElapsed,
    statusCode: lastError?.status || 500,
    errorCode: lastError?.code || "RETRIES_EXHAUSTED",
    errorMessage: `All ${attemptsMade} Groq attempts failed: ${lastError?.message || lastError}`,
    promptPreview,
  };
  recordGroqDebugLog(failureLog);

  const error = new Error(`[Groq request failed after ${attemptsMade} attempts]: ${String(lastError?.message || lastError).slice(0,500)}`);
  Object.assign(error,{status:lastError?.status || lastError?.statusCode || 500,code:lastError?.code || "GROQ_REQUEST_FAILED"});
  throw error;
}
