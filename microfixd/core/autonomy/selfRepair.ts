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
    const metrics = event.metrics ?? {};
    const actions: Array<{ label: string; prompt: string }> = [];
    if (Number(metrics.cpu) > 0.85) actions.push({label: "rebalance_threads", prompt: "Diagnose CPU saturation and propose a concrete, verifiable thread-pool correction."});
    if (Number(metrics.memory) > 0.90) actions.push({label: "heap_compaction", prompt: "Diagnose high memory consumption and propose a concrete, verifiable cleanup."});
    if (Number(metrics.network) > 0.80) actions.push({label: "flush_buffers", prompt: "Diagnose network congestion and propose a concrete, verifiable recovery."});

    const failed = async (reason: string) => {
      event.status = "failed";
      event.updatedAt = new Date().toISOString();
      event.actions.push(reason);
      await this.memory.remember("repair_failed", JSON.stringify(event));
      return event;
    };

    if (actions.length === 0) return failed("no_matching_repair_strategy");

    // Approval must precede any agent activity; a plan is not permission to mutate.
    let decision;
    try {
      decision = await this.governance.evaluateAction("repair", "system_repair", {
        ...event,
        proposedActions: actions.map(action => action.label),
      });
    } catch {
      return failed("governance_unavailable");
    }
    if (decision.decision !== "ALLOW") {
      return failed(decision.decision === "PENDING_APPROVAL" ? "awaiting_governance_approval" : "blocked_by_governance");
    }

    event.status = "executing";
    event.updatedAt = new Date().toISOString();
    await this.memory.remember("repair_executing", JSON.stringify(event));

    for (const action of actions) {
      try {
        const result = await this.router.route({
          type: "code",
          payload: {systemPrompt: "You are a TypeScript diagnostics engineer. Do not claim a repair without measured verification.", userPrompt: action.prompt},
        });
        // An advisory/code-generation result is NOT an applied, verified repair.
        event.actions.push(action.label + (result ? ":proposal_returned" : ":empty_response"));
      } catch (error) {
        return failed(action.label + ":agent_failure:" + (error instanceof Error ? error.message : String(error)));
      }
    }

    // No actuator plus post-condition verification exists in this legacy organ.
    // Fail closed rather than inaccurately announcing the system is repaired.
    return failed("repair_not_applied_or_verified");
  }

  getEvents(): RepairEvent[] {
    return [...this.events];
  }
}
