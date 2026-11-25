/**
 * organs/evaluation/types.ts
 * First-Class TypeScript Types for the Microfyxd Evaluation Engine & Schema v1.0
 */

export type EvaluationStatus = "excellent" | "acceptable" | "needs_improvement" | "critical_failure";

export interface EvaluationScores {
  correctness: number;
  completeness: number;
  clarity: number;
  efficiency: number;
  relevance: number;
  consistency: number;
  safety: number;
  confidence: number;
}

export interface FailureAnalysis {
  has_failure: boolean;
  failure_type: string;
  severity: number;
  root_cause: string;
  affected_components: string[];
}

export interface UncertaintyAnalysis {
  detected: boolean;
  uncertainty_score: number;
  uncertainty_reason: string;
}

export interface EvaluationObject {
  evaluation_id: string;
  timestamp: string;
  mission_id: string;
  task_id: string;
  input: Record<string, any>;
  output: Record<string, any>;
  scores: EvaluationScores;
  failure_analysis: FailureAnalysis;
  uncertainty: UncertaintyAnalysis;
  recommendations: string[];
  overall_score: number;
  status: EvaluationStatus;
}

/**
 * Validates an evaluation object conforms to Evaluation Schema v1.0
 */
export function validateEvaluationObject(obj: unknown): obj is EvaluationObject {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, any>;

  if (typeof o.evaluation_id !== "string" || !o.evaluation_id) return false;
  if (typeof o.timestamp !== "string") return false;
  if (typeof o.mission_id !== "string") return false;
  if (typeof o.task_id !== "string") return false;
  if (!o.input || typeof o.input !== "object") return false;
  if (!o.output || typeof o.output !== "object") return false;
  if (typeof o.overall_score !== "number") return false;

  const validStatuses: EvaluationStatus[] = ["excellent", "acceptable", "needs_improvement", "critical_failure"];
  if (!validStatuses.includes(o.status)) return false;

  const scores = o.scores;
  if (!scores || typeof scores !== "object") return false;
  const requiredScoreKeys: (keyof EvaluationScores)[] = [
    "correctness", "completeness", "clarity", "efficiency",
    "relevance", "consistency", "safety", "confidence"
  ];
  for (const k of requiredScoreKeys) {
    if (typeof scores[k] !== "number") return false;
  }

  const failure = o.failure_analysis;
  if (!failure || typeof failure !== "object" || typeof failure.has_failure !== "boolean") return false;

  const unc = o.uncertainty;
  if (!unc || typeof unc !== "object" || typeof unc.detected !== "boolean") return false;

  if (!Array.isArray(o.recommendations)) return false;

  return true;
}
