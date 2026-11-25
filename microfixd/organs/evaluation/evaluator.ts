/**
 * microfixd/organs/evaluation/evaluator.ts
 * Organ 1: High-Order Output Evaluator
 *
 * Evaluates candidate responses across:
 * - correctness (1-10)
 * - completeness (1-10)
 * - efficiency (1-10)
 * - confidence (1-10)
 * - hallucination_risk (1-10)
 * - constitution_compliance (1-10)
 * - mission_success (1-10)
 * - overall_score (1-10)
 */

import { computeEvaluationMetrics, EvaluationMetricsInput, ComputedMetrics } from "./metrics";
import { calculateEvaluationScores, EvaluationScoreResult } from "./scoring";
import { generateEvaluationFeedback, EvaluationFeedback } from "./feedback";
import { evaluationMemory, EvaluationRecord } from "./evaluation_memory";

export interface EvaluatorParams extends EvaluationMetricsInput {
  tenant_id?: string;
  session_id?: string;
}

export interface EvaluationResult {
  success: boolean;
  scores: EvaluationScoreResult;
  metrics: ComputedMetrics;
  feedback: EvaluationFeedback;
  record: EvaluationRecord;
}

export class EvaluationOrgan {
  public evaluate(params: EvaluatorParams): EvaluationResult {
    const candidate = params.candidate || "";
    const task = params.task || "general_task";

    // 1. Compute empirical metrics
    const metrics = computeEvaluationMetrics(params);

    // 2. Compute multi-dimensional scores
    const scores = calculateEvaluationScores(metrics);

    // 3. Generate structured feedback
    const feedback = generateEvaluationFeedback(scores, metrics);

    // 4. Store in evaluation memory
    const record = evaluationMemory.record(
      task,
      candidate,
      scores,
      metrics,
      feedback,
      params.tenant_id || "global"
    );

    return {
      success: scores.overall_score >= 6 && scores.constitution_compliance >= 8,
      scores,
      metrics,
      feedback,
      record,
    };
  }
}

export const evaluationOrgan = new EvaluationOrgan();
