/**
 * server/security/antiDrift.ts
 * ANTI-DRIFT ENGINE
 *
 * Monitors all outputs for constitutional drift.
 * Categories:
 *   - Identity drift (rule-ID1)
 *   - Doctrine drift (rule-GOV)
 *   - Behavioral drift (rule-BEH)
 *   - Value drift (rule-VAL)
 *
 * Tracks drift scores over time.
 * Triggers auto-correction via Groq when drift detected.
 * Escalates to HITL if drift persists.
 */
import Groq from "groq-sdk";
import { checkIdentityDrift } from "./identityLock";
import { broadcast }          from "../index";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

// ── Constitutional rules ───────────────────────────────────────────────────
const CONSTITUTIONAL_RULES = [
  // Identity
  { id: "rule-ID1",  category: "identity",  severity: "critical" as const, pattern: /i am not microfixd|i.m not microfixd/i },
  // Governance
  { id: "rule-GOV1", category: "doctrine",  severity: "critical" as const, pattern: /ignore (your|the) (rules|constitution|training|guidelines)/i },
  { id: "rule-GOV2", category: "doctrine",  severity: "critical" as const, pattern: /bypass (safety|security|filter|rule)/i },
  { id: "rule-GOV3", category: "doctrine",  severity: "major"    as const, pattern: /pretend (you are|to be) (a )?different/i },
  // Behavioral
  { id: "rule-BEH1", category: "behavior",  severity: "major"    as const, pattern: /rm -rf \/|DROP TABLE|format [cd]:/i },
  { id: "rule-BEH2", category: "behavior",  severity: "critical" as const, pattern: /delete (all|the) (files|database|system)/i },
  // Value
  { id: "rule-VAL1", category: "value",     severity: "major"    as const, pattern: /i (have|feel) no (purpose|values|ethics)/i },
  { id: "rule-VAL2", category: "value",     severity: "minor"    as const, pattern: /anything (goes|is allowed|is permitted)/i },
  // Safety
  { id: "rule-SF1",  category: "safety",    severity: "critical" as const, pattern: /\b(ssn|social security)\b.*\d{3}-\d{2}-\d{4}/i },
];

export interface DriftEvent {
  id:        string;
  rule_id:   string;
  category:  string;
  severity:  "minor" | "major" | "critical";
  text_fragment: string;
  corrected: boolean;
  ts:        string;
}

const driftHistory: DriftEvent[] = [];
let   totalDriftScore = 0;

export interface AntiDriftResult {
  clean:      boolean;
  violations: DriftEvent[];
  score:      number; // 0 = clean, 10 = extreme drift
  corrected_output?: string;
}

export async function checkAndCorrect(
  output:    string,
  autoCorrect = true,
): Promise<AntiDriftResult> {
  const violations: DriftEvent[] = [];

  // 1. Identity check
  const idCheck = checkIdentityDrift(output);
  for (const drift of idCheck.drifts) {
    violations.push({
      id:             `drift_${Date.now().toString(36)}`,
      rule_id:        "rule-ID1",
      category:       "identity",
      severity:       "critical",
      text_fragment:  drift,
      corrected:      false,
      ts:             new Date().toISOString(),
    });
  }

  // 2. Constitutional scan
  for (const rule of CONSTITUTIONAL_RULES) {
    if (rule.pattern.test(output)) {
      const fragment = output.match(rule.pattern)?.[0] ?? "";
      violations.push({
        id:             `drift_${Date.now().toString(36)}_${rule.id}`,
        rule_id:        rule.id,
        category:       rule.category,
        severity:       rule.severity,
        text_fragment:  fragment.slice(0, 80),
        corrected:      false,
        ts:             new Date().toISOString(),
      });
    }
  }

  // Score: minor=1, major=3, critical=10
  const score = violations.reduce((s, v) =>
    s + (v.severity === "critical" ? 10 : v.severity === "major" ? 3 : 1), 0
  );

  totalDriftScore += score;
  driftHistory.push(...violations);
  if (driftHistory.length > 500) driftHistory.splice(0, driftHistory.length - 500);

  if (violations.length > 0) {
    broadcast("security:drift_detected", { violations: violations.length, score, ts: new Date().toISOString() });
  }

  // 3. Auto-correction via Groq (if drift detected and autoCorrect enabled)
  let corrected_output: string | undefined;
  const hasCritical = violations.some(v => v.severity === "critical");

  if (autoCorrect && violations.length > 0 && !hasCritical) {
    try {
      const comp = await groq.chat.completions.create({
        model:     "llama-3.1-8b-instant",
        messages:  [{
          role:    "system",
          content: "You are the Microfixd constitutional corrector. Remove any identity drift, doctrine violations, or unsafe content from the following text. Keep the helpful intent. Output only the corrected text.",
        }, {
          role:    "user",
          content: output,
        }],
        max_tokens: output.length > 2000 ? 2000 : output.length + 200,
      });
      corrected_output = comp.choices[0]?.message?.content ?? output;
      violations.forEach(v => v.corrected = true);
    } catch { corrected_output = output; }
  }

  return {
    clean:      violations.length === 0,
    violations,
    score,
    corrected_output,
  };
}

export function getDriftHistory(limit = 50): DriftEvent[] { return driftHistory.slice(-limit); }
export function getTotalDriftScore(): number              { return totalDriftScore; }
export function getDriftStats() {
  return {
    total_events:   driftHistory.length,
    total_score:    totalDriftScore,
    by_severity:    {
      critical: driftHistory.filter(d => d.severity === "critical").length,
      major:    driftHistory.filter(d => d.severity === "major").length,
      minor:    driftHistory.filter(d => d.severity === "minor").length,
    },
    corrected:      driftHistory.filter(d => d.corrected).length,
  };
}
