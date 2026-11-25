/**
 * microfixd/organs/adaptation/adapter.ts
 * Organ 3: Adaptation Organ
 * Answers: "What should change?"
 * Synthesizes prompt updates, tool selections, and workflow mutations
 */

import { ImprovementPlan } from "../reflection/improvement_generator";
import { tunePrompt, PromptAdaptation } from "./prompt_tuner";
import { adaptToolPolicy, ToolPolicyAdaptation } from "./tool_selector";
import { mutateWorkflow, WorkflowMutation } from "./workflow_mutator";

export interface AdaptationProposal {
  id: string;
  timestamp: string;
  promptAdaptation: PromptAdaptation;
  toolAdaptation: ToolPolicyAdaptation;
  workflowMutation?: WorkflowMutation;
  summary: string;
}

export class AdaptationOrgan {
  public adapt(params: {
    plan: ImprovementPlan;
    currentPrompt?: string;
    currentTools?: string[];
    workflowId?: string;
    workflowSteps?: string[];
  }): AdaptationProposal {
    const promptAdaptation = tunePrompt(params.currentPrompt || "", params.plan);
    const toolAdaptation = adaptToolPolicy(params.currentTools || [], params.plan);
    const workflowMutation = params.workflowId
      ? mutateWorkflow(params.workflowId, params.workflowSteps || [], params.plan)
      : undefined;

    const summary = `Adaptation generated: ${promptAdaptation.diffSummary} | ${toolAdaptation.rationale}`;

    return {
      id: `adapt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      promptAdaptation,
      toolAdaptation,
      workflowMutation,
      summary,
    };
  }
}

export const adaptationOrgan = new AdaptationOrgan();
