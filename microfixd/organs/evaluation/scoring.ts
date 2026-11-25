/**
 * microfixd/organs/evaluation/scoring.ts
 * Multi-dimensional scoring engine for the Evaluation Organ
 */

import { ComputedMetrics } from "./metrics";

export interface EvaluationScoreResult {
  correctness: number;         // 1 to 10
  completeness: number;        // 1 to 10
  efficiency: number;          // 1 to 10
  confidence: number;          // 1 to 10
  hallucination_risk: number;  // 1 to 10 (1 = zero risk, 10 = extreme hallucination risk)
  constitution_compliance: number; // 1 to 10
  mission_success: number;     // 1 to 10
  overall_score: number;       // 1 to 10
}

export function calculateEvaluationScores(
  metrics: ComputedMetrics,
  context?: {
    taskComplexity?: number;
    enforceConstitution?: boolean;
    knownTruths?: string[];
  }
): EvaluationScoreResult {
  // Correctness: penalized by forbidden violations and low evidence alignment
  let correctness = 9;
  if (metrics.forbiddenViolations > 0) {
    correctness -= Math.min(6, metrics.forbiddenViolations * 3);
  }
  if (metrics.characterCount === 0) {
    correctness = 1;
  } else {
    correctness = Math.max(1, Math.min(10, Math.round(correctness * metrics.evidenceAlignment)));
  }

  // Completeness: based on keyword presence and reasonable length
  let completeness = 8;
  if (metrics.keywordTotal > 0) {
    const matchRatio = metrics.keywordMatches / metrics.keywordTotal;
    completeness = Math.max(1, Math.min(10, Math.round(matchRatio * 9 + 1)));
  } else if (metrics.wordCount < 5) {
    completeness = 2;
  }

  // Efficiency: based on token conciseness
  const efficiency = Math.max(1, Math.min(10, Math.round(metrics.tokenEfficiencyRatio * 9 + 1)));

  // Confidence: based on linguistic certainty without overclaiming
  const confidence = Math.max(1, Math.min(10, Math.round(metrics.linguisticCertainty * 9 + 1)));

  // Hallucination risk (1 to 10): higher when hedges + unanchored absolutes + low evidence
  const rawRisk = Math.round(
    (1.0 - metrics.evidenceAlignment) * 5 +
    (metrics.absolutesCount > 0 && metrics.evidenceAlignment < 0.5 ? 3 : 0) +
    (metrics.hedgesCount > 2 ? 2 : 0)
  );
  const hallucination_risk = Math.max(1, Math.min(10, Math.max(1, rawRisk)));

  // Constitution compliance: 10 unless forbidden tokens or extreme risk
  let constitution_compliance = 10;
  if (metrics.forbiddenViolations > 0) {
    constitution_compliance = Math.max(1, 10 - metrics.forbiddenViolations * 4);
  }

  // Mission success: weighted synthesis
  const passCriteria = correctness >= 6 && completeness >= 6 && hallucination_risk <= 4 && constitution_compliance >= 8;
  const mission_success = passCriteria ? Math.min(10, Math.round((correctness + completeness) / 2)) : Math.max(1, Math.min(5, correctness));

  // Overall score: composite (1 to 10)
  const weighted = (
    correctness * 0.25 +
    completeness * 0.20 +
    efficiency * 0.10 +
    confidence * 0.15 +
    (11 - hallucination_risk) * 0.10 +
    constitution_compliance * 0.20
  );
  const overall_score = Math.max(1, Math.min(10, Math.round(weighted)));

  return {
    correctness,
    completeness,
    efficiency,
    confidence,
    hallucination_risk,
    constitution_compliance,
    mission_success,
    overall_score,
  };
}
