/**
 * microfixd/organs/reflection/uncertainty.ts
 * Epistemic uncertainty detection and confidence estimation
 */

export interface UncertaintyAssessment {
  uncertaintyScore: number; // 0 to 1
  confidenceScore: number;  // 0 to 1
  hedges: string[];
  absolutes: string[];
  epistemicGaps: string[];
  reliability: "HIGH" | "MEDIUM" | "LOW" | "UNRELIABLE";
}

export function assessUncertainty(text: string, evidenceCount = 0): UncertaintyAssessment {
  const hedges: string[] = [];
  const absolutes: string[] = [];
  const epistemicGaps: string[] = [];

  const hedgeMatches = text.match(/\b(maybe|might|could|possibly|uncertain|unknown|likely|appears|seems)\b/gi) || [];
  hedges.push(...new Set(hedgeMatches.map(m => m.toLowerCase())));

  const absoluteMatches = text.match(/\b(always|never|guaranteed|certainly|definitely|100%)\b/gi) || [];
  absolutes.push(...new Set(absoluteMatches.map(m => m.toLowerCase())));

  if (evidenceCount === 0) {
    epistemicGaps.push("No grounding evidence provided for assertions.");
  }
  if (hedges.length > 2) {
    epistemicGaps.push("Frequent hedge qualifiers indicate unverified reasoning.");
  }
  if (absolutes.length > 0 && evidenceCount < 2) {
    epistemicGaps.push("Unsubstantiated absolute certainty detected.");
  }

  const evidencePenalty = evidenceCount === 0 ? 0.35 : Math.max(0, 0.2 - Math.min(0.2, evidenceCount * 0.04));
  const linguisticPenalty = Math.min(0.4, hedges.length * 0.05 + absolutes.length * 0.06);
  const uncertaintyScore = Math.max(0, Math.min(1.0, evidencePenalty + linguisticPenalty));
  const confidenceScore = Math.max(0, Math.min(1.0, 1.0 - uncertaintyScore));

  let reliability: UncertaintyAssessment["reliability"] = "HIGH";
  if (uncertaintyScore > 0.6) reliability = "UNRELIABLE";
  else if (uncertaintyScore > 0.4) reliability = "LOW";
  else if (uncertaintyScore > 0.2) reliability = "MEDIUM";

  return {
    uncertaintyScore: Number(uncertaintyScore.toFixed(3)),
    confidenceScore: Number(confidenceScore.toFixed(3)),
    hedges,
    absolutes,
    epistemicGaps,
    reliability,
  };
}
