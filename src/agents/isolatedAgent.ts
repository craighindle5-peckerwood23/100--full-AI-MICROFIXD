/**
 * src/agents/isolatedAgent.ts
 * Isolated Agent — runs tasks in isolation, communicates via AgentBus.
 * Each agent has: its own bus connection, state, task queue, heartbeat.
 * Can cross-communicate with other agents at <1ms latency via bus.
 */
import { AgentBus }      from "./agentBus";
import { agentRegistry } from "./agentRegistry";
import { OrganApi }      from "../lib/organApi";

export interface AgentTask {
  taskId:    string;
  task:      string;
  priority:  number; // 0 = highest
  context?:  Record<string, unknown>;
  onResult?: (result: unknown) => void;
}

export class IsolatedAgent {
  readonly id:   string;
  readonly role: string;
  private bus:   AgentBus;
  private queue: AgentTask[] = [];
  private _running    = false;
  private _heartbeat: NodeJS.Timeout | null = null;

  constructor(id: string, role: string) {
    this.id   = id;
    this.role = role;
    this.bus  = new AgentBus(id);
  }

  async init(): Promise<void> {
    await this.bus.connect();
    agentRegistry.register(this.id, this.role, this.bus);

    // Listen for cross-agent messages
    this.bus.onMessage((from, payload) => {
      this.handleCrossAgentMessage(from, payload);
    });

    // Join role channel
    this.bus.joinChannel(this.role);
    this.bus.joinChannel("all");

    // Start heartbeat (every 5s)
    this._heartbeat = setInterval(() => {
      agentRegistry.heartbeat(this.id);
      this.bus.broadcast({ type: "heartbeat", from: this.id, ts: Date.now() });
    }, 5000);

    console.log(`[isolated_agent] ${this.id} (${this.role}) initialized`);
  }

  enqueue(task: AgentTask): void {
    this.queue.push(task);
    this.queue.sort((a, b) => a.priority - b.priority);
    if (!this._running) this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) { this._running = false; return; }
    this._running = true;
    const task    = this.queue.shift()!;
    const t0      = Date.now();

    agentRegistry.setState(this.id, "running", task.task);

    // Announce to mesh
    this.bus.broadcast({ type: "agent:task_start", from: this.id, role: this.role, task: task.task });

    try {
      // Route to Groq command center
      const result = await OrganApi.command(task.task, task.taskId, "api") as { output: string; success: boolean };
      agentRegistry.recordTaskComplete(this.id, Date.now() - t0, result.success);
      task.onResult?.(result);

      // Broadcast completion
      this.bus.broadcast({ type: "agent:task_complete", from: this.id, role: this.role, taskId: task.taskId, success: result.success });

    } catch (err) {
      agentRegistry.setState(this.id, "error");
      agentRegistry.recordTaskComplete(this.id, Date.now() - t0, false);
      this.bus.broadcast({ type: "agent:task_error", from: this.id, role: this.role, taskId: task.taskId, error: String(err) });
    }

    this.processNext();
  }

  private handleCrossAgentMessage(from: string, payload: unknown): void {
    const msg = payload as { type: string; task?: string; taskId?: string };
    if (msg.type === "delegate_task" && msg.task) {
      this.enqueue({
        taskId:   msg.taskId ?? crypto.randomUUID(),
        task:     msg.task,
        priority: 1,
      });
    }
  }

  /** Send task to another agent by ID */
  delegate(toAgentId: string, task: string): void {
    this.bus.send(toAgentId, { type: "delegate_task", task, taskId: crypto.randomUUID(), from: this.id });
  }

  /** Broadcast to all agents in a role channel */
  broadcastToRole(role: string, payload: unknown): void {
    this.bus.sendToChannel(role, payload);
  }

  async ping(targetId: string): Promise<number> {
    return this.bus.ping();
  }

  destroy(): void {
    if (this._heartbeat) clearInterval(this._heartbeat);
    this.bus.disconnect();
    agentRegistry.setState(this.id, "isolated");
  }
}
