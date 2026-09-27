// microfixd/core/autonomy/missionStateMachine.ts
import { AutonomousSchedulerOrgan } from "./scheduler";
import { AgentRouterOrgan } from "../agents/agentRouter";
import { MemoryOrgan } from "../memory/memory";
import { TelemetryGrid } from "../../backend/core/telemetry/grid";
import { GovernanceEngine } from "../../backend/core/governance/engine";
import { SelfRepairOrgan } from "./selfRepair";
import { AutoDeploymentOrgan } from "./autoDeployment";

export type MissionState =
  | "idle"
  | "planning"
  | "executing"
  | "validating"
  | "repairing"
  | "deploying"
  | "completed"
  | "failed";

export interface Mission {
  id: string;
  name: string;
  state: MissionState;
  steps: any[];
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export class MissionStateMachine {
  private missions: Mission[] = [];
  private running = false;

  constructor(
    private scheduler: AutonomousSchedulerOrgan,
    private router: AgentRouterOrgan,
    private memory: MemoryOrgan,
    private telemetry: TelemetryGrid,
    private governance: GovernanceEngine,
    private repair: SelfRepairOrgan,
    private autoDeploy: AutoDeploymentOrgan
  ) {}

  createMission(name: string, steps: any[]): Mission {
    const mission: Mission = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      state: "planning",
      steps,
      currentStep: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.missions.push(mission);
    this.memory.remember("mission_created", JSON.stringify(mission), { name });

    return mission;
  }

  getMissions(): Mission[] {
    return [...this.missions];
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
      for (const mission of this.missions) {
        if (mission.state !== "completed" && mission.state !== "failed") {
          await this.processMission(mission);
        }
      }
      await this.sleep(1000);
    }
  }

  private async processMission(mission: Mission) {
    const metrics = this.telemetry.getLatestMetrics();

    switch (mission.state) {
      case "planning":
        this.memory.remember("mission_planning", JSON.stringify(mission));
        mission.state = "executing";
        mission.updatedAt = new Date().toISOString();
        break;

      case "executing":
        const step = mission.steps[mission.currentStep];
        
        // Governance check
        const approved = await this.governance.evaluateAction("mission", "mission_step", step);

        if (approved.decision !== "ALLOW") {
          mission.state = "failed";
          mission.error = "blocked_by_governance";
          mission.updatedAt = new Date().toISOString();
          this.memory.remember("mission_failed", JSON.stringify(mission));
          return;
        }

        try {
          const result = await this.router.route(step);
          this.memory.remember("mission_step_executed", JSON.stringify({ missionId: mission.id, result }));
          
          mission.currentStep++;
          if (mission.currentStep >= mission.steps.length) {
            mission.state = "validating";
          }
        } catch (err: any) {
          mission.state = "failed";
          mission.error = err.message || String(err);
        }
        mission.updatedAt = new Date().toISOString();
        break;

      case "validating":
        // Simulate validation phase
        this.memory.remember("mission_validating", JSON.stringify(mission));
        await this.sleep(500);
        mission.state = "completed";
        mission.updatedAt = new Date().toISOString();
        this.memory.remember("mission_completed", JSON.stringify(mission));
        break;

      default:
        break;
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
