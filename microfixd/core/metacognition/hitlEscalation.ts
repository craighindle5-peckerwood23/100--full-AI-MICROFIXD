// @ts-nocheck
/**
 * microfixd/core/metacognition/hitlEscalation.ts
 * HITL Escalation Manager — front-end side.
 * Monitors WebSocket for HITL events, queues them, and
 * blocks pipeline continuation until human decides.
 *
 * Two trigger classes:
 *   1. CRITICAL ERRORS — organ failures, doctrine breaches, security violations
 *   2. SELF-MODIFICATION — any proposed change to organs, constitution, or identity
 */
import type { HITLRecord } from "../../../src/lib/serverApi";

type DecisionCallback = (decision: "approved" | "rejected", notes?: string) => void;

interface PendingGate {
  record:   HITLRecord;
  resolve:  DecisionCallback;
  timedOut: boolean;
}

const _gates = new Map<string, PendingGate>();
const _listeners: ((record: HITLRecord) => void)[] = [];

export const HITL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min auto-reject

/**
 * Called by pipeline: await hitlGate(record) — blocks until human decides.
 * Rejects automatically after HITL_TIMEOUT_MS (safety default).
 */
export function hitlGate(record: HITLRecord): Promise<"approved" | "rejected"> {
  return new Promise((resolve) => {
    const gate: PendingGate = {
      record,
      resolve: (decision) => resolve(decision),
      timedOut: false,
    };
    _gates.set(record.hitl_id, gate);
    _listeners.forEach(l => l(record));
    console.warn(`[hitl_escalation] GATE OPEN: ${record.hitl_id} — ${record.artifact.name}`);

    // Auto-reject on timeout
    setTimeout(() => {
      if (_gates.has(record.hitl_id)) {
        gate.timedOut = true;
        console.warn(`[hitl_escalation] TIMEOUT: auto-rejecting ${record.hitl_id}`);
        resolveGate(record.hitl_id, "rejected", "Auto-rejected: timeout exceeded");
      }
    }, HITL_TIMEOUT_MS);
  });
}

/** Called by UI when human makes a decision */
export function resolveGate(
  hitlId:   string,
  decision: "approved" | "rejected",
  notes?:   string,
): boolean {
  const gate = _gates.get(hitlId);
  if (!gate) return false;
  gate.resolve(decision, notes);
  _gates.delete(hitlId);
  console.log(`[hitl_escalation] GATE CLOSED: ${hitlId} → ${decision}`);
  return true;
}

/** Subscribe to new gate events (used by React overlay) */
export function onHITLGate(listener: (record: HITLRecord) => void): () => void {
  _listeners.push(listener);
  return () => {
    const i = _listeners.indexOf(listener);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

export function getPendingGates(): HITLRecord[] {
  return Array.from(_gates.values()).map(g => g.record);
}

export function hasCriticalGate(): boolean {
  return Array.from(_gates.values()).some(
    g => g.record.artifact.severity === "critical" || g.record.trigger === "self_modification"
  );
}

/**
 * Trigger HITL gate from backend event.
 * Wires WebSocket → hitlGate().
 */
export function wireWebSocketHITL(ws: WebSocket): void {
  ws.addEventListener("message", (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "hitl:review_required") {
        const record = msg.payload as HITLRecord;
        _listeners.forEach(l => l(record));
      }
      if (msg.type === "hitl:decision") {
        const { hitl_id, decision } = msg.payload as { hitl_id: string; decision: "approved" | "rejected" };
        resolveGate(hitl_id, decision);
      }
    } catch {}
  });
}
