// microfixd/core/memory/memory.ts
import { memory as backendMemory } from "../../backend/core/memory/state";

export class MemoryOrgan {
  remember(key: string, value: string, metadata?: any): void {
    backendMemory.set(key, { value, metadata, timestamp: Date.now() });
    backendMemory.logEvent({
      type: "memory_recorded",
      agent: "MemoryOrgan",
      action: key,
      timestamp: Date.now(),
      data: { value, metadata }
    });
  }

  retrieveContext(): string {
    const events = backendMemory.getEvents(5);
    return events.map(e => `${e.agent || 'System'}: ${e.action || ''}`).join('\n');
  }

  search(query: string): Array<{ id: string; content: string }> {
    const state = backendMemory.getState();
    const results: Array<{ id: string; content: string }> = [];
    for (const [key, val] of Object.entries(state)) {
      if (key.includes(query) || (val && JSON.stringify(val).includes(query))) {
        results.push({
          id: key,
          content: typeof val === 'string' ? val : JSON.stringify(val)
        });
      }
    }
    return results;
  }
}
