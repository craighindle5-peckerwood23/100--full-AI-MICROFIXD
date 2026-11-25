/**
 * microfixd/learning/reinforcement.ts
 * Reinforcement signal computation from evaluation and verification
 */

import { EvaluationScoreResult } from "../organs/evaluation/scoring";

export interface ReinforcementReward {
  scalarReward: number; // -1.0 to +1.0
  policyWeightDelta: number;
  promotedToPermanentPolicy: boolean;
  notes: string;
}

export function computeReinforcementReward(
  scores: EvaluationScoreResult,
  verifiedImprovement: boolean
): ReinforcementReward {
  // Normalize overall score (1 to 10) to (-1 to +1)
  const normalized = (scores.overall_score - 5.5) / 4.5;
  const bonus = verifiedImprovement ? 0.25 : -0.2;
  const scalarReward = Math.max(-1.0, Math.min(1.0, normalized + bonus));

  const policyWeightDelta = Number((scalarReward * 0.1).toFixed(4));
  const promotedToPermanentPolicy = scalarReward > 0.4 && scores.constitution_compliance >= 9;

  return {
    scalarReward: Number(scalarReward.toFixed(3)),
    policyWeightDelta,
    promotedToPermanentPolicy,
    notes: promotedToPermanentPolicy
      ? "Reward above promotion threshold: adaptation anchored into permanent weights."
      : "Reward logged; no permanent weight mutation.",
  };
}
