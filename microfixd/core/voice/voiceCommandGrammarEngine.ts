// microfixd/core/voice/voiceCommandGrammarEngine.ts
import { UnifiedWiringOrgan } from "../wiring/unifiedWiring";
import { MemoryOrgan } from "../memory/memory";
import { AgentRouterOrgan } from "../agents/agentRouter";
import { MissionStateMachine } from "../autonomy/missionStateMachine";
import { SyntheticEmotionEngine } from "../autonomy/syntheticEmotionEngine";

export interface ParsedCommand {
  id: string;
  raw: string;
  intent: string;
  target?: string;
  params?: Record<string, any>;
  createdAt: string;
}

export class VoiceCommandGrammarEngine {
  constructor(
    private wiring: UnifiedWiringOrgan,
    private memory: MemoryOrgan,
    private router: AgentRouterOrgan,
    private mission: MissionStateMachine,
    private emotion: SyntheticEmotionEngine
  ) {}

  parse(raw: string): ParsedCommand {
    const lower = raw.toLowerCase();

    let intent = "unknown";
    let target: string | undefined;
    let params: Record<string, any> = {};

    // Mission creation
    if (lower.startsWith("start mission")) {
      intent = "create_mission";
      target = raw.replace(/start mission/i, "").trim() || "voice-mission";
    }

    // Agent execution
    else if (lower.startsWith("run agent")) {
      intent = "run_agent";
      target = lower.replace("run agent", "").trim();
    }

    // Emotion modulation
    else if (lower.includes("calm down")) {
      intent = "emotion_modulate";
      target = "calm";
    }

    else if (lower.includes("focus")) {
      intent = "emotion_modulate";
      target = "focused";
    }

    else if (lower.includes("speed up")) {
      intent = "mission_accelerate";
    }

    else if (lower.includes("slow down")) {
      intent = "mission_decelerate";
    }

    // System commands
    else if (lower.includes("status")) {
      intent = "system_status";
    }

    else if (lower.includes("deploy")) {
      intent = "deploy_service";
      target = raw.replace(/deploy/i, "").trim();
    }

    else if (lower.includes("repair")) {
      intent = "trigger_repair";
    }

    const parsed: ParsedCommand = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      raw,
      intent,
      target,
      params,
      createdAt: new Date().toISOString(),
    };

    this.memory.remember("voice_command_parsed", JSON.stringify(parsed), { intent });
    this.wiring.broadcast("cognition", parsed);

    return parsed;
  }

  async execute(parsed: ParsedCommand) {
    switch (parsed.intent) {
      case "create_mission":
        this.mission.createMission(parsed.target!, [
          {
            type: "model",
            payload: {
              systemPrompt: "Interpret voice mission intent.",
              userPrompt: parsed.raw,
            },
          },
        ]);
        break;

      case "run_agent":
        await this.router.route({
          type: parsed.target!,
          payload: {
            systemPrompt: "Execute voice agent command.",
            userPrompt: parsed.raw,
          },
        });
        break;

      case "emotion_modulate":
        this.wiring.broadcast("emotion", {
          type: "voice_modulation",
          emotion: parsed.target,
        });
        break;

      case "mission_accelerate":
        this.wiring.broadcast("mission", { type: "accelerate" });
        break;

      case "mission_decelerate":
        this.wiring.broadcast("mission", { type: "decelerate" });
        break;

      case "system_status":
        await this.router.route({
          type: "model",
          payload: {
            systemPrompt: "Summarize system status.",
            userPrompt: "Provide system status.",
          },
        });
        break;

      case "deploy_service":
        await this.router.route({
          type: "deploy",
          payload: {
            service: parsed.target,
            reason: "voice_command",
          },
        });
        break;

      case "trigger_repair":
        await this.router.route({
          type: "repair",
          payload: {
            reason: "voice_command",
          },
        });
        break;

      default:
        await this.router.route({
          type: "model",
          payload: {
            systemPrompt: "Interpret unknown voice command.",
            userPrompt: parsed.raw,
          },
        });
        break;
    }
  }
}
