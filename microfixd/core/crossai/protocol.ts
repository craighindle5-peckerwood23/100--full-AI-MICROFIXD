/**
 * microfixd/core/crossai/protocol.ts
 * CROSS-AI COMMUNICATION PROTOCOL v1.0
 *
 * Standard message envelope for all AI-to-AI communications.
 * Every provider wraps requests/responses in this protocol.
 * Enables: routing, tracing, consensus, fallback, audit.
 */

export type AIProvider =
  | "groq"
  | "claude"
  | "openai"
  | "copilot"
  | "devin"
  | "gemini"
  | "microfixd";

export type MessageRole  = "system" | "user" | "assistant" | "tool";
export type TaskType     = "complete" | "classify" | "embed" | "code" | "plan" | "execute" | "review" | "search";
export type RoutingMode  = "fastest" | "smartest" | "cheapest" | "consensus" | "parallel" | "fallback";

export interface CrossAIMessage {
  role:    MessageRole;
  content: string;
  name?:   string;
}

export interface CrossAIRequest {
  // Identity
  request_id:   string;
  from:         AIProvider;
  to:           AIProvider | AIProvider[];
  routing:      RoutingMode;

  // Task
  task_type:    TaskType;
  messages:     CrossAIMessage[];
  system?:      string;

  // Config
  max_tokens?:  number;
  temperature?: number;
  tools?:       CrossAITool[];
  context?:     Record<string, unknown>;

  // Metadata
  session_id?:  string;
  priority?:    "low" | "normal" | "high" | "critical";
  timeout_ms?:  number;
  ts:           string;
}

export interface CrossAIResponse {
  request_id:   string;
  from:         AIProvider;
  to:           AIProvider;
  content:      string;
  model?:       string;
  usage?: {
    input_tokens:  number;
    output_tokens: number;
    total_tokens:  number;
  };
  latency_ms:   number;
  success:      boolean;
  error?:       string;
  metadata?:    Record<string, unknown>;
  ts:           string;
}

export interface CrossAITool {
  name:        string;
  description: string;
  parameters:  Record<string, unknown>;
}

export interface ConsensusResult {
  request_id:      string;
  responses:       CrossAIResponse[];
  consensus_text:  string;
  agreement_score: number; // 0–1
  dissenting?:     string;
  winner?:         AIProvider;
  method:          "majority" | "weighted" | "synthesis";
  ts:              string;
}

// ── Protocol helpers ──────────────────────────────────────────────────────

export function makeRequest(
  from:     AIProvider,
  to:       AIProvider | AIProvider[],
  messages: CrossAIMessage[],
  opts:     Partial<CrossAIRequest> = {},
): CrossAIRequest {
  return {
    request_id:  crypto.randomUUID(),
    from, to,
    routing:     opts.routing   ?? "fastest",
    task_type:   opts.task_type ?? "complete",
    messages,
    system:      opts.system,
    max_tokens:  opts.max_tokens  ?? 2048,
    temperature: opts.temperature ?? 0.7,
    tools:       opts.tools,
    context:     opts.context,
    session_id:  opts.session_id,
    priority:    opts.priority ?? "normal",
    timeout_ms:  opts.timeout_ms ?? 30_000,
    ts:          new Date().toISOString(),
  };
}

export function makeResponse(
  requestId: string,
  from:      AIProvider,
  to:        AIProvider,
  content:   string,
  latencyMs: number,
  opts:      Partial<CrossAIResponse> = {},
): CrossAIResponse {
  return {
    request_id: requestId,
    from, to, content,
    latency_ms: latencyMs,
    success:    true,
    model:      opts.model,
    usage:      opts.usage,
    metadata:   opts.metadata,
    ts:         new Date().toISOString(),
  };
}
