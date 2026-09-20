// microfixd/core/autonomy/backgroundLoop.ts
import { AutonomousSchedulerOrgan } from "./scheduler";
import { AgentRouterOrgan } from "../agents/agentRouter";
import { MemoryOrgan } from "../memory/memory";
import { TelemetryGrid } from "../../backend/core/telemetry/grid";
import { GovernanceEngine } from "../../backend/core/governance/engine";
import { SelfRepairOrgan } from "./selfRepair";
import { AutoDeploymentOrgan } from "./autoDeployment";

export class BackgroundLoopEngine {
  private running = false;
  private intervalMs: number;

  constructor(
    private scheduler: AutonomousSchedulerOrgan,
    private router: AgentRouterOrgan,
    private memory: MemoryOrgan,
    private telemetry: TelemetryGrid,
    private governance: GovernanceEngine,
    private repair: SelfRepairOrgan,
    private autoDeploy: AutoDeploymentOrgan,
    intervalMs: number = 1500
  ) {
    this.intervalMs = intervalMs;
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
      try {
        const metrics = this.telemetry.getLatestMetrics();
        const pending = this.scheduler.getQueue().filter(t => t.status === "pending");

        // 1. Telemetry-driven autonomous actions
        if (metrics.cpu > 0.85 || metrics.memory > 0.90 || metrics.network > 0.80) {
          const event = this.repair.planRepair("telemetry_threshold", metrics);
          await this.repair.executeRepair(event);
        }

        // 2. Governance-driven approvals
        const approvals = this.governance.getPendingApprovals();
        for (const approval of approvals) {
          if (approval.autoApprove) {
            this.governance.approve(approval.id);
            this.scheduler.addTask(approval.type ?? "code", approval.payload);
          }
        }

        // 3. Memory-driven follow-up tasks
        const recent = this.memory.search("follow_up");
        if (recent.length > 0) {
          for (const item of recent) {
            this.scheduler.addTask("analysis", {
              memoryId: item.id,
              content: item.content
            });
          }
        }

        // 4. Idle-time autonomous tasks
        if (pending.length === 0) {
          this.scheduler.addTask("heartbeat", {
            timestamp: Date.now(),
            status: "idle_cycle"
          });
        }

        // 5. Deploy triggers
        if (metrics.deployTrigger) {
          const event = this.autoDeploy.planDeployment(
            "microfixd-service",
            "./microfixd_fs/code",
            "/data/data/com.termux/files/home/services/microfixd-service",
            "telemetry_trigger"
          );
          await this.autoDeploy.executeDeployment(event);
        }
      } catch (err) {
        console.error("Error in background loop iteration:", err);
      }

      await this.sleep(this.intervalMs);
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
