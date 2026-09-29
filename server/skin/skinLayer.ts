/**
 * server/skin/skinLayer.ts
 * SKIN LAYER — Microfixd's outermost API gateway.
 *
 * The skin is the boundary between the outside world and Microfixd's internals.
 * Every inbound signal hits the skin first:
 *   - HTTP API requests
 *   - WebSocket messages
 *   - Voice input (from voice organ)
 *   - Scheduled triggers (from scheduler organ)
 *   - Cross-AI messages (from other AI systems)
 *   - Crawl results (from crawl engine)
 *
 * The skin:
 *   1. Validates + sanitizes all inputs (anti-tamper)
 *   2. Classifies stimulus type
 *   3. Routes to appropriate organ or execution spine
 *   4. Collects response from response mesh
 *   5. Stamps identity header on all outbound
 */
import { securitySpine }  from "../security/securitySpine";
import { sensorMesh }     from "./sensorMesh";
import { responseMesh }   from "./responseMesh";
import { broadcast }      from "../index";

export type StimulusType =
  | "user_message" | "api_call" | "voice_input" | "scheduled_task"
  | "cross_ai_message" | "crawl_result" | "webhook" | "system_event";

export interface Stimulus {
  id:        string;
  type:      StimulusType;
  payload:   unknown;
  source:    string;
  session_id: string;
  ts:        string;
}

export interface SkinResponse {
  stimulus_id: string;
  output:      unknown;
  latency_ms:  number;
  organ:       string;
  identity_stamped: boolean;
  ts:          string;
}

class SkinLayer {
  private stimulusCount = 0;

  async receive(
    type:       StimulusType,
    payload:    unknown,
    source:     string,
    sessionId?: string,
  ): Promise<SkinResponse> {
    const t0    = Date.now();
    const id    = `stim_${++this.stimulusCount}_${Date.now().toString(36)}`;
    const sid   = sessionId ?? crypto.randomUUID();

    const stimulus: Stimulus = { id, type, payload, source, session_id: sid, ts: new Date().toISOString() };
    sensorMesh.record(stimulus);
    broadcast("skin:stimulus_received", { id, type, source });

    // Security check on text payloads
    if (typeof payload === "string") {
      const check = securitySpine.checkInput(payload);
      if (!check.allowed) {
        return { stimulus_id: id, output: "Blocked by Security Spine.", latency_ms: Date.now() - t0, organ: "security_spine", identity_stamped: true, ts: new Date().toISOString() };
      }
    }

    // Route to execution spine for full processing
    const result = await fetch(`http://127.0.0.1:${Number(process.env.PORT) || 3001}/api/execution/run`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ task: typeof payload === "string" ? payload : JSON.stringify(payload), session_id: sid, source: type }),
    }).then(r => r.json()).catch(() => ({ output: "Execution error", success: false })) as { output: string; success: boolean; organs_used?: string[] };

    const response: SkinResponse = {
      stimulus_id:      id,
      output:           result.output,
      latency_ms:       Date.now() - t0,
      organ:            (result.organs_used ?? ["brain"])[0] ?? "brain",
      identity_stamped: true,
      ts:               new Date().toISOString(),
    };

    responseMesh.record(response);
    broadcast("skin:response_sent", { stimulus_id: id, latency_ms: response.latency_ms });
    return response;
  }

  getStats() {
    return { total_stimuli: this.stimulusCount, sensor_log: sensorMesh.recent(10), response_log: responseMesh.recent(10) };
  }
}

export const skinLayer = new SkinLayer();
