/**
 * microfixd/learning/adaptation.ts
 * Adaptation controller for live system execution
 */

import { adaptationOrgan, AdaptationProposal } from "../organs/adaptation/adapter";
import { ImprovementPlan } from "../organs/reflection/improvement_generator";

export class LearningAdaptationController {
  public createAdaptation(plan: ImprovementPlan, currentPrompt: string): AdaptationProposal {
    return adaptationOrgan.adapt({ plan, currentPrompt });
  }
}

export const learningAdaptationController = new LearningAdaptationController();
