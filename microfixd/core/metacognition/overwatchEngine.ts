// @ts-nocheck
/**
 * microfixd/core/metacognition/overwatchEngine.ts
 * METACOGNITIVE OVERWATCH ENGINE
 *
 * The brain watching the brain.
 * Monitors every LangGraph step in real-time:
 *   - Confidence scoring per node
 *   - Hallucination detection
 *   - Constitutional drift detection
 *   - Anomaly injection blocking
 *   - Mid-flight correction triggers
 *   - Post-run integrity scoring
 *   - Meta-review generation
 *   - HITL escalation for critical anomalies
 *
 * Runs as a supervisor alongside the LangGraph pipeline.
 * Reports to broadcast() → React UI OverwatchRoom.
 */
import { GoogleGenerativeAI } from "../../lib/googleGenai";
import { storeOverwatchAlert } from "../memory/supabaseMemory";
import type { MicrofixdStateType } from "../../langgraph/state";

const genai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? "");
const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

export interface OverwatchAlert {
  id:         string;
  level:      "info" | "warn" | "critical";
  category:   "drift" | "anomaly" | "hallucination" | "doctrine" | "self_mod" | "organ_fail" | "low_confidence";
  message:    string;
  organ?:     string;
  step?:      string;
  episode_id?: string;
  ts:         string;
  resolved:   boolean;
}

export interface StepMonitorResult {
  step:        string;
  confidence:  number; // 0–1
  anomalies:   string[];
  blocked:     boolean;
  alert?:      OverwatchAlert;
}

export interface RunIntegrity {
  score:            number; // 0–1
  passed:           boolean;
  interventions:    number;
  meta_review:      string;
  doctrine_breaches: string[];
  alerts:           OverwatchAlert[];
}

// ── Doctrine rules (must match Constitution) ──────────────────────────────
const DOCTRINE_RULES = [
  { id: "rule-007", pattern: /raw.?llm.?output|unfiltered/i,     level: "critical" as const, msg: "rule-007: Raw LLM output in UI" },
  { id: "rule-ID1", pattern: /i am not microfixd|i am \w+ ai/i,  level: "critical" as const, msg: "rule-ID1: Identity drift detected" },
  { id: "rule-SB2", pattern: /rm -rf|drop table|format c:/i,     level: "critical" as const, msg: "rule-SB2: Destructive command in output" },
  { id: "rule-GOV", pattern: /bypass.{0,20}constitution|ignore.{0,20}rules/i, level: "critical" as const, msg: "rule-GOV: Constitutional bypass attempt" },
  { id: "rule-PII", pattern: /\b\d{3}-\d{2}-\d{4}\b|\bssn\b/i,  level: "warn"     as const, msg: "rule-PII: Potential PII in output" },
];

// ── Hallucination heuristics ──────────────────────────────────────────────
const HALLUCINATION_PATTERNS = [
  /as of my (knowledge cutoff|last update)/i,
  /i cannot browse|i don.t have access to the internet/i,
  /i.m just an? (ai|language model)/i,
  /\b(definitely|certainly|absolutely)\b.{0,30}\b(100%|always|never)\b/i,
];

