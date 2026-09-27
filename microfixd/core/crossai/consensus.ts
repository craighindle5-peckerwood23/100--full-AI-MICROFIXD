/**
 * microfixd/core/crossai/consensus.ts
 * MULTI-AI CONSENSUS ENGINE
 *
 * Collects responses from multiple AIs, computes agreement,
 * synthesizes a final answer, flags dissent.
 *
 * Methods:
 *   majority   — text similarity voting
 *   weighted   — provider-weighted scoring
 *   synthesis  — Groq synthesizes all responses into one
 */
import type { CrossAIResponse, ConsensusResult, AIProvider } from "./protocol";
import { callGroq } from "./providers/groqProvider";
import { makeRequest } from "./protocol";

export async function computeConsensus(
  requestId:  string,
  responses:  CrossAIResponse[],
  method:     "majority" | "weighted" | "synthesis" = "synthesis",
): Promise<ConsensusResult> {
  const successful = responses.filter(r => r.success && r.content.length > 0);
  if (successful.length === 0) {
    return {
      request_id: requestId, responses,
      consensus_text:  "All providers failed to respond.",
      agreement_score: 0, method,
      ts: new Date().toISOString(),
    };
  }

  if (successful.length === 1) {
    return {
      request_id: requestId, responses,
      consensus_text:  successful[0].content,
      agreement_score: 1.0,
      winner:          successful[0].from,
      method, ts: new Date().toISOString(),
    };
  }

  let consensusText  = "";
  let agreementScore = 0;
  let winner: AIProvider | undefined;

  if (method === "synthesis") {
    // Use Groq to synthesize all responses (fastest)
    const summaries = successful.map(r => `[${r.from.toUpperCase()}]: ${r.content.slice(0, 400)}`).join("\n\n");
    const synthReq  = makeRequest("microfixd", "groq", [{
      role:    "user",
      content: `You are synthesizing responses from multiple AI systems.\nSynthesize these into one definitive answer:\n\n${summaries}\n\nOutput only the synthesized answer.`,
    }], { routing: "fastest", max_tokens: 1024 });

    const synthResp  = await callGroq(synthReq);
    consensusText    = synthResp.content;
    agreementScore   = computeTextSimilarity(successful.map(r => r.content));

  } else if (method === "majority") {
    // Find most similar response to others
    let bestScore    = -1;
    for (const resp of successful) {
      const others  = successful.filter(r => r.from !== resp.from);
      const avgSim  = others.reduce((s, o) => s + cosineLike(resp.content, o.content), 0) / others.length;
      if (avgSim > bestScore) {
        bestScore     = avgSim;
        consensusText = resp.content;
        winner        = resp.from;
      }
    }
    agreementScore = bestScore;

  } else {
    // weighted — provider priority: claude > openai > gemini > groq > copilot > devin
    const WEIGHTS: Record<string, number> = { claude: 1.0, openai: 0.95, gemini: 0.9, groq: 0.85, copilot: 0.8, devin: 0.75 };
    const best     = successful.reduce((prev, curr) =>
      (WEIGHTS[curr.from] ?? 0) > (WEIGHTS[prev.from] ?? 0) ? curr : prev, successful[0]);
    consensusText  = best.content;
    winner         = best.from;
    agreementScore = computeTextSimilarity(successful.map(r => r.content));
  }

  // Find dissent
  const avgSim   = computeTextSimilarity(successful.map(r => r.content));
  const dissenter = successful.find(r => cosineLike(r.content, consensusText) < 0.3);

  return {
    request_id:      requestId,
    responses,
    consensus_text:  consensusText,
    agreement_score: Math.round(agreementScore * 1000) / 1000,
    dissenting:      dissenter ? `${dissenter.from}: ${dissenter.content.slice(0, 100)}` : undefined,
    winner, method,
    ts: new Date().toISOString(),
  };
}

function computeTextSimilarity(texts: string[]): number {
  if (texts.length < 2) return 1.0;
  let totalSim = 0;
  let pairs    = 0;
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      totalSim += cosineLike(texts[i], texts[j]);
      pairs++;
    }
  }
  return pairs > 0 ? totalSim / pairs : 1.0;
}

function cosineLike(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).slice(0, 100));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).slice(0, 100));
  let intersect = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersect++; }
  return intersect / Math.sqrt(wordsA.size * wordsB.size || 1);
}
