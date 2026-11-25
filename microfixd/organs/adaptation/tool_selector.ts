/**
 * microfixd/organs/adaptation/tool_selector.ts
 * Adapts tool selection policy based on reflection requirements
 */

import { ImprovementPlan } from "../reflection/improvement_generator";

export interface ToolPolicyAdaptation {
  addedTools: string[];
  restrictedTools: string[];
  executionSequence: string[];
  rationale: string;
}

export function adaptToolPolicy(
  currentTools: string[],
  plan: ImprovementPlan
): ToolPolicyAdaptation {
  const addedTools: string[] = [];
  const restrictedTools: string[] = [];
  const executionSequence = [...currentTools];

  if (plan.recommendedToolCall) {
    const toolName = plan.recommendedToolCall.split(".")[0] || plan.recommendedToolCall;
    if (!executionSequence.includes(toolName)) {
      executionSequence.unshift(toolName);
      addedTools.push(toolName);
    }
  }

  const rationale = addedTools.length > 0
    ? `Pre-pended ${addedTools.join(", ")} to ensure prerequisite grounding.`
    : "Tool execution sequence nominal.";

  return {
    addedTools,
    restrictedTools,
    executionSequence,
    rationale,
  };
}
