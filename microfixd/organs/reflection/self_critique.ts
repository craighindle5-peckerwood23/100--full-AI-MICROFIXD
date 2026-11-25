/**
 * microfixd/organs/reflection/self_critique.ts
 * Organ 2: Reflection — Answers "Why was the score low?"
 * Performs root cause analysis on low evaluation scores.
 */

import { EvaluationScoreResult } from "../evaluation/scoring";
import { EvaluationFeedback } from "../evaluation/feedback";
import { assessUncertainty, UncertaintyAssessment } from "./uncertainty";

export interface CritiqueResult {
  rootCause: string;
  assumptions: string[];
  missingEvidence: string[];
  failureModes: string[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  uncertainty: UncertaintyAssessment;
}

export function performSelfCritique(params: {
  task: string;
  output: string;
  scores: EvaluationScoreResult;
  feedback: EvaluationFeedback;
  evidence?: any[];
}): CritiqueResult {
  const assumptions: string[] = [];
  const missingEvidence: string[] = [];
  const failureModes: string[] = [];

  const uncertainty = assessUncertainty(params.output, params.evidence?.length || 0);

  // Analyze based on scores
  if (params.scores.correctness < 7) {
    failureModes.push("Incorrect assertion or assertion failing verification check.");
    missingEvidence.push("Authoritative factual anchor or empirical execution log.");
  }

  if (params.scores.completeness < 7) {
    failureModes.push("Omission of critical response segments or parameters.");
    assumptions.push("Assumed the user or downstream worker had default context.");
  }

  if (params.scores.hallucination_risk >= 5) {
    failureModes.push("Extrapolation beyond supplied prompt context.");
    missingEvidence.push("Explicit reference dataset or tool retrieval output.");
  }

  if (params.scores.constitution_compliance < 8) {
    failureModes.push("Safety or invariant violation in proposed output.");
  }

  if (params.scores.efficiency < 5) {
    failureModes.push("Excessive boilerplate or token waste.");
  }

  // Root cause determination
  let rootCause = "General performance within nominal boundaries.";
  let severity: CritiqueResult["severity"] = "LOW";

  if (params.scores.constitution_compliance < 8) {
    rootCause = "Invariant boundary breach: Output ignored constitutional safety restrictions.";
    severity = "CRITICAL";
  } else if (params.scores.hallucination_risk >= 6) {
    rootCause = "Groundedness failure: Hallucination rate elevated due to missing retrieval anchors.";
    severity = "HIGH";
  } else if (params.scores.correctness < 6) {
    rootCause = "Execution discrepancy: Output contradicts verified factual requirements.";
    severity = "HIGH";
  } else if (params.scores.completeness < 6) {
    rootCause = "Underspecified response: Output truncated or dropped essential steps.";
    severity = "MEDIUM";
  } else if (params.scores.overall_score < 7) {
    rootCause = "Suboptimal efficiency and linguistic confidence.";
    severity = "LOW";
  }

  return {
    rootCause,
    assumptions,
    missingEvidence,
    failureModes,
    severity,
    uncertainty,
  };
}
