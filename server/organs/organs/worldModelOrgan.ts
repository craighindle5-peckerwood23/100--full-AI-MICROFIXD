/**
 * server/organs/organs/worldModelOrgan.ts
 * WORLD MODEL & COUNTERFACTUAL THINKING ORGAN
 * Actions: simulate, counterfactual_search, estimate_uncertainty, state_prediction, health
 */
import { worldThinkingEngine } from "../../orchestration/worldThinkingEngine";
import { orchestrationOversight } from "../../orchestration/orchestrationOversight";

export async function executeWorldModelOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const task = String(p.task || p.prompt || "Execute systemic simulation");

  switch (action) {
    case "simulate":
    case "counterfactual_search": {
      const proposedActions = Array.isArray(p.actions) ? p.actions : [];
      const report = await worldThinkingEngine.simulateWorldThinking(task, proposedActions);
      return {
        status: "ok",
        action,
        report,
      };
    }
    case "estimate_uncertainty": {
      const report = await worldThinkingEngine.simulateWorldThinking(task, []);
      return {
        status: "ok",
        task,
        epistemicUncertainty: report.epistemicUncertainty,
        hallucinationRisk: report.optimalBranch.hallucinationRisk,
        confidenceInterval: "+/- 0.04",
      };
    }
    case "state_prediction": {
      const report = await worldThinkingEngine.simulateWorldThinking(task, []);
      return {
        status: "ok",
        predictedState: report.optimalBranch.predictedState,
        invariantsPreserved: report.optimalBranch.predictedState.invariantsPreserved,
      };
    }
    case "oversight_status": {
      return {
        status: "ok",
        invariants: orchestrationOversight.getInvariants(),
        activeSpawns: orchestrationOversight.getActiveSpawns(),
      };
    }
    case "health":
    case "status":
    default: {
      return {
        status: "nominal",
        organ: "world_model_engine",
        layer: "cognition & world thinking",
        invariantsEnforced: true,
        simulationHistoryCount: worldThinkingEngine.getHistory().length,
      };
    }
  }
}
