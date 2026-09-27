/**
 * microfixd/core/crossai/crossAIBridge.ts
 * MAIN CROSS-AI BRIDGE
 * Routes requests to the right provider(s), handles fallback,
 * parallel calls, consensus, and audit logging.
 */
import { callGroq }    from "./providers/groqProvider";
import { callClaude }  from "./providers/claudeProvider";
import { callOpenAI }  from "./providers/openAIProvider";
import { callCopilot } from "./providers/copilotProvider";
import { callDevin }   from "./providers/devinProvider";
import { callGemini }  from "./providers/geminiProvider";
import { computeConsensus } from "./consensus";
import { makeRequest }      from "./protocol";
import type { CrossAIRequest, CrossAIResponse, ConsensusResult, AIProvider, RoutingMode } from "./protocol";

// Provider registry
const PROVIDERS: Record<AIProvider, (req: CrossAIRequest) => Promise<CrossAIResponse>> = {
  groq:      callGroq,
  claude:    callClaude,
  openai:    callOpenAI,
  copilot:   callCopilot,
  devin:     callDevin,
  gemini:    callGemini,
  microfixd: callGroq, // Microfixd's primary model is Groq
};

// Speed ranking for "fastest" routing
const SPEED_ORDER: AIProvider[] = ["groq", "gemini", "openai", "claude", "copilot", "devin"];
export const DEFAULT_FALLBACK_CHAIN: AIProvider[] = ["groq", "gemini", "openai", "claude", "copilot", "devin"];

// Audit log
const auditLog: { request_id: string; from: AIProvider; to: AIProvider | AIProvider[]; latency_ms: number; success: boolean; ts: string }[] = [];

export class CrossAIBridge {
  /** Single provider call */
  async call(req: CrossAIRequest): Promise<CrossAIResponse> {
    const to = Array.isArray(req.to) ? req.to[0] : req.to;
    const provider = PROVIDERS[to];
    if (!provider) throw new Error(`Unknown provider: ${to}`);
    const resp = await provider(req);
    this.log(req, resp);
    return resp;
  }

  /** Parallel call to multiple providers */
  async callParallel(
    from:     AIProvider,
    targets:  AIProvider[],
    messages: CrossAIRequest["messages"],
    opts:     Partial<CrossAIRequest> = {},
  ): Promise<CrossAIResponse[]> {
    const req  = makeRequest(from, targets, messages, { ...opts, routing: "parallel" });
    const results = await Promise.allSettled(
      targets.map(to => PROVIDERS[to]?.({ ...req, to }) ?? Promise.reject(new Error(`Unknown: ${to}`)))
    );
    return results.map(r => r.status === "fulfilled" ? r.value : {
      request_id: req.request_id, from: "microfixd" as AIProvider, to: "microfixd" as AIProvider,
      content: "", success: false, error: String((r as PromiseRejectedResult).reason),
      latency_ms: 0, ts: new Date().toISOString(),
    });
  }

  /** Consensus call — query multiple AIs, synthesize agreement */
  async consensus(
    from:     AIProvider,
    targets:  AIProvider[],
    messages: CrossAIRequest["messages"],
    method:   "majority" | "weighted" | "synthesis" = "synthesis",
    opts:     Partial<CrossAIRequest> = {},
  ): Promise<ConsensusResult> {
    const req       = makeRequest(from, targets, messages, { ...opts, routing: "consensus" });
    const responses = await this.callParallel(from, targets, messages, opts);
    return computeConsensus(req.request_id, responses, method);
  }

  /** Fastest available provider — tries in speed order, returns first success */
  async fastest(
    from:     AIProvider,
    messages: CrossAIRequest["messages"],
    opts:     Partial<CrossAIRequest> = {},
  ): Promise<CrossAIResponse> {
    for (const providerId of SPEED_ORDER) {
      const provider = PROVIDERS[providerId];
      if (!provider) continue;
      const req  = makeRequest(from, providerId, messages, { ...opts, routing: "fastest" });
      const resp = await provider(req);
      if (resp.success) { this.log(req, resp); return resp; }
    }
    throw new Error("All providers failed");
  }

  /** Fallback chain — tries providers in order until one succeeds */
  async withFallback(
    from:     AIProvider,
    chain:    AIProvider[] = DEFAULT_FALLBACK_CHAIN,
    messages: CrossAIRequest["messages"],
    opts:     Partial<CrossAIRequest> = {},
  ): Promise<CrossAIResponse> {
    for (const providerId of chain) {
      const provider = PROVIDERS[providerId];
      if (!provider) continue;
      try {
        const req  = makeRequest(from, providerId, messages, { ...opts, routing: "fallback" });
        const resp = await provider(req);
        if (resp.success) { this.log(req, resp); return resp; }
      } catch {}
    }
    throw new Error(`Fallback chain exhausted: ${chain.join(" → ")}`);
  }

  getAuditLog(limit = 50) { return auditLog.slice(-limit); }

  private log(req: CrossAIRequest, resp: CrossAIResponse): void {
    auditLog.push({
      request_id: req.request_id,
      from:       req.from,
      to:         req.to,
      latency_ms: resp.latency_ms,
      success:    resp.success,
      ts:         new Date().toISOString(),
    });
    if (auditLog.length > 1000) auditLog.shift();
  }
}

export const crossAIBridge = new CrossAIBridge();
