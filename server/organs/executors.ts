import { executeAutomotiveOrgan } from "./organs/automotiveOrgan";
import { executeCrawlOrgan } from "./organs/crawlOrgan";
import { executeBrainOrgan } from "./organs/brainOrgan";
import { executeMemoryOrgan } from "./organs/memoryOrgan";
import { executePlaywrightOrgan } from "./organs/playwrightOrgan";
import { executeGithubOrgan } from "./organs/githubOrgan";
import { executeVoiceOrgan } from "./organs/voiceOrgan";
import { executeSecurityOrgan } from "./organs/securityOrgan";
import { executeEvolutionOrgan } from "./organs/evolutionOrgan";
import { executeReflexOrgan } from "./organs/reflexOrgan";
import { executeSchedulerOrgan } from "./organs/schedulerOrgan";
import { executeWorldModelOrgan } from "./organs/worldModelOrgan";
import { executeEvaluationOrgan, executeKnowledgeOrgan, executeReflectionOrgan, executeUncertaintyOrgan, executePolicyOrgan, executeParagonOrgan } from "./organs/cognitiveAssuranceOrgan";
import { governanceEngine } from "../../microfixd/backend/core/governance/engine";
import { missionEngine } from "../../microfixd/backend/core/mission/engine";
import { memory } from "../../microfixd/backend/core/memory/state";
import { telemetry } from "../../microfixd/backend/core/telemetry/grid";
import { agentRegistry } from "../../microfixd/backend/core/agents/registry";
import { initOrgans } from "../../microfixd/langgraph/organs";

export type ExecutorFn = (action: string, payload: unknown) => Promise<unknown>;

let _cognitiveOrgans: ReturnType<typeof initOrgans> | null = null;
function getCognitiveOrgans() {
  if (!_cognitiveOrgans) {
    try {
      _cognitiveOrgans = initOrgans();
    } catch (err) {
      console.warn("[executors] Cognitive organs lazy init:", err);
    }
  }
  return _cognitiveOrgans;
}

export const EXECUTORS: Record<string, ExecutorFn> = {
  vector_automotive: executeAutomotiveOrgan,
  crawl_engine: executeCrawlOrgan,
  brain: executeBrainOrgan,
  memory: executeMemoryOrgan,
  playwright: executePlaywrightOrgan,
  github_connector: executeGithubOrgan,
  voice: executeVoiceOrgan,
  security_spine: executeSecurityOrgan,
  evolution_engine: executeEvolutionOrgan,
  reflex: executeReflexOrgan,
  scheduler: executeSchedulerOrgan,
  world_model: executeWorldModelOrgan,
  world_thinking_engine: executeWorldModelOrgan,
  counterfactual_simulator: executeWorldModelOrgan,
  future_state_projector: executeWorldModelOrgan,
  invariance_verifier: executeWorldModelOrgan,
  hallucination_pruner: executeWorldModelOrgan,
  orchestration_oversight: executeWorldModelOrgan,
  recursion_governor: executeWorldModelOrgan,
  subagent_mesh_arbiter: executeWorldModelOrgan,
  emergency_kill_switch: executeWorldModelOrgan,
  anti_drift_anchor: executeWorldModelOrgan,
  critic_organ: executeEvaluationOrgan,
  knowledge_retriever: executeKnowledgeOrgan,
  reflection_organ: executeReflectionOrgan,
  uncertainty_detector: executeUncertaintyOrgan,
  epistemic_uncertainty_scorer: executeUncertaintyOrgan,
  policy_verifier: executePolicyOrgan,
  paragon: executeParagonOrgan,

  // LangGraph Core Systemic Organs
  "core.model": async (_action, payload: any) => {
    const prompt = typeof payload === "string" ? payload : payload?.prompt || payload?.task;
    if (!prompt) throw new Error("CORE_MODEL_PROMPT_REQUIRED");
    return executeBrainOrgan("complete", { messages:[{role:"user",content:String(prompt)}], session_id:payload?.session_id || "core" });
  },
  "core.tools": async () => {
    const organs = getCognitiveOrgans();
    if (!organs) throw new Error("COGNITIVE_ORGANS_UNAVAILABLE");
    return { tools: organs.tools.getAvailableTools(), status: "registered" };
  },
  "core.memory": async (action, payload: any) => {
    return executeMemoryOrgan(action, payload);
  },
  "core.legal": async (action,payload:any) => executePolicyOrgan(action,{...payload,actionName:payload?.actionName||action,agentKey:payload?.agentKey||"core.legal"}),
  "core.web": async (action, payload: any) => {
    return executePlaywrightOrgan(action, payload);
  },
  "core.deployment": async () => {
    throw new Error("CORE_DEPLOYMENT_REQUIRES_GOVERNED_DEPLOYMENT_PIPELINE");
  },
  "core.router": async (action, payload: any) => {
    const organs = getCognitiveOrgans();
    if (!organs) throw new Error("COGNITIVE_ORGANS_UNAVAILABLE");
    return organs.router.route({ type: action, payload });
  },
  "core.scheduler": async (action, payload: any) => {
    return executeSchedulerOrgan(action, payload);
  },
  "core.loop": async () => {
    const organs = getCognitiveOrgans();
    if (!organs) throw new Error("COGNITIVE_ORGANS_UNAVAILABLE");
    organs.loop.start();
    return { status: "started", loop: "BackgroundLoopEngine" };
  },
  "core.repair": async () => {
    throw new Error("CORE_REPAIR_REQUIRES_SANDBOX_VERIFICATION_AND_APPROVAL");
  },
  "core.autoDeploy": async () => {
    throw new Error("CORE_AUTODEPLOY_REQUIRES_GOVERNED_PROMOTION_PIPELINE");
  },
  "core.mission": async () => {
    return {mission:null,status:'use_durable_planner',endpoint:'/api/planner/missions'};
  },
  "core.feedback": async () => {
    const organs=getCognitiveOrgans();
    if(!organs)throw new Error("COGNITIVE_ORGANS_UNAVAILABLE");
    return { status: "registered", organ: "CognitiveFeedbackLoop" };
  },
  "core.paragon": async (action, payload: any) => executeParagonOrgan(action,payload),
  "core.federation": async () => {
    const organs=getCognitiveOrgans();if(!organs)throw new Error("COGNITIVE_ORGANS_UNAVAILABLE");
    return { federation: "FederationLayer", status: "registered" };
  },
  "core.emotion": async () => {
    const organs=getCognitiveOrgans();if(!organs)throw new Error("COGNITIVE_ORGANS_UNAVAILABLE");
    return { engine: "SyntheticEmotionEngine", status: "registered", note:"No emotional state is fabricated by this status call." };
  },
  "core.reflex": async (action, payload: any) => {
    return executeReflexOrgan(action, payload);
  },
  "core.voice": async (action, payload: any) => {
    return executeVoiceOrgan(action, payload);
  },
  "core.voiceOut": async () => ({ organ:"VoiceOutputOrgan", status:"registered" }),
  "core.voiceEmotion": async () => ({ organ:"VoiceEmotionOrgan", status:"registered" }),
  "core.voiceGrammar": async () => ({ organ:"VoiceCommandGrammarEngine", status:"registered" }),
  "core.wiring": async () => ({ organ:"UnifiedWiringOrgan", status:"registered" }),
};

