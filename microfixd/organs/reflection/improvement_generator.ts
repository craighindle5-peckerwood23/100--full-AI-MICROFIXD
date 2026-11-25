/**
 * microfixd/organs/reflection/improvement_generator.ts
 * Generates concrete actionable improvements based on self critique
 */

import { CritiqueResult } from "./self_critique";

export interface ImprovementPlan {
  suggestedPromptAdjustment?: string;
  recommendedToolCall?: string;
  suggestedConstraint?: string;
  workflowStepCorrection?: string;
  keyDirectives: string[];
}

export function generateImprovementPlan(
  critique: CritiqueResult,
  task: string
): ImprovementPlan {
  const keyDirectives: string[] = [];

  let suggestedPromptAdjustment: string | undefined;
  let recommendedToolCall: string | undefined;
  let suggestedConstraint: string | undefined;
  let workflowStepCorrection: string | undefined;

  if (critique.missingEvidence.length > 0) {
    recommendedToolCall = "knowledge_retriever.retrieve or database query before generating answer";
    keyDirectives.push("Inject grounding evidence from retrieval organ prior to completion.");
  }

  if (critique.assumptions.length > 0) {
    suggestedConstraint = "Explicitly list required parameters without silent assumptions.";
    keyDirectives.push("Enforce parameter declaration constraint.");
  }

  if (critique.failureModes.some(m => m.includes("Incorrect assertion"))) {
    suggestedPromptAdjustment = "Prioritize empirical verification over generative guessing.";
    keyDirectives.push("Add verification checklist to system reasoning prompt.");
  }

  if (critique.failureModes.some(m => m.includes("Omission"))) {
    workflowStepCorrection = "Split execution into sequential multi-step subtasks with explicit review gates.";
    keyDirectives.push("Decompose complex goal into discrete verified checkpoints.");
  }

  if (keyDirectives.length === 0) {
    keyDirectives.push("Preserve existing prompt and execution strategy; metrics nominal.");
  }

  return {
    suggestedPromptAdjustment,
    recommendedToolCall,
    suggestedConstraint,
    workflowStepCorrection,
    keyDirectives,
  };
}
