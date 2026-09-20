// microfixd/core/agents/executionEngine.ts

import { governanceEngine } from "../../backend/core/governance/engine";

export interface AgentContext {
  mission: any;
  memory: {
    logEvent: (event: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
  telemetry: {
    push: (channel: string, payload: any) => void;
  };
}

export interface Agent {
  name: string;
  description?: string;
  role?: string;
  execute: (ctx: AgentContext) => Promise<AgentResult>;
}

export interface AgentResult {
  status: "ok" | "error";
  summary: string;
  details?: any;
  updates?: {
    memory?: any;
    telemetry?: any;
    mission?: any;
  };
}

export class AgentExecutionEngine {
  private agents: Record<string, Agent>;

  constructor(agents: Record<string, Agent>) {
    this.agents = agents;
  }

  /**
   * Run a single agent by key (e.g. "optimize", "build").
   */
  async runAgent(
    key: string,
    ctx: AgentContext
  ): Promise<AgentResult> {
    const agent = this.agents[key];
    if (!agent) {
      return {
        status: "error",
        summary: `Agent '${key}' not found.`
      };
    }

    // Evaluate action against governance rules
    const decision = await governanceEngine.evaluateAction(key, agent.name || key);

    if (decision.decision === "BLOCK") {
      ctx.memory.logEvent({
        type: "governance_block",
        agent: agent.name,
        key,
        reason: decision.reason,
        ts: Date.now()
      });

      ctx.telemetry.push("governance_block", {
        agent: agent.name,
        key,
        reason: decision.reason,
        ts: Date.now()
      });

      return {
        status: "error",
        summary: `Blocked by Governance: ${decision.reason}`,
        details: decision
      };
    }

    if (decision.decision === "PENDING_APPROVAL") {
      ctx.memory.logEvent({
        type: "governance_pending",
        agent: agent.name,
        key,
        reason: decision.reason,
        ts: Date.now()
      });

      ctx.telemetry.push("governance_pending", {
        agent: agent.name,
        key,
        reason: decision.reason,
        ts: Date.now()
      });

      return {
        status: "error",
        summary: `Requires Manual Approval: ${decision.reason}`,
        details: decision
      };
    }

    // Log start
    ctx.memory.logEvent({
      type: "agent_start",
      agent: agent.name,
      key,
      ts: Date.now()
    });

    ctx.telemetry.push("agent_start", {
      agent: agent.name,
      key,
      ts: Date.now()
    });

    let result: AgentResult;

    try {
      result = await agent.execute(ctx);
    } catch (err: any) {
      ctx.memory.logEvent({
        type: "agent_error",
        agent: agent.name,
        key,
        ts: Date.now(),
        error: err?.message || String(err)
      });

      ctx.telemetry.push("agent_error", {
        agent: agent.name,
        key,
        ts: Date.now(),
        error: err?.message || String(err)
      });

      return {
        status: "error",
        summary: `Agent '${agent.name}' execution failed.`,
        details: err?.message || String(err)
      };
    }

    // Apply updates if agent returned any
    if (result.updates?.memory) {
      ctx.memory.setState(result.updates.memory);
    }

    if (result.updates?.telemetry) {
      ctx.telemetry.push("agent_update", {
        agent: agent.name,
        key,
        ts: Date.now(),
        payload: result.updates.telemetry
      });
    }

    if (result.updates?.mission) {
      ctx.mission?.update?.(result.updates.mission);
    }

    // Log completion
    ctx.memory.logEvent({
      type: "agent_complete",
      agent: agent.name,
      key,
      ts: Date.now(),
      status: result.status,
      summary: result.summary
    });

    ctx.telemetry.push("agent_complete", {
      agent: agent.name,
      key,
      ts: Date.now(),
      status: result.status
    });

    return result;
  }

  /**
   * Run a sequence of agents in order (for chained workflows).
   */
  async runPipeline(
    keys: string[],
    ctx: AgentContext
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const key of keys) {
      const res = await this.runAgent(key, ctx);
      results.push(res);
      if (res.status === "error") {
        break;
      }
    }

    return results;
  }
}
