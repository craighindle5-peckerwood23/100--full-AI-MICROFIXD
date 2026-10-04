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
  approval_id?: string;
  approval_required?: boolean;
}

export function useSandbox() {
  const [entries,  setEntries]  = useState<ExecEntry[]>([]);
  const [running,  setRunning]  = useState(false);
  const [sessionId] = useState(() => `sb_${Date.now().toString(36)}`);

  const run = useCallback(async (code: string, lang: string, approvalId?: string) => {
    setRunning(true);
    try {
      const r = await Sandbox.run(code, lang, sessionId, approvalId) as ExecEntry;
      const entry: ExecEntry = { ...r, id: (r as any).exec_id, code, ts: new Date().toISOString() };
      setEntries(e => [...e, entry]);

      return entry;
    } finally { setRunning(false); }
  }, [sessionId]);

  const clearLog = useCallback(() => setEntries([]), []);

  return { entries, running, sessionId, run, clearLog };
}
