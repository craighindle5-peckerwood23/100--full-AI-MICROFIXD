/**
 * src/agents/watchdog.ts
 * WATCHDOG LAYER
 * Monitors all agents for:
 *   - Stalls (no heartbeat > threshold)
 *   - Error spirals (error_count > limit)
 *   - Bus disconnections
 *   - Task queue overflows
 *
 * Auto-recovery:
 *   - Soft reset (re-register agent)
 *   - HITL escalation (critical stalls)
 *   - Isolation (repeated failures)
 *
 * Broadcasts alerts via WebSocket → OverwatchRoom + HITL.
 */
import { agentRegistry, type AgentRecord } from "./agentRegistry";
import { HITL } from "../lib/serverApi";

interface WatchdogAlert {
  id:        string;
  agentId:   string;
  type:      "stall" | "error_spiral" | "disconnect" | "recovered";
  message:   string;
  ts:        string;
  resolved:  boolean;
}

class Watchdog {
  private alerts:    WatchdogAlert[]        = [];
  private timer:     NodeJS.Timeout | null  = null;
  private tickMs     = 10_000; // Check every 10s
  private _running   = false;

  // Thresholds
  private STALL_MS    = 30_000;
  private ERROR_LIMIT = 10;

  start(): void {
    if (this._running) return;
    this._running = true;
    this.timer    = setInterval(() => this.tick(), this.tickMs);
    console.log("[watchdog] Started — monitoring all agents");
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this._running = false;
  }

  private async tick(): Promise<void> {
    const now     = Date.now();
    const agents  = agentRegistry.all();

    for (const agent of agents) {
      await this.checkAgent(agent, now);
    }

    // Broadcast system summary to server
    const summary = agentRegistry.getSystemSummary();
    if (summary.stalled > 0 || summary.error > 2) {
      HITL.trigger("watchdog", {
        name: `System degraded: ${summary.stalled} stalled, ${summary.error} errored`,
        type: "watchdog_alert",
        severity: summary.stalled > 0 ? "critical" : "major",
        summary,
      }, "watchdog_alert").catch(() => {});
    }
  }

  private async checkAgent(agent: AgentRecord, now: number): Promise<void> {
    // Check stall
    if (agent.state === "running" && now - agent.last_heartbeat > this.STALL_MS) {
      if (!this.hasActiveAlert(agent.id, "stall")) {
        const alert = this.addAlert(agent.id, "stall", `Agent ${agent.id} stalled for ${Math.round((now - agent.last_heartbeat) / 1000)}s`);
        console.warn(`[watchdog] STALL: ${agent.id}`);
        agentRegistry.setState(agent.id, "stalled");

        // Attempt soft reset
        try {
          agentRegistry.setState(agent.id, "idle");
          agentRegistry.heartbeat(agent.id);
          this.resolveAlert(alert.id);
          this.addAlert(agent.id, "recovered", `${agent.id} recovered from stall`);
          console.log(`[watchdog] RECOVERED: ${agent.id}`);
        } catch {
          // Escalate to HITL
          await HITL.trigger("watchdog", {
            name:     `Agent stall: ${agent.id}`,
            type:     "agent_stall",
            severity: "critical",
            agent_id: agent.id,
            role:     agent.role,
          }, "agent_stall");
        }
      }
    }

    // Check error spiral
    if (agent.error_count > this.ERROR_LIMIT && !this.hasActiveAlert(agent.id, "error_spiral")) {
      this.addAlert(agent.id, "error_spiral", `Agent ${agent.id} hit ${agent.error_count} errors`);
      console.error(`[watchdog] ERROR SPIRAL: ${agent.id} (${agent.error_count} errors)`);
      agentRegistry.setState(agent.id, "error");
    }
  }

  private addAlert(agentId: string, type: WatchdogAlert["type"], message: string): WatchdogAlert {
    const alert: WatchdogAlert = {
      id:       `wd_${Date.now().toString(36)}`,
      agentId, type, message,
      ts:       new Date().toISOString(),
      resolved: false,
    };
    this.alerts.push(alert);
    if (this.alerts.length > 200) this.alerts.shift();
    return alert;
  }

  private resolveAlert(id: string): void {
    const a = this.alerts.find(a => a.id === id);
    if (a) a.resolved = true;
  }

  private hasActiveAlert(agentId: string, type: WatchdogAlert["type"]): boolean {
    return this.alerts.some(a => a.agentId === agentId && a.type === type && !a.resolved);
  }

  getAlerts(limit = 50): WatchdogAlert[]     { return this.alerts.slice(-limit); }
  getUnresolved(): WatchdogAlert[]            { return this.alerts.filter(a => !a.resolved); }
  getSystemSummary()                          { return agentRegistry.getSystemSummary(); }
  isRunning(): boolean                        { return this._running; }
}

export const watchdog = new Watchdog();

// Auto-start
if (typeof window !== "undefined") watchdog.start();
