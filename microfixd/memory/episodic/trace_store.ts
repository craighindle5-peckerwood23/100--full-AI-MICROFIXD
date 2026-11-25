/**
 * microfixd/memory/episodic/trace_store.ts
 * Episodic trace store for agent execution runs
 */

export interface EpisodicTrace {
  id: string;
  timestamp: string;
  missionId: string;
  steps: { action: string; input: any; output: any; latencyMs: number }[];
  finalOutcome: "SUCCESS" | "FAILURE" | "INTERRUPTED";
}

class EpisodicTraceStore {
  private traces: EpisodicTrace[] = [];

  record(trace: Omit<EpisodicTrace, "id" | "timestamp">): EpisodicTrace {
    const item: EpisodicTrace = {
      id: `trace_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...trace,
    };
    this.traces.unshift(item);
    if (this.traces.length > 100) this.traces.pop();
    return item;
  }

  getRecent(limit = 10): EpisodicTrace[] {
    return this.traces.slice(0, limit);
  }
}

export const episodicTraceStore = new EpisodicTraceStore();
