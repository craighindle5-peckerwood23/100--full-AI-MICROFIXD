/**
 * server/skin/responseMesh.ts
 * RESPONSE MESH — Unified outbound signal recorder.
 * All responses are logged here with identity stamps.
 */
import type { SkinResponse } from "./skinLayer";

class ResponseMesh {
  private log: SkinResponse[] = [];

  record(response: SkinResponse): void {
    this.log.push(response);
    if (this.log.length > 1000) this.log.shift();
  }

  recent(limit = 50): SkinResponse[] { return this.log.slice(-limit); }
  avgLatency(): number {
    if (!this.log.length) return 0;
    return this.log.reduce((s, r) => s + r.latency_ms, 0) / this.log.length;
  }
}

export const responseMesh = new ResponseMesh();
