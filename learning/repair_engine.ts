/**
 * learning/repair_engine.ts
 * Step 4 in Self-Healing Pipeline: Generate Fix
 */

import { RootCauseDiagnosis } from "./root_cause";

export interface RepairPatch {
  patchId: string;
  diagnosisId: string;
  strategy: string;
  actionScript: string;
  reversible: boolean;
  requiresHITL: boolean;
}

export function generateRepairPatch(diagnosis: RootCauseDiagnosis): RepairPatch {
  let actionScript = "";
  let requiresHITL = false;

  switch (diagnosis.recommendedRepairStrategy) {
    case "FALLBACK_PROVIDER":
      actionScript = "switchProviderFallbackCascade('groq', 'gemini');";
      break;
    case "ISOLATE_ORGAN":
      actionScript = `organRegistry.isolate('${diagnosis.suspectedComponent}');`;
      requiresHITL = true;
      break;
    case "MUTATE_PROMPT":
      actionScript = "adaptationOrgan.adapt({ plan: { keyDirectives: ['Enforce strict schema validation'] } });";
      break;
    case "PATCH_CONFIG":
      actionScript = "reloadRuntimeConfiguration();";
      break;
    default:
      actionScript = `organRegistry.reset('${diagnosis.suspectedComponent}');`;
  }

  return {
    patchId: `patch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    diagnosisId: diagnosis.diagnosisId,
    strategy: diagnosis.recommendedRepairStrategy,
    actionScript,
    reversible: true,
    requiresHITL,
  };
}
