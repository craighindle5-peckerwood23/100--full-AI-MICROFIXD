// microfixd/langgraph/organs.ts
import { AutonomousSchedulerOrgan } from "../core/autonomy/scheduler";
import { AgentRouterOrgan } from "../core/agents/agentRouter";
import { MemoryOrgan } from "../core/memory/memory";
import { BackgroundLoopEngine } from "../core/autonomy/backgroundLoop";
import { SelfRepairOrgan } from "../core/autonomy/selfRepair";
import { AutoDeploymentOrgan } from "../core/autonomy/autoDeployment";
import { MissionStateMachine } from "../core/autonomy/missionStateMachine";
import { CognitiveFeedbackLoop } from "../core/autonomy/cognitiveFeedbackLoop";
import { FederationLayer } from "../core/federation/federationLayer";
import { SyntheticEmotionEngine } from "../core/autonomy/syntheticEmotionEngine";
import { SyntheticReflexEngine } from "../core/autonomy/syntheticReflexEngine";
import { UnifiedWiringOrgan } from "../core/wiring/unifiedWiring";
import { ParagonDissectorOrgan } from "../core/governance/paragonDissector";
import { VoiceOrgan } from "../core/voice/voiceOrgan";
import { VoiceOutputOrgan } from "../core/voice/voiceOutputOrgan";
import { VoiceEmotionOrgan } from "../core/voice/voiceEmotionOrgan";
import { VoiceCommandGrammarEngine } from "../core/voice/voiceCommandGrammarEngine";
import { WebExecutionOrgan } from "../core/execution/webExecution";
import { telemetry } from "../backend/core/telemetry/grid";
import { governanceEngine } from "../backend/core/governance/engine";

export class ModelOrgan {
  async generate(prompt: string): Promise<string> {
    return `Synthesized intelligence response for: "${prompt}"`;
  }
}

export class ToolOrgan {
  getAvailableTools(): string[] {
    return ["analyze_code", "generate_fix", "apply_patch", "run_tests", "deploy_applet"];
  }
}

export class LegalSchema {
  verifyDirectiveCompliance(actionName: string): boolean {
    return true; // Simple policy gate pass
  }
}

export class DeploymentOrgan {
  async deploy(config: any): Promise<{ status: string; url: string; timestamp: number }> {
    return {
      status: "deployed",
      url: "https://ais-pre-5wabdd3ikwqbd5ilzhchtw-209774381029.us-west2.run.app",
      timestamp: Date.now()
    };
  }
}

export interface Organs {
  model: ModelOrgan;
  tools: ToolOrgan;
  memory: MemoryOrgan;
  legal: LegalSchema;
  web: WebExecutionOrgan;
  deployment: DeploymentOrgan;
  router: AgentRouterOrgan;
  scheduler: AutonomousSchedulerOrgan;
  loop: BackgroundLoopEngine;
  repair: SelfRepairOrgan;
  autoDeploy: AutoDeploymentOrgan;
  mission: MissionStateMachine;
  feedback: CognitiveFeedbackLoop;
  paragon: ParagonDissectorOrgan;
  federation: FederationLayer;
  emotion: SyntheticEmotionEngine;
  reflex: SyntheticReflexEngine;
  voice: VoiceOrgan;
  voiceOut: VoiceOutputOrgan;
  voiceEmotion: VoiceEmotionOrgan;
  voiceGrammar: VoiceCommandGrammarEngine;
  wiring: UnifiedWiringOrgan;
}

let organsSingleton: Organs | null = null;

export function initOrgans(): Organs {
  if (organsSingleton) return organsSingleton;

  const model = new ModelOrgan();
  const tools = new ToolOrgan();
  const memory = new MemoryOrgan();
  const legal = new LegalSchema();
  const wiring = new UnifiedWiringOrgan(memory, governanceEngine);
  const web = new WebExecutionOrgan(wiring, memory);
  const deployment = new DeploymentOrgan();
  const router = new AgentRouterOrgan();
  const scheduler = new AutonomousSchedulerOrgan(router, memory);
  const repair = new SelfRepairOrgan(telemetry, memory, router, governanceEngine);
  const autoDeploy = new AutoDeploymentOrgan(memory, governanceEngine, router, telemetry);
  const mission = new MissionStateMachine(scheduler, router, memory, telemetry, governanceEngine, repair, autoDeploy);
  const feedback = new CognitiveFeedbackLoop(telemetry, memory, router, mission, governanceEngine);
  const federation = new FederationLayer(router, memory, telemetry, governanceEngine);
  const emotion = new SyntheticEmotionEngine(telemetry, memory, router, mission, governanceEngine, feedback);
  const reflex = new SyntheticReflexEngine(wiring, telemetry, router, mission, federation, memory);
  const paragon = new ParagonDissectorOrgan(memory, wiring);
  const voiceGrammar = new VoiceCommandGrammarEngine(wiring, memory, router, mission, emotion);
  const voice = new VoiceOrgan(wiring, memory, router, emotion, feedback, mission, voiceGrammar);
  const voiceOut = new VoiceOutputOrgan(wiring, memory, emotion, feedback);
  const voiceEmotion = new VoiceEmotionOrgan(wiring, memory, emotion, feedback);
  const loop = new BackgroundLoopEngine(scheduler, router, memory, telemetry, governanceEngine, repair, autoDeploy);

  // Set cross-organ wiring
  federation.setWiring(wiring);
  emotion.setWiring(wiring);
  governanceEngine.setParagon(paragon);

  organsSingleton = {
    model,
    tools,
    memory,
    legal,
    web,
    deployment,
    router,
    scheduler,
    loop,
    repair,
    autoDeploy,
    mission,
    feedback,
    paragon,
    federation,
    emotion,
    reflex,
    voice,
    voiceOut,
    voiceEmotion,
    voiceGrammar,
    wiring
  };
  return organsSingleton;
}
