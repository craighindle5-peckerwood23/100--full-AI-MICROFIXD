// microfixd/core/autonomy/cognitiveFeedbackLoop.ts
import { TelemetryGrid } from "../../backend/core/telemetry/grid";
import { MemoryOrgan } from "../memory/memory";
import { AgentRouterOrgan } from "../agents/agentRouter";
import { MissionStateMachine } from "./missionStateMachine";
import { GovernanceEngine } from "../../backend/core/governance/engine";

export type CognitiveState =
  | "idle"
  | "focused"
  | "alert"
  | "overloaded"
  | "repairing"
  | "deploying"
  | "mission_drive"
  | "learning";

export interface FeedbackEvent {
  id: string;
  avatarState: CognitiveState;
  telemetry: any;
  missionState: string;
  actions: string[];
  createdAt: string;
  updatedAt: string;
}

export class CognitiveFeedbackLoop {
  private running = false;
  private events: FeedbackEvent[] = [];

  constructor(
    private telemetry: TelemetryGrid,
    private memory: MemoryOrgan,
    private router: AgentRouterOrgan,
    private mission: MissionStateMachine,
    private governance: GovernanceEngine,
    private intervalMs: number = 1200
  ) {}

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
      try {
        const avatarState = this.deriveAvatarState();
        const telemetryMetrics = this.telemetry.getLatestMetrics();
        const missionState = this.getMissionState();

        const event = this.createEvent(avatarState, telemetryMetrics, missionState);
        await this.processEvent(event);
      } catch (err) {
        console.error("Cognitive Feedback Loop Error:", err);
      }

      await this.sleep(this.intervalMs);
    }
  }

  private deriveAvatarState(): CognitiveState {
    const metrics = this.telemetry.getLatestMetrics();

    if (metrics.cpu >= 0.90 || metrics.memory >= 0.95) return "overloaded";
    if (metrics.cpu >= 0.80) return "alert";
    
    const activeMission = this.mission.getMissions().some(m => m.state === "executing");
    if (activeMission) return "mission_drive";

    if (metrics.cpu < 0.30 && metrics.memory < 0.40) return "idle";
    if (metrics.cpu < 0.60) return "focused";

    return "learning";
  }

  private getMissionState(): string {
    const missions = this.mission.getMissions();
    const active = missions.find(m => m.state !== "completed" && m.state !== "failed");
    return active ? active.state : "none";
  }

  private createEvent(avatarState: CognitiveState, telemetry: any, missionState: string): FeedbackEvent {
    const event: FeedbackEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      avatarState,
      telemetry,
      missionState,
      actions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.events.push(event);
    this.memory.remember("cognitive_feedback_event", JSON.stringify(event), { avatarState });

    return event;
  }

  private async processEvent(event: FeedbackEvent) {
    // React to cognitive state
    if (event.avatarState === "overloaded") {
      event.actions.push("request_emergency_repair");
      // Trigger a direct repair if possible or alert the system
      this.memory.remember("cognitive_alert", "System is overloaded, requesting immediate resource rebalancing.");
    }

    if (event.avatarState === "idle" && Math.random() > 0.9) {
      event.actions.push("start_background_learning");
      // Could trigger a background knowledge indexing task
    }

    event.updatedAt = new Date().toISOString();
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
