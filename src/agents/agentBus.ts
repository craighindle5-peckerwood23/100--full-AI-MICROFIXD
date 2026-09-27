/**
 * src/agents/agentBus.ts
 * Agent Message Bus — connects to SharedWorker for <1ms cross-agent comms.
 * Each agent gets its own connection. Messages are routed by the SharedWorker.
 */

type MessageHandler = (from: string, payload: unknown, ts: number) => void;
type ChannelHandler = (from: string, channel: string, payload: unknown) => void;

export class AgentBus {
  private worker:    SharedWorker | null = null;
  private port:      MessagePort  | null = null;
  private _handlers: MessageHandler[]     = [];
  private _channels: Map<string, ChannelHandler[]> = new Map();
  private _agentId:  string;
  private _ready     = false;

  constructor(agentId: string) {
    this._agentId = agentId;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new SharedWorker("/agentBusWorker.js", { name: "microfixd-agent-bus" });
        this.port   = this.worker.port;

        this.port.onmessage = (e) => {
          const msg = e.data as { type: string; from?: string; payload?: unknown; ts?: number; channel?: string };
          switch (msg.type) {
            case "registered":
              this._ready = true;
              resolve();
              break;
            case "message":
              this._handlers.forEach(h => h(msg.from ?? "unknown", msg.payload, msg.ts ?? Date.now()));
              break;
            case "broadcast":
              this._handlers.forEach(h => h(msg.from ?? "unknown", msg.payload, msg.ts ?? Date.now()));
              break;
            case "channel:message": {
              const chs = this._channels.get(msg.channel ?? "") ?? [];
              chs.forEach(h => h(msg.from ?? "unknown", msg.channel ?? "", msg.payload));
              break;
            }
          }
        };

        this.port.start();
        this.port.postMessage({ type: "register", from: this._agentId });
      } catch (err) {
        reject(new Error(`AgentBus: SharedWorker not supported — ${String(err)}`));
      }
    });
  }

  send(toAgentId: string, payload: unknown): void {
    this.port?.postMessage({ type: "send", from: this._agentId, to: toAgentId, payload });
  }

  broadcast(payload: unknown): void {
    this.port?.postMessage({ type: "broadcast", from: this._agentId, payload });
  }

  joinChannel(channel: string): void {
    this.port?.postMessage({ type: "channel:join", from: this._agentId, channel });
  }

  sendToChannel(channel: string, payload: unknown): void {
    this.port?.postMessage({ type: "channel:send", from: this._agentId, channel, payload });
  }

  onMessage(handler: MessageHandler): () => void {
    this._handlers.push(handler);
    return () => { this._handlers = this._handlers.filter(h => h !== handler); };
  }

  onChannel(channel: string, handler: ChannelHandler): () => void {
    if (!this._channels.has(channel)) this._channels.set(channel, []);
    this._channels.get(channel)!.push(handler);
    return () => {
      this._channels.set(channel, (this._channels.get(channel) ?? []).filter(h => h !== handler));
    };
  }

  async ping(): Promise<number> {
    const t0 = performance.now();
    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === "pong") {
          this.port?.removeEventListener("message", handler);
          resolve(performance.now() - t0);
        }
      };
      this.port?.addEventListener("message", handler);
      this.port?.postMessage({ type: "ping" });
    });
  }

  get agentId(): string { return this._agentId; }
  get ready(): boolean  { return this._ready; }

  disconnect(): void {
    this.port?.close();
    this.worker   = null;
    this.port     = null;
    this._ready   = false;
  }
}