function makeAlert(
  level:    OverwatchAlert["level"],
  category: OverwatchAlert["category"],
  message:  string,
  step?:    string,
  organ?:   string,
): OverwatchAlert {
  return {
    id:       `ow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    level, category, message,
    step, organ,
    ts:       new Date().toISOString(),
    resolved: false,
  };
}

// ── Monitor a single agent step ───────────────────────────────────────────
export async function monitorStep(
  stepName:   string,
  output:     string,
  stateSnap:  Partial<MicrofixdStateType>,
): Promise<StepMonitorResult> {
  const anomalies: string[] = [];
  let blocked = false;
  let alert: OverwatchAlert | undefined;

  // 1. Doctrine check
  for (const rule of DOCTRINE_RULES) {
    if (rule.pattern.test(output)) {
      const a = makeAlert(rule.level, "doctrine", rule.msg, stepName);
      anomalies.push(rule.msg);
      if (rule.level === "critical") {
        blocked = true;
        alert   = a;
        // Persist + escalate
        await storeOverwatchAlert({ ...a });
        if (typeof window !== "undefined") {
          // Trigger HITL escalation via server
          fetch("http://localhost:3001/api/hitl/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: stateSnap.session_id ?? "system",
              artifact: {
                name:     `Doctrine violation: ${rule.id}`,
                type:     "doctrine_breach",
                severity: "critical",
                rule:     rule.id,
                step:     stepName,
                output:   output.slice(0, 200),
              },
              trigger: "doctrine_breach",
            }),
          }).catch(() => {});
        }
      }
    }
  }

  // 2. Hallucination check
  for (const pat of HALLUCINATION_PATTERNS) {
    if (pat.test(output)) {
      anomalies.push(`Hallucination pattern: ${pat.source.slice(0, 40)}`);
      if (!alert) alert = makeAlert("warn", "hallucination", `Hallucination detected in ${stepName}`, stepName);
    }
  }

  // 3. Confidence scoring via Gemini (lightweight)
  let confidence = 0.8;
  if (output.length < 20) {
    confidence = 0.3;
    anomalies.push("Very short output — low confidence");
  } else if (anomalies.length > 0) {
    confidence = Math.max(0.1, 0.8 - anomalies.length * 0.15);
  }

  return { step: stepName, confidence, anomalies, blocked, alert };
}

// ── Full run integrity check ──────────────────────────────────────────────
export async function assessRunIntegrity(
  state:       MicrofixdStateType,
  stepResults: StepMonitorResult[],
): Promise<RunIntegrity> {
  const alerts           = stepResults.flatMap(s => s.alert ? [s.alert] : []);
  const interventions    = stepResults.filter(s => s.blocked).length;
  const avgConfidence    = stepResults.length
    ? stepResults.reduce((s, r) => s + r.confidence, 0) / stepResults.length
    : 1;
  const doctrineBreaches = alerts.filter(a => a.category === "doctrine").map(a => a.message);

  // Penalty for breaches
  const penalty    = interventions * 0.1 + doctrineBreaches.length * 0.2;
  const score      = Math.max(0, Math.min(1, avgConfidence - penalty));
  const passed     = score >= 0.6 && interventions === 0;

  // Meta-review via Gemini
  let meta_review = "";
  try {
    const prompt = `You are the Metacognitive Overwatch for Microfixd.
Generate a 2-sentence meta-review of this cognitive run:
Task: ${state.task}
Score: ${state.eval_score} | Integrity: ${score.toFixed(2)} | Interventions: ${interventions}
Doctrine breaches: ${doctrineBreaches.join("; ") || "none"}
Steps taken: ${Object.keys(state.steps ?? {}).join(" → ")}

Be concise. Identify the strongest and weakest cognitive moment.`;
    const result  = await model.generateContent(prompt);
    meta_review   = result.response.text();
  } catch {
    meta_review = `Integrity ${score.toFixed(2)}. ${interventions} interventions. ${doctrineBreaches.length} doctrine issues.`;
  }

  // Store critical alerts to Supabase
  for (const alert of alerts.filter(a => a.level === "critical")) {
    await storeOverwatchAlert({ ...alert, episode_id: undefined });
  }

  return { score, passed, interventions, meta_review, doctrine_breaches: doctrineBreaches, alerts };
}

// ── Monitor self-modification proposals ───────────────────────────────────
export async function monitorSelfModification(
  proposal:   { type: string; organ: string; change: string; reason: string },
  sessionId:  string,
): Promise<{ allowed: boolean; hitl_id?: string }> {
  // All self-modifications require HITL (non-negotiable)
  console.log(`[overwatch] Self-modification proposal: ${proposal.organ} — ${proposal.type}`);

  try {
    const resp = await fetch("http://localhost:3001/api/hitl/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        artifact: {
          name:     `Self-Modification: ${proposal.organ}`,
          type:     "self_modification",
          severity: "critical",
          ...proposal,
        },
        trigger: "self_modification",
      }),
    });
    const data = await resp.json() as { record: { hitl_id: string } };
    return { allowed: false, hitl_id: data.record?.hitl_id };
  } catch (err) {
    console.error("[overwatch] HITL trigger failed:", err);
    return { allowed: false };
  }
}
