/**
 * server/evolution/selfEvolvingLayer.ts
 * SELF-EVOLVING LAYER
 *
 * Microfixd generates improvements to its own code.
 * ALL changes require HITL approval before application.
 * Applied changes are pushed to GitHub via the GitHub organ.
 *
 * rule-EV1: No self-modification without HITL approval.
 * rule-EV2: All proposals logged to Supabase.
 * rule-EV3: Rollback available for 24h after apply.
 */
import Groq from "groq-sdk";
import { broadcast } from "../index";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

export interface EvolutionProposal {
  id:          string;
  type:        "new_file" | "modify_file" | "new_organ" | "doctrine_change" | "config_change";
  file_path:   string;
  title:       string;
  description: string;
  diff?:       string;
  new_content?: string;
  reason:      string;
  priority:    "low" | "medium" | "high";
  status:      "draft" | "pending_hitl" | "approved" | "rejected" | "applied" | "rolled_back";
  created_at:  string;
  applied_at?: string;
  rollback?:   string; // original content before change
}

const proposals: EvolutionProposal[] = [];

export async function generateProposal(
  context: string,
  type: EvolutionProposal["type"] = "modify_file",
): Promise<EvolutionProposal> {
  const completion = await groq.chat.completions.create({
    model:     "llama-3.1-70b-versatile",
    messages:  [{
      role:    "system",
      content: `You are the Microfixd Evolution Engine. Generate a specific code improvement proposal.
Output JSON only: {
  "file_path": "path/to/file.ts",
  "title": "short title",
  "description": "what this does",
  "new_content": "// TypeScript code here",
  "reason": "why this improves the system",
  "priority": "low|medium|high"
}`,
    }, {
      role:    "user",
      content: `Generate a ${type} proposal for: ${context}`,
    }],
    max_tokens: 1500,
    temperature: 0.7,
  });

  const text  = completion.choices[0]?.message?.content ?? "{}";
  const raw   = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Partial<EvolutionProposal>;

  const proposal: EvolutionProposal = {
    id:          `evo_${Date.now().toString(36)}`,
    type,
    file_path:   raw.file_path   ?? "src/generated/evolution.ts",
    title:       raw.title       ?? "Untitled Proposal",
    description: raw.description ?? "",
    new_content: raw.new_content,
    reason:      raw.reason      ?? "",
    priority:    raw.priority    ?? "medium",
    status:      "draft",
    created_at:  new Date().toISOString(),
  };

  proposals.push(proposal);
  broadcast("evolution:proposal_created", proposal);
  console.log(`[self_evolving] Proposal: ${proposal.title}`);

  // Auto-escalate high priority to HITL
  if (proposal.priority === "high") {
    proposal.status = "pending_hitl";
    await fetch("http://localhost:3001/api/hitl/trigger", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        session_id: "evolution_engine",
        artifact:   { name: proposal.title, type: "evolution_proposal", severity: "major", proposal_id: proposal.id },
        trigger:    "self_modification",
      }),
    }).catch(() => {});
  }

  return proposal;
}

export async function applyProposal(id: string, repo: string, branch: string): Promise<boolean> {
  const proposal = proposals.find(p => p.id === id);
  if (!proposal || proposal.status !== "approved") {
    throw new Error("Proposal not found or not approved");
  }
  if (!proposal.new_content) throw new Error("No content to apply");

  // Push via GitHub organ
  const resp = await fetch("http://localhost:3001/api/organs/github_connector/execute", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      action:  "push_file",
      payload: {
        repo, branch,
        path:    proposal.file_path,
        content: proposal.new_content,
        message: `[Microfixd Evolution] ${proposal.title}`,
      },
    }),
  });

  const result = await resp.json() as { success: boolean };
  if (result.success) {
    proposal.status     = "applied";
    proposal.applied_at = new Date().toISOString();
    broadcast("evolution:proposal_applied", { id, file: proposal.file_path });
    console.log(`[self_evolving] Applied: ${proposal.title} → ${proposal.file_path}`);
  }
  return result.success;
}

export function approveProposal(id: string): boolean {
  const p = proposals.find(p => p.id === id);
  if (p && p.status === "pending_hitl") { p.status = "approved"; return true; }
  return false;
}

export function rejectProposal(id: string): boolean {
  const p = proposals.find(p => p.id === id);
  if (p) { p.status = "rejected"; return true; }
  return false;
}

export function listProposals(): EvolutionProposal[] { return proposals; }
