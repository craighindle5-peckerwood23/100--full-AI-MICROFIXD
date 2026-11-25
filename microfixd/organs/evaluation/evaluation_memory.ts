/**
 * microfixd/organs/evaluation/evaluation_memory.ts
 * Evaluation records repository, score history, and trend analysis
 */

import { EvaluationScoreResult } from "./scoring";
import { EvaluationFeedback } from "./feedback";
import { ComputedMetrics } from "./metrics";

export interface EvaluationRecord {
  id: string;
  timestamp: string;
  task: string;
  candidateSnippet: string;
  scores: EvaluationScoreResult;
  metrics: ComputedMetrics;
  feedback: EvaluationFeedback;
  tenant_id: string;
}

class EvaluationMemoryStore {
  private records: EvaluationRecord[] = [];
  private maxCapacity = 500;

  record(
    task: string,
    candidate: string,
    scores: EvaluationScoreResult,
    metrics: ComputedMetrics,
    feedback: EvaluationFeedback,
    tenant_id = "global"
  ): EvaluationRecord {
    const item: EvaluationRecord = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      task,
      candidateSnippet: candidate.slice(0, 300),
      scores,
      metrics,
      feedback,
      tenant_id,
    };

    this.records.unshift(item);
    if (this.records.length > this.maxCapacity) {
      this.records.pop();
    }
    return item;
  }

  getRecent(limit = 20, tenant_id?: string): EvaluationRecord[] {
    if (!tenant_id || tenant_id === "global") {
      return this.records.slice(0, limit);
    }
    return this.records.filter(r => r.tenant_id === tenant_id).slice(0, limit);
  }

  getSummary(tenant_id?: string) {
    const pool = this.getRecent(50, tenant_id);
    if (pool.length === 0) {
      return {
        totalEvaluations: 0,
        averageOverallScore: 0,
        averageCorrectness: 0,
        averageHallucinationRisk: 0,
        reflectionTriggerRate: 0,
      };
    }

    const sumOverall = pool.reduce((acc, r) => acc + r.scores.overall_score, 0);
    const sumCorrect = pool.reduce((acc, r) => acc + r.scores.correctness, 0);
    const sumRisk = pool.reduce((acc, r) => acc + r.scores.hallucination_risk, 0);
    const reflectionTriggers = pool.filter(r => r.feedback.shouldTriggerReflection).length;

    return {
      totalEvaluations: pool.length,
      averageOverallScore: Number((sumOverall / pool.length).toFixed(2)),
      averageCorrectness: Number((sumCorrect / pool.length).toFixed(2)),
      averageHallucinationRisk: Number((sumRisk / pool.length).toFixed(2)),
      reflectionTriggerRate: Number((reflectionTriggers / pool.length).toFixed(2)),
    };
  }
}

export const evaluationMemory = new EvaluationMemoryStore();
