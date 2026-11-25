export * from "./uncertainty";
export * from "./self_critique";
export * from "./improvement_generator";

import { performSelfCritique, CritiqueResult } from "./self_critique";
import { generateImprovementPlan, ImprovementPlan } from "./improvement_generator";
import { EvaluationScoreResult } from "../evaluation/scoring";
import { EvaluationFeedback } from "../evaluation/feedback";

export class ReflectionOrgan {
  public reflect(params: {
    task: string;
    output: string;
    scores: EvaluationScoreResult;
    feedback: EvaluationFeedback;
    evidence?: any[];
  }): { critique: CritiqueResult; plan: ImprovementPlan } {
    const critique = performSelfCritique(params);
    const plan = generateImprovementPlan(critique, params.task);
    return { critique, plan };
  }
}

export const reflectionOrgan = new ReflectionOrgan();
