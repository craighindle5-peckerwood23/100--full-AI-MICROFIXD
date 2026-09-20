// microfixd/backend/core/memory/state.ts

export interface MemoryEvent {
  type: string;
  agent?: string;
  action?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export class MemoryState {
  private events: MemoryEvent[] = [];
  private stateStore: Map<string, unknown> = new Map();

  public logEvent(event: MemoryEvent): void {
    this.events.push(event);
    if (this.events.length > 500) {
      this.events.shift();
    }
  }

  public getEvents(limit: number = 50): MemoryEvent[] {
    return this.events.slice(-limit);
  }

  public getState(): Record<string, unknown> {
    return Object.fromEntries(this.stateStore.entries());
  }

  public setState(state: Record<string, unknown>): void {
    if (state && typeof state === "object") {
      Object.entries(state).forEach(([k, v]) => {
        this.stateStore.set(k, v);
      });
    }
  }

  public set(key: string, value: unknown): void {
    this.stateStore.set(key, value);
  }

  public get<T = unknown>(key: string): T | undefined {
    return this.stateStore.get(key) as T | undefined;
  }

  public clear(): void {
    this.events = [];
    this.stateStore.clear();
  }
}

export const memory = new MemoryState();