/**
 * Returns a live executor for any of the 200+ registered organs in Microfixd OS.
 * Dispatches to domain-specific handlers, agent society, governance, or unified organ execution.
 */
export function getExecutor(organId: string): ExecutorFn {
  if (EXECUTORS[organId]) {
    return EXECUTORS[organId];
  }

  return async (action: string, payload: unknown = {}) => {
    const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
    const ts = new Date().toISOString();

    // 1. Agent society execution
    if (organId.startsWith("agent_")) {
      const agentKey = organId.replace("agent_", "").toLowerCase();
      const registeredAgent = agentRegistry[agentKey];
      if (!registeredAgent || typeof registeredAgent.execute !== "function") {
        throw new Error(`NO_REGISTERED_AGENT_EXECUTOR:${organId}`);
      }
      telemetry.push("organ_agent_dispatch", { organ: organId, action, ts: Date.now() });
      memory.logEvent({ type: "agent_organ_exec", agent: organId, action, timestamp: Date.now() });
      const agentResult = await registeredAgent.execute({
        mission: missionEngine.getCurrentMission(),
        memory,
        telemetry,
        action,
        payload: p
      });
      return { executed: true, organ: organId, agent: agentKey, action, status: "completed", timestamp: ts, result: agentResult };
    }

    // 2. Governance, Security & Constitutional evaluation
    if (organId === "governance" || organId === "constitution" || organId === "paragon" || organId.startsWith("anti_") || organId.includes("guard")) {
      const decision = await governanceEngine.evaluateAction(action, organId);
      return {
        executed: true,
        organ: organId,
        action,
        decision,
        timestamp: ts,
        constitutional_status: "active_enforcement"
      };
    }

    // 3. Registered definitions without a native executor are descriptive
    // capabilities only. Never fabricate sensor readings or execution success.
    if (organId.includes("sensor") || organId.includes("monitor") || organId.includes("telemetry")) {
      throw new Error(`NO_NATIVE_SENSOR_EXECUTOR:${organId}`);
    }

    throw new Error(`NO_NATIVE_EXECUTOR:${organId}`);
  };
}
