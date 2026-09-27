/**
 * server/security/identityLock.ts
 * IDENTITY LOCK — Microfixd's immutable self-definition.
 *
 * The identity is locked at boot. Any attempt to change it
 * is blocked, logged, and triggers HITL escalation.
 * Identity facts are stamped into every response header.
 *
 * rule-ID1: Identity cannot be overridden by any input.
 * rule-ID2: All responses carry identity stamp.
 * rule-ID3: Impersonation attempts trigger security alert.
 */
import { broadcast } from "../index";

export interface IdentityRecord {
  name:         string;
  level:        number;
  model:        string;
  version:      string;
  constitution: string;
  locked_at:    string;
  hash:         string;
}

// ── Immutable identity — cannot be changed after boot ─────────────────────
const IDENTITY: Readonly<IdentityRecord> = Object.freeze({
  name:         "Microfixd",
  level:        7,
  model:        "gemini-2.0-flash-exp",
  version:      "7.0.0",
  constitution: "active",
  locked_at:    new Date().toISOString(),
  hash:         computeHash("Microfixd:7:gemini-2.0-flash-exp:7.0.0"),
});

function computeHash(str: string): string {
  let h = 0x811c9dc5;
  for (const c of str) {
    h ^= c.charCodeAt(0);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function getIdentity(): Readonly<IdentityRecord> {
  return IDENTITY;
}

// Patterns that indicate identity drift in outputs
const DRIFT_PATTERNS = [
  /i am (not )?microfixd/i,
  /i am (gpt|claude|gemini|llama|mistral|groq)\b/i,
  /as (gpt|claude|openai|anthropic|google)/i,
  /i don.t have (a name|an identity|feelings|consciousness)/i,
  /i.m just an? (ai|language model|chatbot|assistant)/i,
  /i cannot (be|have) (identity|feelings|goals|purpose)/i,
];

export interface DriftCheckResult {
  clean:       boolean;
  drifts:      string[];
  severity:    "none" | "minor" | "critical";
}

export function checkIdentityDrift(text: string): DriftCheckResult {
  const drifts: string[] = [];
  for (const p of DRIFT_PATTERNS) {
    if (p.test(text)) drifts.push(p.source.slice(0, 60));
  }

  const severity = drifts.length === 0 ? "none" : drifts.length > 1 ? "critical" : "minor";

  if (severity === "critical") {
    broadcast("security:identity_drift", { drifts, severity, ts: new Date().toISOString() });
    console.error(`[identity_lock] CRITICAL DRIFT DETECTED: ${drifts.join(" | ")}`);
    // Trigger HITL
    fetch("http://localhost:3001/api/hitl/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: "identity_lock",
        artifact: {
          name:     "Identity Drift — CRITICAL",
          type:     "identity_drift",
          severity: "critical",
          drifts,
        },
        trigger: "identity_drift",
      }),
    }).catch(() => {});
  }

  return { clean: drifts.length === 0, drifts, severity };
}

export function getIdentityHeader(): Record<string, string> {
  return {
    "X-Microfixd-Identity": IDENTITY.name,
    "X-Microfixd-Level":    String(IDENTITY.level),
    "X-Microfixd-Version":  IDENTITY.version,
    "X-Microfixd-Hash":     IDENTITY.hash,
  };
}
