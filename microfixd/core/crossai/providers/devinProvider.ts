/**
 * Devin Provider — Cognition AI Devin (Autonomous Software Engineer)
 * Best for: code generation, repo navigation, autonomous engineering tasks.
 *
 * SKELETON — Devin's API is not yet publicly available (as of Sept 2026).
 * This skeleton is ready to activate when Cognition releases their API.
 *
 * SETUP (when available):
 *   DEVIN_API_KEY=your_key
 *   DEVIN_API_ENDPOINT=https://api.cognition.ai (placeholder)
 *
 * NOTE: Devin sessions are async — task submission returns a session ID,
 * results are polled or received via webhook. This skeleton handles both.
 */
import { makeResponse } from "../protocol";
import type { CrossAIRequest, CrossAIResponse, AIProvider } from "../protocol";

const DEVIN_KEY      = process.env.DEVIN_API_KEY ?? "";
const DEVIN_ENDPOINT = process.env.DEVIN_API_ENDPOINT ?? "https://api.cognition.ai/v1";

// ── Devin session tracking ────────────────────────────────────────────────
interface DevinSession {
  session_id:  string;
  request_id:  string;
  status:      "pending" | "running" | "completed" | "failed";
  result?:     string;
  created_at:  number;
}

const sessions = new Map<string, DevinSession>();

async function submitDevinTask(task: string): Promise<string> {
  // SKELETON — replace with actual Cognition API call when available
  const resp = await fetch(`${DEVIN_ENDPOINT}/sessions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEVIN_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ task, snapshot_id: "default" }),
  });
  const data = await resp.json() as { session_id: string };
  return data.session_id;
}

async function pollDevinSession(sessionId: string, timeoutMs = 120_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const resp = await fetch(`${DEVIN_ENDPOINT}/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${DEVIN_KEY}` },
    });
    const data = await resp.json() as { status: string; output?: string };
    if (data.status === "completed") return data.output ?? "";
    if (data.status === "failed")    throw new Error("Devin session failed");
  }
  throw new Error("Devin session timed out");
}

export async function callDevin(req: CrossAIRequest): Promise<CrossAIResponse> {
  const t0 = Date.now();

  if (!DEVIN_KEY) {
    // SKELETON MODE — return structured stub when API not configured
    return makeResponse(
      req.request_id, "devin", req.from,
      `[DEVIN SKELETON] Task received: "${req.messages.at(-1)?.content?.slice(0, 100)}"\n` +
      `Devin API key not configured. Set DEVIN_API_KEY when Cognition releases their API.\n` +
      `This provider is ready — add your key to activate Devin's autonomous engineering.`,
      Date.now() - t0,
      { model: "devin-skeleton", metadata: { skeleton: true } }
    );
  }

  try {
    const task      = req.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    const sessionId = await submitDevinTask(task);
    sessions.set(sessionId, { session_id: sessionId, request_id: req.request_id, status: "running", created_at: Date.now() });

    const result = await pollDevinSession(sessionId, req.timeout_ms ?? 120_000);
    sessions.get(sessionId)!.status = "completed";
    sessions.get(sessionId)!.result = result;

    return makeResponse(req.request_id, "devin", req.from, result, Date.now() - t0, {
      model: "devin-v1", metadata: { session_id: sessionId },
    });
  } catch (err) {
    return {
      request_id: req.request_id, from: "devin", to: req.from,
      content: "", success: false, error: String(err),
      latency_ms: Date.now() - t0, ts: new Date().toISOString(),
    };
  }
}

export function getDevinSessions(): DevinSession[] { return Array.from(sessions.values()); }
export const devinProvider = { id: "devin" as AIProvider, call: callDevin, available: !!DEVIN_KEY, skeleton: !DEVIN_KEY };
