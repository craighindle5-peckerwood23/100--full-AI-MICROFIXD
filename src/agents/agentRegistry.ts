/**
 * src/agents/agentRegistry.ts
 * Central registry of all active agents.
 * Tracks: agent state, heartbeats, task assignments, metrics.
 */
import { AgentBus } from "./agentBus";

export type AgentState = "idle" | "running" | "waiting" | "error" | "stalled" | "isolated";

export interface AgentRecord {
  id:            string;
  role:          string;
  state:         AgentState;
  current_task?: string;
  last_heartbeat: number;
  error_count:   number;
  task_count:    number;
  avg_latency_ms: number;
  stall_count:   number;
  bus?:          AgentBus;
}

type StateChangeHandler = (id: string, state: AgentState) => void;

class AgentRegistry {
  private agents:   Map<string, AgentRecord>  = new Map();
  private handlers: StateChangeHandler[]       = [];

  register(id: string, role: string, bus?: AgentBus): AgentRecord {
    const record: AgentRecord = {
      id, role,
      state:          "idle",
      last_heartbeat: Date.now(),
      error_count:    0,
      task_count:     0,
      avg_latency_ms: 0,
      stall_count:    0,
      bus,
    };
    this.agents.set(id, record);
    console.log(`[agent_registry] Registered: ${id} (${role})`);
    return record;
  }

  get(id: string): AgentRecord | undefined { return this.agents.get(id); }
  all(): AgentRecord[]                     { return Array.from(this.agents.values()); }

  setState(id: string, state: AgentState, task?: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    agent.state        = state;
    agent.current_task = task;
    this.handlers.forEach(h => h(id, state));
  }

  heartbeat(id: string): void {
    const agent = this.agents.get(id);
    if (agent) agent.last_heartbeat = Date.now();
  }

  recordTaskComplete(id: string, latency_ms: number, success: boolean): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    agent.task_count++;
    if (!success) agent.error_count++;
    agent.avg_latency_ms = (agent.avg_latency_ms * (agent.task_count - 1) + latency_ms) / agent.task_count;
    agent.state          = "idle";
    agent.current_task   = undefined;
  }

  onStateChange(handler: StateChangeHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  getStalledAgents(thresholdMs = 30_000): AgentRecord[] {
    const now = Date.now();
    return this.all().filter(a =>
      a.state === "running" && now - a.last_heartbeat > thresholdMs
    );
  }

  getSystemSummary(): { total: number; idle: number; running: number; error: number; stalled: number } {
    const all = this.all();
    return {
      total:   all.length,
      idle:    all.filter(a => a.state === "idle").length,
      running: all.filter(a => a.state === "running").length,
      error:   all.filter(a => a.state === "error").length,
      stalled: all.filter(a => a.state === "stalled").length,
    };
  }
}

export const agentRegistry = new AgentRegistry();
