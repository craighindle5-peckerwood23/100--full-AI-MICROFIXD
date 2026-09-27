// microfixd/core/wiring/unifiedWiring.ts
import { MemoryOrgan } from "../memory/memory";
import { GovernanceEngine } from "../../backend/core/governance/engine";

export interface WiringEvent {
  id: string;
  channel: string;
  payload: any;
  createdAt: string;
}

export type WiringChannel =
  | "telemetry"
  | "emotion"
  | "cognition"
  | "mission"
  | "agent"
  | "repair"
  | "deploy"
  | "federation"
  | "governance"
  | "memory"
  | "reflex"
  | "web"
  | "system"
  | "voice";

export class UnifiedWiringOrgan {
  private listeners: Map<WiringChannel, ((payload: any) => void)[]> = new Map();
  private events: WiringEvent[] = [];

  constructor(
    private memory: MemoryOrgan,
    private governance: GovernanceEngine
  ) {}

  private isBroadcasting: Set<WiringChannel> = new Set();

  on(channel: WiringChannel, handler: (payload: any) => void) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    this.listeners.get(channel)!.push(handler);

    return () => {
      const handlers = this.listeners.get(channel);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  async broadcast(channel: WiringChannel, payload: any) {
    // Loop protection to prevent maximum call stack error
    if (this.isBroadcasting.has(channel)) return;
    this.isBroadcasting.add(channel);

    try {
      const event: WiringEvent = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        channel,
        payload,
        createdAt: new Date().toISOString(),
      };

      this.events.push(event);
      this.memory.remember("wiring_event", JSON.stringify(event), { channel });

      // Governance interception
      const approved = await this.governance.evaluateAction("wiring", "wiring_event", event);

      if (approved.decision !== "ALLOW") {
        this.memory.remember("wiring_blocked", JSON.stringify(event));
        return;
      }

      // Deliver to listeners
      const handlers = this.listeners.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(payload);
          } catch (err) {
            this.memory.remember("wiring_handler_error", JSON.stringify({ event, err: String(err) }));
          }
        }
      }
    } finally {
      this.isBroadcasting.delete(channel);
    }
  }

  getEvents(): WiringEvent[] {
    return [...this.events];
  }
}
