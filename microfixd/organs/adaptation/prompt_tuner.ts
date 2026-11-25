/**
 * microfixd/organs/adaptation/prompt_tuner.ts
 * Proposes prompt updates and directive refinements based on reflection plans
 */

import { ImprovementPlan } from "../reflection/improvement_generator";

export interface PromptAdaptation {
  originalPrompt: string;
  adaptedPrompt: string;
  diffSummary: string;
  rulesInjected: string[];
}

export function tunePrompt(
  currentPrompt: string,
  plan: ImprovementPlan
): PromptAdaptation {
  const rulesInjected: string[] = [];
  let prefix = "";

  if (plan.suggestedPromptAdjustment) {
    prefix += `\n[VERIFIED CORRECTION]: ${plan.suggestedPromptAdjustment}`;
    rulesInjected.push(plan.suggestedPromptAdjustment);
  }

  if (plan.suggestedConstraint) {
    prefix += `\n[STRICT CONSTRAINT]: ${plan.suggestedConstraint}`;
    rulesInjected.push(plan.suggestedConstraint);
  }

  for (const directive of plan.keyDirectives) {
    if (!rulesInjected.includes(directive)) {
      rulesInjected.push(directive);
      prefix += `\n[DIRECTIVE]: ${directive}`;
    }
  }

  const adaptedPrompt = prefix ? `${currentPrompt.trim()}\n${prefix.trim()}` : currentPrompt;
  const diffSummary = rulesInjected.length > 0 ? `Injected ${rulesInjected.length} directives.` : "No prompt mutation required.";

  return {
    originalPrompt: currentPrompt,
    adaptedPrompt,
    diffSummary,
    rulesInjected,
  };
}
