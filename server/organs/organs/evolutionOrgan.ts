/**
 * Evolution Organ — generates and tracks evolution proposals
 * Actions: propose, list, apply_proposal, reject_proposal, status
 */
import Groq from "groq-sdk";
import { executeGroqWithRetry } from "../../orchestration/groqRetry";

let _groq: Groq | null = null;
function getGroq(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || "";
  if (!apiKey) return null;
  if (!_groq) _groq = new Groq({ apiKey });
  return _groq;
}

const proposals: { id: string; title: string; change: string; status: string; ts: string }[] = [];

export async function executeEvolutionOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const groq = getGroq();

  switch (action) {
    case "propose": {
      if (groq) {
        try {
          const res = await executeGroqWithRetry(groq, {
            model: "qwen/qwen3.8-27b",
            messages: [{ role: "user", content: `Generate 1 specific improvement proposal for Microfixd based on: ${JSON.stringify(p)}. Output JSON: {"title":"...","change":"...","reason":"...","priority":"high|medium|low"}` }],
            max_tokens: 300,
          });
          const text = res.content;
          const proposal = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Record<string, string>;
          if (res.completion.choices[0]?.finish_reason === "length" || typeof proposal.title !== 'string' || !proposal.title.trim() || typeof proposal.change !== 'string' || !proposal.change.trim() || typeof proposal.reason !== 'string' || !proposal.reason.trim() || !['high','medium','low'].includes(proposal.priority)) throw new Error('INVALID_EVOLUTION_PROPOSAL');
          const entry = { id: `evo_${Date.now().toString(36)}`, ...proposal, status: "pending", ts: new Date().toISOString() };
          proposals.push(entry as typeof proposals[0]);
          return { proposal: entry };
        } catch (err) {
          console.warn("[evolutionOrgan] Groq proposal error:", err);
        }
      }
      throw new Error('EVOLUTION_PROPOSAL_UNAVAILABLE');
    }
    case "list":
      return { proposals: proposals.slice(-20) };
    case "status":
    case "health":
      return { status: "nominal", proposalsCount: proposals.length, architecture: "Proposal generation; deployment requires governed release", auto_apply: false };
    case "apply_proposal": {
      throw new Error('GOVERNED_RELEASE_REQUIRED');
    }
    case "reject_proposal": {
      const prop = proposals.find(p2 => p2.id === String(p.id));
      if (prop) prop.status = "rejected";
      return { rejected: !!prop, id: p.id };
    }
    default:
      return { status: "nominal", action, proposalsCount: proposals.length };
  }
}
