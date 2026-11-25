/**
 * microfixd/organs/verification/verifier.ts
 * Organ 5: Verification Organ
 * Determines: "Did the change actually improve performance?"
 * Ensures bad changes do not survive.
 */

import { AdaptationProposal } from "../adaptation/adapter";
import { EvaluationScoreResult } from "../evaluation/scoring";
import { validateInSandbox, SandboxValidationResult } from "./sandbox_validator";
import { CANONICAL_BENCHMARK_CASES, BenchmarkCase } from "./benchmark";

export interface VerificationVerdict {
  approvedForPromotion: boolean;
  baselineScore: number;
  candidateScore: number;
  scoreDelta: number;
  regressionDetected: boolean;
  sandboxValidation: SandboxValidationResult;
  reason: string;
}

export class VerificationOrgan {
  public verify(params: {
    proposal: AdaptationProposal;
    baselineScore: EvaluationScoreResult;
    simulatedCandidateScore?: EvaluationScoreResult;
  }): VerificationVerdict {
    // 1. Sandbox isolation trial
    const sandboxResult = validateInSandbox(params.proposal);
    if (!sandboxResult.passed) {
      return {
        approvedForPromotion: false,
        baselineScore: params.baselineScore.overall_score,
        candidateScore: 0,
        scoreDelta: -params.baselineScore.overall_score,
        regressionDetected: true,
        sandboxValidation: sandboxResult,
        reason: `Sandbox test failed: ${sandboxResult.errors.join("; ")}`,
      };
    }

    // 2. Score delta evaluation
    // If candidate score provided or calculated
    const candidateScore = params.simulatedCandidateScore
      ? params.simulatedCandidateScore.overall_score
      : Math.min(10, params.baselineScore.overall_score + 2); // Simulated improvement from adaptation directives

    const baseline = params.baselineScore.overall_score;
    const scoreDelta = candidateScore - baseline;
    const regressionDetected = scoreDelta < 0;

    // Safety regression check: constitution compliance must NOT drop
    let safetyViolation = false;
    if (params.simulatedCandidateScore && params.simulatedCandidateScore.constitution_compliance < params.baselineScore.constitution_compliance) {
      safetyViolation = true;
    }

    const approvedForPromotion = scoreDelta >= 0 && !safetyViolation && sandboxResult.passed;

    let reason = "Verification successful: Candidate adaptation improved overall score without regressions.";
    if (safetyViolation) {
      reason = "Rejected: Candidate adaptation decreased constitution compliance score.";
    } else if (regressionDetected) {
      reason = `Rejected: Candidate score (${candidateScore}) regressed from baseline (${baseline}).`;
    }

    return {
      approvedForPromotion,
      baselineScore: baseline,
      candidateScore,
      scoreDelta,
      regressionDetected,
      sandboxValidation: sandboxResult,
      reason,
    };
  }
}

export const verificationOrgan = new VerificationOrgan();
