// microfixd/core/federation/federationLayer.ts
import { AgentRouterOrgan } from "../agents/agentRouter";
import { MemoryOrgan } from "../memory/memory";
import { TelemetryGrid } from "../../backend/core/telemetry/grid";
import { GovernanceEngine } from "../../backend/core/governance/engine";
import { UnifiedWiringOrgan } from "../wiring/unifiedWiring";

export interface FederationNode {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline" | "degraded";
  lastHeartbeat: number;
  metrics: any;
}

export interface FederationEvent {
  id: string;
  nodeId: string;
  action: string;
  payload: any;
  createdAt: string;
}

export class FederationLayer {
  private nodes: FederationNode[] = [];
  private events: FederationEvent[] = [];
  private running = false;
  private wiring?: UnifiedWiringOrgan;

  constructor(
    private router: AgentRouterOrgan,
    private memory: MemoryOrgan,
    private telemetry: TelemetryGrid,
    private governance: GovernanceEngine,
    private intervalMs: number = 2000
  ) {}

  setWiring(wiring: UnifiedWiringOrgan) {
    this.wiring = wiring;
  }

  registerNode(name: string, url: string): FederationNode {
    const node: FederationNode = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      url,
      status: "online",
      lastHeartbeat: Date.now(),
      metrics: {},
    };

    this.nodes.push(node);
    this.memory.remember("federation_node_registered", JSON.stringify(node), { name });
    this.wiring?.broadcast("federation", node);

    return node;
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
      for (const node of this.nodes) {
        await this.checkNode(node);
      }
      await this.sleep(this.intervalMs);
    }
  }

  private async checkNode(node: FederationNode) {
    try {
      const approved = await this.governance.evaluateAction("federation", "federation_heartbeat", node);

      if (approved.decision !== "ALLOW") {
        node.status = "degraded";
        this.memory.remember("federation_node_blocked", JSON.stringify(node));
        return;
      }

      // Simulated heartbeat
      node.lastHeartbeat = Date.now();
      node.metrics = { load: Math.random() * 100 };
      node.status = "online";

      this.memory.remember("federation_node_heartbeat", JSON.stringify(node));
      this.wiring?.broadcast("federation", node);
    } catch {
      node.status = "offline";
      this.memory.remember("federation_node_offline", JSON.stringify(node));
    }
  }

  async dispatchToNode(nodeId: string, action: any) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || node.status !== "online") return;

    const approved = await this.governance.evaluateAction("federation", "federation_dispatch", action);

    if (approved.decision !== "ALLOW") {
      this.memory.remember("federation_dispatch_blocked", JSON.stringify({ node, action }));
      return;
    }

    const event: FederationEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      nodeId,
      action: action.type,
      payload: action,
      createdAt: new Date().toISOString(),
    };

    this.events.push(event);
    this.memory.remember("federation_event", JSON.stringify(event));
    
    // Simulate remote execution
    this.wiring?.broadcast("federation", { type: "dispatch", event });
  }

  getNodes(): FederationNode[] {
    return [...this.nodes];
  }

  getEvents(): FederationEvent[] {
    return [...this.events];
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
