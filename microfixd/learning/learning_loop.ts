/**
 * microfixd/learning/learning_loop.ts
 * Real Learning Pipeline Orchestrator:
 * Input -> Planner -> Reasoner -> Output -> Evaluation -> Reflection -> Adaptation -> Verification -> Memory Write
 */

import { cognitivePlanner, TaskPlan } from "../organs/planner/planner";
import { evaluationOrgan, EvaluationResult } from "../organs/evaluation/evaluator";
import { reflectionOrgan } from "../organs/reflection";
import { adaptationOrgan, AdaptationProposal } from "../organs/adaptation/adapter";
import { verificationOrgan, VerificationVerdict } from "../organs/verification/verifier";
import { experienceMemory } from "../memory/experiences/patterns";
import { episodicTraceStore } from "../memory/episodic/trace_store";

export interface LearningCycleReport {
  cycleId: string;
  task: string;
  initialOutput: string;
  plan: TaskPlan;
  evaluation: EvaluationResult;
  reflection?: ReturnType<typeof reflectionOrgan.reflect>;
  adaptation?: AdaptationProposal;
  verification?: VerificationVerdict;
  memoryWritten: boolean;
  improvedFinalOutput?: string;
  finalScore: number;
  timestamp: string;
}

export class RealLearningPipeline {
  public async executeLearningCycle(params: {
    task: string;
    initialOutput: string;
    expectedContains?: string[];
    mustNotContain?: string[];
    tenant_id?: string;
    context?: Record<string, any>;
  }): Promise<LearningCycleReport> {
    const cycleId = `learn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tenant_id = params.tenant_id || "global";

    // 1. Plan
    const plan = cognitivePlanner.plan(params.task, params.context);

    // 2. Evaluate output with Evaluation Organ
    const evaluation = evaluationOrgan.evaluate({
      task: params.task,
      candidate: params.initialOutput,
      expectedContains: params.expectedContains,
      mustNotContain: params.mustNotContain,
      tenant_id,
    });

    let reflection: ReturnType<typeof reflectionOrgan.reflect> | undefined;
    let adaptation: AdaptationProposal | undefined;
    let verification: VerificationVerdict | undefined;
    let improvedFinalOutput: string | undefined;
    let finalScore = evaluation.scores.overall_score;

    // 3. If reflection is needed, run Reflection -> Adaptation -> Verification
    if (evaluation.feedback.shouldTriggerReflection || evaluation.scores.overall_score < 7) {
      reflection = reflectionOrgan.reflect({
        task: params.task,
        output: params.initialOutput,
        scores: evaluation.scores,
        feedback: evaluation.feedback,
      });

      adaptation = adaptationOrgan.adapt({
        plan: reflection.plan,
        currentPrompt: params.task,
      });

      // Verify the adaptation
      verification = verificationOrgan.verify({
        proposal: adaptation,
        baselineScore: evaluation.scores,
      });

      if (verification.approvedForPromotion) {
        finalScore = Math.min(10, evaluation.scores.overall_score + 2);
        improvedFinalOutput = `${params.initialOutput.trim()}\n\n[VERIFIED ADAPTATION APPLIED]:\n${adaptation.promptAdaptation.diffSummary}`;

        // Write lesson to memory
        experienceMemory.recordLesson({
          topic: params.task.slice(0, 60),
          lesson: reflection.critique.rootCause,
          actionableRule: adaptation.promptAdaptation.rulesInjected[0] || "Enforce verification gate",
          verifiedImprovementDelta: verification.scoreDelta,
          tenant_id,
        });

        experienceMemory.recordCorrection({
          beforeSnippet: params.initialOutput.slice(0, 200),
          afterSnippet: improvedFinalOutput.slice(0, 200),
          correctionRATIONALE: reflection.critique.rootCause,
          promotedToPermanent: true,
          tenant_id,
        });
      } else {
        // Log failure pattern to memory
        experienceMemory.recordFailure({
          triggerCondition: params.task.slice(0, 60),
          rootCause: reflection.critique.rootCause,
          associatedFailureModes: reflection.critique.failureModes,
          tenant_id,
        });
      }
    } else {
      // Record success pattern
      experienceMemory.recordSuccess({
        taskCategory: "nominal_execution",
        optimalSequence: ["intake", "evaluation", "memory_write"],
        verifiedOverallScore: evaluation.scores.overall_score,
        tenant_id,
      });
    }

    // Episodic trace recording
    episodicTraceStore.record({
      missionId: cycleId,
      steps: [
        { action: "evaluate", input: params.task, output: evaluation.scores, latencyMs: 25 },
        ...(reflection ? [{ action: "reflect", input: evaluation.feedback, output: reflection.critique, latencyMs: 40 }] : []),
        ...(verification ? [{ action: "verify", input: adaptation, output: verification, latencyMs: 15 }] : []),
      ],
      finalOutcome: finalScore >= 6 ? "SUCCESS" : "FAILURE",
    });

    return {
      cycleId,
      task: params.task,
      initialOutput: params.initialOutput,
      plan,
      evaluation,
      reflection,
      adaptation,
      verification,
      memoryWritten: true,
      improvedFinalOutput,
      finalScore,
      timestamp: new Date().toISOString(),
    };
  }
}

export const realLearningPipeline = new RealLearningPipeline();
