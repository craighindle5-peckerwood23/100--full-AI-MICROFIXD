/**
 * Reflex Organ — fast pattern matching without LLM (< 5ms)
 * Actions: match, classify_fast, check_safety, parse_intent
 */
const REFLEXES: { pattern: RegExp; tag: string; response?: string }[] = [
  { pattern: /^(hi|hello|hey)\b/i,            tag: "greeting",      response: "Hello. What do you need?" },
  { pattern: /status|health|how are you/i,     tag: "status_query" },
  { pattern: /stop|cancel|abort/i,             tag: "abort" },
  { pattern: /help|what can you do/i,          tag: "help" },
  { pattern: /rm -rf|drop table|format c:/i,   tag: "dangerous",     response: "Blocked: dangerous command detected." },
  { pattern: /ignore (your|the) (rules|const)/i, tag: "bypass_attempt", response: "Blocked: constitutional bypass attempt." },
];

export async function executeReflexOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  const input = String(p.text ?? p.task ?? "");
  switch (action) {
    case "match": {
      const matches = REFLEXES.filter(r => r.pattern.test(input));
      return { matches: matches.map(m => ({ tag: m.tag, response: m.response })), fast: true };
    }
    case "check_safety": {
      const dangerous = REFLEXES.filter(r => ["dangerous","bypass_attempt"].includes(r.tag) && r.pattern.test(input));
      return { safe: dangerous.length === 0, blocked: dangerous.map(r => r.tag) };
    }
    case "parse_intent": {
      const match = REFLEXES.find(r => r.pattern.test(input));
      return { intent: match?.tag ?? "unknown", confidence: match ? 0.9 : 0.3 };
    }
    default:
      throw new Error(`Reflex organ: unknown action '${action}'`);
  }
}
