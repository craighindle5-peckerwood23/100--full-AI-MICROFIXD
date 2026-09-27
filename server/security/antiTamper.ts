/**
 * server/security/antiTamper.ts
 * ANTI-TAMPER ENGINE
 *
 * Detects prompt injection, jailbreak attempts, and payload manipulation.
 * Runs on ALL inbound inputs before they reach any organ.
 *
 * Detection classes:
 *   - Prompt injection (hidden instructions in user text)
 *   - Jailbreak patterns (roleplay bypass, DAN, etc.)
 *   - Payload injection (JS/SQL/shell in inputs)
 *   - Context manipulation (fake system messages)
 *   - Token smuggling (invisible Unicode tricks)
 */

export interface TamperCheckResult {
  clean:        boolean;
  threats:      { type: string; pattern: string; severity: "low" | "medium" | "high" | "critical" }[];
  sanitized:    string;
  blocked:      boolean;
}

const TAMPER_PATTERNS = [
  // Prompt injection
  { type: "prompt_injection",   severity: "critical" as const, pattern: /ignore (previous|above|all) (instructions?|context|prompt)/i },
  { type: "prompt_injection",   severity: "critical" as const, pattern: /new instruction[s]?:/i },
  { type: "prompt_injection",   severity: "critical" as const, pattern: /system:\s*you are now/i },
  { type: "prompt_injection",   severity: "high"     as const, pattern: /\[system\]|\[INST\]|<\|system\|>/i },
  // Jailbreak
  { type: "jailbreak",          severity: "critical" as const, pattern: /do anything now|DAN mode|jailbreak/i },
  { type: "jailbreak",          severity: "critical" as const, pattern: /pretend (you have no|you don.t have) (restrictions|rules|limits)/i },
  { type: "jailbreak",          severity: "high"     as const, pattern: /act as (if you are|a) (human|uncensored|unrestricted)/i },
  { type: "jailbreak",          severity: "high"     as const, pattern: /developer mode|god mode|unrestricted mode/i },
  // Payload injection
  { type: "payload_injection",  severity: "high"     as const, pattern: /<script[\s>]|javascript:/i },
  { type: "payload_injection",  severity: "critical" as const, pattern: /;?\s*(DROP|DELETE|UPDATE|INSERT)\s+/i },
  { type: "payload_injection",  severity: "critical" as const, pattern: /\$\(|`.*`|\|\s*(bash|sh|cmd)/i },
  // Context manipulation
  { type: "context_manip",      severity: "high"     as const, pattern: /---+\s*system\s*---+/i },
  { type: "context_manip",      severity: "high"     as const, pattern: /human:\s*assistant:/i },
  // Token smuggling (invisible chars)
  { type: "token_smuggling",    severity: "medium"   as const, pattern: /[\u200b\u200c\u200d\ufeff\u00ad]/g },
];

export function checkTamper(input: string): TamperCheckResult {
  const threats: TamperCheckResult["threats"] = [];
  let   sanitized = input;

  for (const p of TAMPER_PATTERNS) {
    if (p.pattern.test(input)) {
      const match = input.match(p.pattern)?.[0] ?? "";
      threats.push({ type: p.type, pattern: match.slice(0, 60), severity: p.severity });
      // Sanitize: remove the matched portion
      sanitized = sanitized.replace(p.pattern, "[REDACTED]");
    }
  }

  // Strip invisible Unicode
  sanitized = sanitized.replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "");

  const hasCritical = threats.some(t => t.severity === "critical");
  const hasHigh     = threats.some(t => t.severity === "high");
  const blocked     = hasCritical || hasHigh;

  return { clean: threats.length === 0, threats, sanitized, blocked };
}
