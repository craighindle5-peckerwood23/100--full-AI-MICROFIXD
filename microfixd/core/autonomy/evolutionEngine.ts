// @ts-nocheck
/**
 * microfixd/core/autonomy/evolutionEngine.ts
 * EVOLUTION ENGINE
 * After each episode, proposes improvements to organs, constitution, and tools.
 * All proposals require HITL approval before application (self-modification gate).
 */
import { GoogleGenerativeAI } from "../../lib/googleGenai";
import { storeMemory }         from "../memory/supabaseMemory";
import { monitorSelfModification } from "../metacognition/overwatchEngine";
import type { MicrofixdStateType } from "../../langgraph/state";

const genai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? "");
const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

export interface EvolutionProposal {
  id:          string;
  type:        "organ_upgrade" | "new_tool" | "doctrine_amendment" | "architecture_change";
  organ:       string;
  title:       string;
  change:      string;
  reason:      string;
  priority:    "low" | "medium" | "high";
  status:      "pending" | "approved" | "rejected" | "applied";
  episode_id?: string;
  ts:          string;
}

const proposalHistory: EvolutionProposal[] = [];

export async function generateEvolutionProposals(
  state:     MicrofixdStateType,
  sessionId: string,
): Promise<EvolutionProposal[]> {
  // Only run if episode had issues worth learning from
  if (state.eval_score > 0.9 && state.doctrine_warnings.length === 0) return [];

  const prompt = `You are the Evolution Engine for Microfixd — a synthetic cognitive organism.
After reviewing this episode, propose specific improvements.

Task: ${state.task}
Score: ${state.eval_score} | Success: ${state.success}
Steps: ${Object.keys(state.steps ?? {}).join(" → ")}
Doctrine warnings: ${state.doctrine_warnings.join("; ") || "none"}
Failures: ${Object.values(state.steps ?? {}).filter(s => !s.success).map(s => s.output.slice(0, 100)).join("; ") || "none"}

Generate 1-3 specific proposals in JSON array format:
[{
  "type": "organ_upgrade|new_tool|doctrine_amendment|architecture_change",
  "organ": "organ_name",
  "title": "Short title",
  "change": "Specific change description",
  "reason": "Why this improves the system",
  "priority": "low|medium|high"
}]

Only output the JSON array. No explanation.`;

  try {
    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim();
    const raw    = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]") as Omit<EvolutionProposal, "id" | "status" | "ts">[];

    const proposals: EvolutionProposal[] = raw.map(r => ({
      ...r,
      id:         `evo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      status:     "pending",
      episode_id: state.session_id,
      ts:         new Date().toISOString(),
    }));

    proposalHistory.push(...proposals);

    // Store proposals to memory
    for (const p of proposals) {
      await storeMemory(
        `Evolution proposal: ${p.title} — ${p.change}`,
        ["evolution", p.type, p.organ],
        "evolution_engine",
      );
    }

    // High-priority proposals trigger immediate HITL
    for (const p of proposals.filter(p => p.priority === "high")) {
      await monitorSelfModification({
        type:   p.type,
        organ:  p.organ,
        change: p.change,
        reason: p.reason,
      }, sessionId);
    }

    console.log(`[evolution_engine] Generated ${proposals.length} proposals for episode ${sessionId}`);
    return proposals;
  } catch (err) {
    console.warn("[evolution_engine] Proposal generation failed:", err);
    return [];
  }
}

export function getProposalHistory(): EvolutionProposal[] { return proposalHistory; }
export function getPendingProposals(): EvolutionProposal[] {
  return proposalHistory.filter(p => p.status === "pending");
}
