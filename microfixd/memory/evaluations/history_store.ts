/**
 * microfixd/memory/evaluations/history_store.ts
 * Evaluation history persistence bridge
 */

import { evaluationMemory, EvaluationRecord } from "../../organs/evaluation/evaluation_memory";

export function getEvaluationHistory(limit = 50, tenant_id?: string): EvaluationRecord[] {
  return evaluationMemory.getRecent(limit, tenant_id);
}

export function getEvaluationStats(tenant_id?: string) {
  return evaluationMemory.getSummary(tenant_id);
}
