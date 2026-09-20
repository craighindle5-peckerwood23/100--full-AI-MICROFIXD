// microfixd/core/autonomy/selfRepair.ts
import { TelemetryGrid } from "../../backend/core/telemetry/grid";
import { MemoryOrgan } from "../memory/memory";
import { AgentRouterOrgan } from "../agents/agentRouter";
import { GovernanceEngine } from "../../backend/core/governance/engine";

export interface RepairEvent {
  id: string;
  type: string;
  reason: string;
  metrics: any;
  actions: string[];
  status: "planned" | "executing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

export class SelfRepairOrgan {
  private events: RepairEvent[] = [];

  constructor(
    private telemetry: TelemetryGrid,
    private memory: MemoryOrgan,
    private router: AgentRouterOrgan,
    private governance: GovernanceEngine
  ) {}

  planRepair(reason: string, metrics: any): RepairEvent {
    const event: RepairEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "system_repair",
      reason,
      metrics,
      actions: [],
      status: "planned",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.events.push(event);
    this.memory.remember("repair_planned", JSON.stringify(event), { reason });

    return event;
  }

  async executeRepair(event: RepairEvent): Promise<RepairEvent> {
    event.status = "executing";
    event.updatedAt = new Date().toISOString();
    this.memory.remember("repair_executing", JSON.stringify(event));

    // 1. CPU spike repair
    if (event.metrics.cpu > 0.85) {
      event.actions.push("rebalance_threads");
      try {
        await this.router.route({
          type: "code",
          payload: {
            systemPrompt: "You are a TS engineer.",
            userPrompt: "Rebalance internal thread pools to reduce CPU load.",
          },
        });
      } catch (err) {
        // Suppress failure of actual agent run in mock / loop mode
      }
    }

    // 2. Memory spike repair
    if (event.metrics.memory > 0.90) {
      event.actions.push("heap_compaction");
      try {
        await this.router.route({
          type: "code",
          payload: {
            systemPrompt: "You are a TS engineer.",
            userPrompt: "Perform heap compaction and memory cleanup routines.",
          },
        });
      } catch (err) {
        // Suppress
      }
    }

    // 3. Network congestion repair
    if (event.metrics.network > 0.80) {
      event.actions.push("flush_buffers");
      try {
        await this.router.route({
          type: "code",
          payload: {
            systemPrompt: "You are a TS engineer.",
            userPrompt: "Flush network buffers and reset congestion windows.",
          },
        });
      } catch (err) {
        // Suppress
      }
    }

    // 4. Governance validation
    const approved = await this.governance.evaluateAction("repair", "system_repair", event);

    if (approved.decision !== "ALLOW") {
      event.status = "failed";
      event.updatedAt = new Date().toISOString();
      event.actions.push("blocked_by_governance");
      this.memory.remember("repair_failed", JSON.stringify(event));
      return event;
    }

    // 5. Mark completed
    event.status = "completed";
    event.updatedAt = new Date().toISOString();
    this.memory.remember("repair_completed", JSON.stringify(event));

    return event;
  }

  getEvents(): RepairEvent[] {
    return [...this.events];
  }
}
