/**
 * microfixd/organs/adaptation/workflow_mutator.ts
 * Mutates reasoning steps and workflow sequences
 */

import { ImprovementPlan } from "../reflection/improvement_generator";

export interface WorkflowMutation {
  workflowId: string;
  originalSteps: string[];
  adaptedSteps: string[];
  injectedGates: string[];
}

export function mutateWorkflow(
  workflowId: string,
  steps: string[],
  plan: ImprovementPlan
): WorkflowMutation {
  const adaptedSteps = [...steps];
  const injectedGates: string[] = [];

  if (plan.workflowStepCorrection) {
    adaptedSteps.splice(Math.max(0, adaptedSteps.length - 1), 0, "pre_completion_verification_gate");
    injectedGates.push("pre_completion_verification_gate");
  }

  return {
    workflowId,
    originalSteps: steps,
    adaptedSteps,
    injectedGates,
  };
}
