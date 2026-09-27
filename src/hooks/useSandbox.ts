import { useState, useCallback } from "react";
import { Sandbox, HITL } from "../lib/serverApi";

export interface ExecEntry {
  id:      string;
  code:    string;
  lang:    string;
  stdout:  string;
  stderr:  string;
  success: boolean;
  elapsed_ms: number;
  ts:      string;
}

export function useSandbox() {
  const [entries,  setEntries]  = useState<ExecEntry[]>([]);
  const [running,  setRunning]  = useState(false);
  const [sessionId] = useState(() => `sb_${Date.now().toString(36)}`);

  const run = useCallback(async (code: string, lang: string) => {
    setRunning(true);
    try {
      const r = await Sandbox.run(code, lang, sessionId) as ExecEntry;
      const entry: ExecEntry = { ...r, code, ts: new Date().toISOString() };
      setEntries(e => [...e, entry]);

      // Trigger HITL for any failed execution (rule-SB-003)
      if (!r.success) {
        await HITL.trigger(sessionId, {
          name: `Exec failure — ${lang}`,
          type: "sandbox_error",
          severity: "major",
          stderr: r.stderr,
        }, "sandbox_error");
      }
      return entry;
    } finally { setRunning(false); }
  }, [sessionId]);

  const clearLog = useCallback(() => setEntries([]), []);

  return { entries, running, sessionId, run, clearLog };
}
