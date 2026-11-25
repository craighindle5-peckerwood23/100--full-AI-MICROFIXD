/**
 * microfixd/organs/evaluation/metrics.ts
 * Evaluation metrics computation
 */

export interface EvaluationMetricsInput {
  task: string;
  candidate: string;
  expectedContains?: string[];
  mustNotContain?: string[];
  referenceData?: string | Record<string, any>;
  latencyMs?: number;
  tokensUsed?: number;
}

export interface ComputedMetrics {
  characterCount: number;
  wordCount: number;
  lineCount: number;
  hedgesCount: number;
  absolutesCount: number;
  keywordMatches: number;
  keywordTotal: number;
  forbiddenViolations: number;
  tokenEfficiencyRatio: number; // 0 to 1
  linguisticCertainty: number; // 0 to 1
  evidenceAlignment: number; // 0 to 1
}

const HEDGE_PATTERNS = /\b(maybe|might|could|possibly|uncertain|unknown|likely|appears|seems|perhaps|guess)\b/gi;
const ABSOLUTE_PATTERNS = /\b(always|never|guaranteed|certainly|definitely|100%|infallible|perfect)\b/gi;

export function computeEvaluationMetrics(input: EvaluationMetricsInput): ComputedMetrics {
  const text = input.candidate || "";
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const lines = text.split(/\r?\n/);

  const hedges = (text.match(HEDGE_PATTERNS) || []).length;
  const absolutes = (text.match(ABSOLUTE_PATTERNS) || []).length;

  const expected = input.expectedContains || [];
  let keywordMatches = 0;
  for (const term of expected) {
    if (term && text.toLowerCase().includes(term.toLowerCase())) {
      keywordMatches++;
    }
  }

  const forbidden = input.mustNotContain || [];
  let forbiddenViolations = 0;
  for (const term of forbidden) {
    if (term && text.toLowerCase().includes(term.toLowerCase())) {
      forbiddenViolations++;
    }
  }

  // Token efficiency: concise vs verbose ratio for the task
  const taskWords = input.task ? input.task.split(/\s+/).length : 10;
  const lengthRatio = words.length / Math.max(1, taskWords * 4);
  const tokenEfficiencyRatio = Math.max(0.1, Math.min(1.0, 1.0 - (lengthRatio > 3 ? 0.35 : 0)));

  // Linguistic certainty: penalized by hedges and unbounded absolutes
  const linguisticCertainty = Math.max(0.1, Math.min(1.0, 1.0 - (hedges * 0.05 + absolutes * 0.04)));

  // Evidence alignment
  let evidenceAlignment = 1.0;
  if (input.referenceData) {
    const refStr = typeof input.referenceData === "string" ? input.referenceData : JSON.stringify(input.referenceData);
    const refKeywords = refStr.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    if (refKeywords.length > 0) {
      const matched = refKeywords.filter(w => text.toLowerCase().includes(w)).length;
      evidenceAlignment = Math.min(1.0, Math.max(0.2, matched / Math.min(refKeywords.length, 10)));
    }
  }

  return {
    characterCount: text.length,
    wordCount: words.length,
    lineCount: lines.length,
    hedgesCount: hedges,
    absolutesCount: absolutes,
    keywordMatches,
    keywordTotal: expected.length,
    forbiddenViolations,
    tokenEfficiencyRatio,
    linguisticCertainty,
    evidenceAlignment,
  };
}
