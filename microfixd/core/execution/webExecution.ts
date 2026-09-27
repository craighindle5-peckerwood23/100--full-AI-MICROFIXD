// microfixd/core/execution/webExecution.ts
import { UnifiedWiringOrgan } from "../wiring/unifiedWiring";
import { MemoryOrgan } from "../memory/memory";

export interface WebEvent {
  id: string;
  type: "navigate" | "click" | "input" | "screenshot";
  url?: string;
  payload?: any;
  timestamp: string;
}

export class WebExecutionOrgan {
  private events: WebEvent[] = [];
  private currentUrl = "about:blank";
  private lastScreenshot: string | null = null;

  constructor(
    private wiring: UnifiedWiringOrgan,
    private memory: MemoryOrgan
  ) {}

  async start() {
    this.wiring.on("web", (payload) => this.handleExternalCommand(payload));
  }

  private handleExternalCommand(payload: any) {
    if (payload.type === "navigate") {
      this.navigate(payload.url);
    }
  }

  async navigate(url: string) {
    this.currentUrl = url;
    const event: WebEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type: "navigate",
      url,
      timestamp: new Date().toISOString()
    };
    this.logEvent(event);
  }

  private logEvent(event: WebEvent) {
    this.events.push(event);
    this.memory.remember("web_execution", JSON.stringify(event));
    this.wiring.broadcast("web", event);
  }

  getEvents() {
    return [...this.events];
  }

  getLastNavigation() {
    return this.currentUrl;
  }

  getLastScreenshot() {
    return this.lastScreenshot;
  }

  takeScreenshot() {
    // Virtual screenshot
    this.lastScreenshot = `data:image/png;base64,VIRTUAL_SCREENSHOT_${Date.now()}`;
    this.logEvent({
      id: Math.random().toString(36).substr(2, 9),
      type: "screenshot",
      timestamp: new Date().toISOString(),
      payload: this.lastScreenshot
    });
  }
}
