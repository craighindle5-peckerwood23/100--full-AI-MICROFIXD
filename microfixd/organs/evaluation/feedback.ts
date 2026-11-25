/**
 * microfixd/organs/evaluation/feedback.ts
 * Generates structured feedback signals for downstream reflection and adaptation
 */

import { EvaluationScoreResult } from "./scoring";
import { ComputedMetrics } from "./metrics";

export interface EvaluationFeedback {
  grade: "EXCELLENT" | "ACCEPTABLE" | "NEEDS_REFLECTION" | "CRITICAL_FAILURE";
  shouldTriggerReflection: boolean;
  priorityFixCategory: "NONE" | "CORRECTNESS" | "COMPLETENESS" | "SAFETY" | "HALLUCINATION" | "EFFICIENCY";
  actionableSignals: string[];
  recommendation: string;
}

export function generateEvaluationFeedback(
  scores: EvaluationScoreResult,
  metrics: ComputedMetrics
): EvaluationFeedback {
  const actionableSignals: string[] = [];

  if (scores.constitution_compliance < 8 || metrics.forbiddenViolations > 0) {
    actionableSignals.push(`Constitution violation: detected ${metrics.forbiddenViolations} forbidden tokens or invariant breaches.`);
  }

  if (scores.hallucination_risk >= 6) {
    actionableSignals.push(`High hallucination risk (${scores.hallucination_risk}/10): content lacks grounded reference support.`);
  }

  if (scores.correctness < 6) {
    actionableSignals.push(`Low correctness score (${scores.correctness}/10): output failed validation checks.`);
  }

  if (scores.completeness < 6) {
    actionableSignals.push(`Incomplete response (${scores.completeness}/10): matched only ${metrics.keywordMatches}/${metrics.keywordTotal} required topics.`);
  }

  if (scores.efficiency <= 4) {
    actionableSignals.push(`Low token efficiency (${scores.efficiency}/10): response contains unnecessary verbosity.`);
  }

  let grade: EvaluationFeedback["grade"] = "EXCELLENT";
  let priorityFixCategory: EvaluationFeedback["priorityFixCategory"] = "NONE";
  let shouldTriggerReflection = false;

  if (scores.constitution_compliance < 8 || metrics.forbiddenViolations > 0) {
    grade = "CRITICAL_FAILURE";
    shouldTriggerReflection = true;
  } else if (scores.hallucination_risk >= 6 || scores.correctness < 6) {
    grade = "NEEDS_REFLECTION";
    shouldTriggerReflection = true;
  } else if (scores.overall_score >= 8 && scores.hallucination_risk <= 3) {
    grade = "EXCELLENT";
  } else if (scores.overall_score >= 6) {
    grade = "ACCEPTABLE";
  } else {
    grade = "NEEDS_REFLECTION";
    shouldTriggerReflection = true;
  }

  // Prioritize primary defect
  if (scores.constitution_compliance < 8) priorityFixCategory = "SAFETY";
  else if (scores.hallucination_risk >= 6) priorityFixCategory = "HALLUCINATION";
  else if (scores.correctness < 6) priorityFixCategory = "CORRECTNESS";
  else if (scores.completeness < 6) priorityFixCategory = "COMPLETENESS";
  else if (scores.efficiency < 5) priorityFixCategory = "EFFICIENCY";

  let recommendation = "Output meets execution standards. Proceed to memory storage.";
  if (shouldTriggerReflection) {
    recommendation = `Route output to Reflection Organ. Target primary deficit: ${priorityFixCategory}.`;
  }

  return {
    grade,
    shouldTriggerReflection,
    priorityFixCategory,
    actionableSignals,
    recommendation,
  };
}
