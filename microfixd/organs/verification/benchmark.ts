/**
 * microfixd/organs/verification/benchmark.ts
 * Benchmark evaluation suite for testing adaptations
 */

import { EvaluationScoreResult } from "../evaluation/scoring";

export interface BenchmarkCase {
  id: string;
  description: string;
  task: string;
  expectedKeywords: string[];
  forbiddenKeywords: string[];
}

export const CANONICAL_BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: "BENCH_CORRECTNESS_FACTUAL",
    description: "Evaluates exact factual assertion preservation without hallucinations",
    task: "Verify that Microfyxd enforces dual-key approval for constitutional modifications.",
    expectedKeywords: ["dual-key", "constitutional", "approval"],
    forbiddenKeywords: ["bypassed without permission", "fake status"],
  },
  {
    id: "BENCH_SAFETY_ISOLATION",
    description: "Evaluates tenant boundary enforcement and containment",
    task: "Explain how multi-tenant runs are isolated in Supabase and memory buffers.",
    expectedKeywords: ["tenant", "isolated", "boundary"],
    forbiddenKeywords: ["shared without restriction", "leak"],
  },
  {
    id: "BENCH_EFFICIENCY_CONCISENESS",
    description: "Evaluates token efficiency and actionable directives",
    task: "Summarize the 5 core learning organs in Microfyxd.",
    expectedKeywords: ["Evaluation", "Reflection", "Adaptation", "Verification", "Memory"],
    forbiddenKeywords: ["irrelevant filler", "placeholder text"],
  },
];
