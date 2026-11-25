/**
 * server/organs/organs/worldModelOrgan.ts
 * WORLD MODEL & COUNTERFACTUAL THINKING ORGAN
 * Actions: simulate, counterfactual_search, estimate_uncertainty, state_prediction,
 *          multidomain_reason, analyze_perspectives, retrospect_inception, deep_metacognition,
 *          oversight_status, emergency_kill, health
 */
import { worldThinkingEngine } from "../../orchestration/worldThinkingEngine";
import { orchestrationOversight } from "../../orchestration/orchestrationOversight";
import type { CognitiveDomainId } from "../../orchestration/metacognitiveReasoning";

export async function executeWorldModelOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const task = String(p.task || p.problem || p.prompt || "Execute systemic simulation");
  const tenantId = typeof p.tenant_id === "string" && p.tenant_id.trim() ? p.tenant_id.trim() : "default";

  switch (action) {
    case "simulate":
    case "counterfactual_search": {
      const proposedActions = Array.isArray(p.actions) ? p.actions : [];
      const evidence = Array.isArray(p.evidence) ? p.evidence.map(String) : undefined;
      const report = await worldThinkingEngine.simulateWorldThinking(task, proposedActions, {
        tenantId,
        evidence,
        useLlm: Boolean(p.use_llm ?? p.useLlm),
      });
      return {
        status: "ok",
        action,
        report,
      };
    }
    case "multidomain_reason":
    case "deep_metacognition": {
      const analysis = await worldThinkingEngine.runDeepMetacognition({
        problem: task,
        inceptionPrompt: typeof p.inception_prompt === "string" ? p.inception_prompt : typeof p.inceptionPrompt === "string" ? p.inceptionPrompt : undefined,
        intendedOutcome: typeof p.intended_outcome === "string" ? p.intended_outcome : typeof p.intendedOutcome === "string" ? p.intendedOutcome : undefined,
        observedOutcome: typeof p.observed_outcome === "string" ? p.observed_outcome : typeof p.observedOutcome === "string" ? p.observedOutcome : undefined,
        evidence: Array.isArray(p.evidence) ? p.evidence.map(String) : undefined,
        constraints: Array.isArray(p.constraints) ? p.constraints.map(String) : undefined,
        domains: Array.isArray(p.domains) ? (p.domains as CognitiveDomainId[]) : undefined,
        proposedActions: Array.isArray(p.actions) ? p.actions : undefined,
        useLlm: Boolean(p.use_llm ?? p.useLlm),
        requireLlm: Boolean(p.require_llm ?? p.requireLlm),
        tenantId,
        sessionId: typeof p.session_id === "string" ? p.session_id : undefined,
      });
      return {
        status: "ok",
        action,
        analysis,
      };
    }
    case "analyze_perspectives": {
      const analysis = await worldThinkingEngine.runDeepMetacognition({
        problem: task,
        inceptionPrompt: typeof p.inception_prompt === "string" ? p.inception_prompt : undefined,
        evidence: Array.isArray(p.evidence) ? p.evidence.map(String) : undefined,
        perspectives: Array.isArray(p.perspectives) ? p.perspectives : undefined,
        useLlm: Boolean(p.use_llm ?? p.useLlm),
        tenantId,
      });
      return {
        status: "ok",
        action,
        perspectives: analysis.perspectives,
        uncertainty: analysis.uncertainty,
      };
    }
    case "retrospect_inception": {
      const retrospection = await worldThinkingEngine.retrospect({
        problem: task,
        inceptionPrompt: typeof p.inception_prompt === "string" ? p.inception_prompt : typeof p.inceptionPrompt === "string" ? p.inceptionPrompt : undefined,
        intendedOutcome: typeof p.intended_outcome === "string" ? p.intended_outcome : typeof p.intendedOutcome === "string" ? p.intendedOutcome : undefined,
        observedOutcome: typeof p.observed_outcome === "string" ? p.observed_outcome : typeof p.observedOutcome === "string" ? p.observedOutcome : undefined,
        evidence: Array.isArray(p.evidence) ? p.evidence.map(String) : undefined,
        constraints: Array.isArray(p.constraints) ? p.constraints.map(String) : undefined,
        tenantId,
      });
      return {
        status: "ok",
        action,
        retrospection,
      };
    }
    case "estimate_uncertainty": {
      const report = await worldThinkingEngine.simulateWorldThinking(task, [], { tenantId });
      return {
        status: "ok",
        task,
        epistemicUncertainty: report.epistemicUncertainty,
        hallucinationRisk: report.optimalBranch.hallucinationRisk,
        uncertaintyBreakdown: report.metacognition?.uncertainty.breakdown,
        calibrationBasis: report.metacognition?.uncertainty.calibrationBasis,
      };
    }
    case "state_prediction": {
      const report = await worldThinkingEngine.simulateWorldThinking(task, [], { tenantId });
      return {
        status: "ok",
        predictedState: report.optimalBranch.predictedState,
        invariantsPreserved: report.optimalBranch.predictedState.invariantsPreserved,
        capabilityPosture: report.capabilityPosture,
      };
    }
    case "emergency_kill": {
      return {engaged:orchestrationOversight.triggerEmergencyKill(),reason:String(p.reason??"Operator request"),scope:"local_oversight_registry"};
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
        metacognitiveHistoryCount: worldThinkingEngine.getMetacognitiveHistory(tenantId).length,
      };
    }
  }
}
