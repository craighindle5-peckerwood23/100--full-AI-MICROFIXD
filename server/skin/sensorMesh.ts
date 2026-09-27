/**
 * server/skin/sensorMesh.ts
 * SENSOR MESH — Unified inbound signal recorder.
 * All stimulus types are recorded here for analytics + replay.
 */
import type { Stimulus } from "./skinLayer";

class SensorMesh {
  private log: Stimulus[] = [];

  record(stimulus: Stimulus): void {
    this.log.push(stimulus);
    if (this.log.length > 1000) this.log.shift();
  }

  recent(limit = 50): Stimulus[] { return this.log.slice(-limit); }
  byType(type: string): Stimulus[] { return this.log.filter(s => s.type === type); }
  stats() {
    const byType: Record<string, number> = {};
    for (const s of this.log) byType[s.type] = (byType[s.type] ?? 0) + 1;
    return { total: this.log.length, by_type: byType };
  }
}

export const sensorMesh = new SensorMesh();
