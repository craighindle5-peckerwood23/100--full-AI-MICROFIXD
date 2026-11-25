/**
 * learning/root_cause.ts
 * Step 3 in Self-Healing Pipeline: Locate Cause
 */

import { FaultSignal } from "./fault_detection";

export interface RootCauseDiagnosis {
  diagnosisId: string;
  faultId: string;
  suspectedComponent: string;
  underlyingMechanism: string;
  isRecoverable: boolean;
  recommendedRepairStrategy: "RESTART_CONTAINER" | "ISOLATE_ORGAN" | "MUTATE_PROMPT" | "FALLBACK_PROVIDER" | "PATCH_CONFIG";
}

export function diagnoseRootCause(fault: FaultSignal): RootCauseDiagnosis {
  const msg = fault.message.toLowerCase();
  let suspectedComponent = fault.source;
  let underlyingMechanism = "Unexpected exception in runtime execution.";
  let isRecoverable = true;
  let strategy: RootCauseDiagnosis["recommendedRepairStrategy"] = "RESTART_CONTAINER";

  if (msg.includes("isolated") || msg.includes("circuit breaker")) {
    suspectedComponent = "organRegistry";
    underlyingMechanism = "Circuit breaker tripped due to consecutive failures.";
    strategy = "ISOLATE_ORGAN";
  } else if (msg.includes("rate limit") || msg.includes("429") || msg.includes("quota")) {
    suspectedComponent = "llmProvider";
    underlyingMechanism = "Upstream provider rate limit exhausted.";
    strategy = "FALLBACK_PROVIDER";
  } else if (msg.includes("invariant") || msg.includes("safety") || msg.includes("tamper")) {
    suspectedComponent = "constitution";
    underlyingMechanism = "Execution payload violated constitutional boundary.";
    strategy = "MUTATE_PROMPT";
  } else if (msg.includes("syntax") || msg.includes("json")) {
    suspectedComponent = "parser";
    underlyingMechanism = "Malformed payload structure.";
    strategy = "MUTATE_PROMPT";
  }

  return {
    diagnosisId: `diag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    faultId: fault.faultId,
    suspectedComponent,
    underlyingMechanism,
    isRecoverable,
    recommendedRepairStrategy: strategy,
  };
}
