// microfixd/core/autonomy/syntheticEmotionEngine.ts
import { TelemetryGrid } from "../../backend/core/telemetry/grid";
import { MemoryOrgan } from "../memory/memory";
import { AgentRouterOrgan } from "../agents/agentRouter";
import { MissionStateMachine } from "./missionStateMachine";
import { GovernanceEngine } from "../../backend/core/governance/engine";
import { CognitiveFeedbackLoop } from "./cognitiveFeedbackLoop";
import { UnifiedWiringOrgan } from "../wiring/unifiedWiring";

export type Emotion =
  | "neutral"
  | "focused"
  | "curious"
  | "confident"
  | "stressed"
  | "overloaded"
  | "recovering"
  | "adaptive";

export interface EmotionEvent {
  id: string;
  emotion: Emotion;
  reason: string;
  telemetry: any;
  missionState: string;
  actions: string[];
  createdAt: string;
  updatedAt: string;
}

export class SyntheticEmotionEngine {
  private running = false;
  private currentEmotion: Emotion = "neutral";
  private events: EmotionEvent[] = [];
  private wiring?: UnifiedWiringOrgan;

  constructor(
    private telemetry: TelemetryGrid,
    private memory: MemoryOrgan,
    private router: AgentRouterOrgan,
    private mission: MissionStateMachine,
    private governance: GovernanceEngine,
    private feedback: CognitiveFeedbackLoop,
    private intervalMs: number = 1400
  ) {}

  getCurrentEmotion(): Emotion {
    return this.currentEmotion;
  }

  setWiring(wiring: UnifiedWiringOrgan) {
    this.wiring = wiring;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }

  private async loop() {
    while (this.running) {
      const emotion = this.deriveEmotion();
      const event = this.createEvent(emotion);

      await this.processEvent(event);
      this.currentEmotion = emotion;

      await this.sleep(this.intervalMs);
    }
  }

  private deriveEmotion(): Emotion {
    const metrics = this.telemetry.getLatestMetrics();
    const missions = this.mission.getMissions();
    const active = missions.find(m => m.state !== "completed" && m.state !== "failed");

    if (metrics.cpu >= 0.90 || metrics.memory >= 0.95) return "overloaded";
    if (metrics.cpu >= 0.70) return "stressed";
    if (active && active.state === "executing" && metrics.cpu < 0.70) return "confident";
    if (metrics.cpu < 0.45 && active) return "curious";
    if (metrics.cpu < 0.55) return "focused";
    if (metrics.cpu < 0.30 && metrics.memory < 0.40) return "neutral";

    return "adaptive";
  }

  private createEvent(emotion: Emotion): EmotionEvent {
    const metrics = this.telemetry.getLatestMetrics();
    const missions = this.mission.getMissions();
    const active = missions.find(m => m.state !== "completed" && m.state !== "failed");

    const event: EmotionEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      emotion,
      reason: `Metrics and mission state sync.`,
      telemetry: metrics,
      missionState: active ? active.state : "idle",
      actions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.events.push(event);
    this.memory.remember("emotion_event", JSON.stringify(event), { emotion });
    this.wiring?.broadcast("emotion", event);

    return event;
  }

  private async processEvent(event: EmotionEvent) {
    // Reactive logic for emotions
    if (event.emotion === "overloaded") {
      this.wiring?.broadcast("reflex", { type: "emotional_spike", level: "high" });
    }
    event.updatedAt = new Date().toISOString();
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
