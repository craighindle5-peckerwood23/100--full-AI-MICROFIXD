/**
 * microfixd/runtime/runtime_pipeline.ts
 * End-to-end runtime pipeline connecting Microfyxd organs, tools, and the LLM
 */

import { executeBrainOrgan } from "../../server/organs/organs/brainOrgan";
import { realLearningPipeline, LearningCycleReport } from "../learning/learning_loop";
import { TOOL_REGISTRY, ToolDefinition } from "../../server/tools/toolRegistry";

export interface SystemExecutionResult {
  task: string;
  solution: string;
  learningReport: LearningCycleReport;
  toolsAvailableCount: number;
  toolsInvoked: string[];
  executionTimeMs: number;
}

export class RuntimePipeline {
  public getAvailableTools(): ToolDefinition[] {
    return TOOL_REGISTRY;
  }

  public async executeTask(params: {
    task: string;
    tenant_id?: string;
    session_id?: string;
  }): Promise<SystemExecutionResult> {
    const start = Date.now();
    const tenant_id = params.tenant_id || "global";
    const session_id = params.session_id || "default";

    // 1. Initial execution by Brain Organ
    const brainResult = await executeBrainOrgan("complete", {
      prompt: params.task,
      tenant_id,
      session_id,
    }) as { text?: string; final_answer?: string };

    const initialAnswer = brainResult?.text || brainResult?.final_answer || "Processed by Microfyxd";

    // 2. Real Learning Pipeline (Evaluate -> Reflect -> Adapt -> Verify -> Remember)
    const learningReport = await realLearningPipeline.executeLearningCycle({
      task: params.task,
      initialOutput: initialAnswer,
      tenant_id,
    });

    const solution = learningReport.improvedFinalOutput || initialAnswer;

    return {
      task: params.task,
      solution,
      learningReport,
      toolsAvailableCount: TOOL_REGISTRY.length,
      toolsInvoked: ["brain", "memory", "evaluation_organ"],
      executionTimeMs: Date.now() - start,
    };
  }
}

export const runtimePipeline = new RuntimePipeline();
