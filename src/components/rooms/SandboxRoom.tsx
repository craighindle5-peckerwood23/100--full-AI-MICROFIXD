import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Package, CheckCircle, XCircle, AlertTriangle, Trash2 } from "lucide-react";
import { useSandbox } from "../../hooks/useSandbox";
import { HITL } from "../../lib/serverApi";
import { useServerEvents } from "../../hooks/useServerEvents";
import type { HITLRecord } from "../../lib/serverApi";

export default function SandboxRoom() {
  const { entries, running, sessionId, run, clearLog } = useSandbox();
  const [code,       setCode]      = useState("");
  const [lang,       setLang]      = useState("typescript");
  const [buildName,  setBuildName] = useState("");
  const [hitlQueue,  setHitlQueue] = useState<HITLRecord[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [entries]);

  // Listen for HITL events
  useServerEvents((event) => {
    if (event.type === "hitl:review_required") {
      setHitlQueue(q => [...q, event.payload as HITLRecord]);
    }
    if (event.type === "hitl:decision") {
      const { hitl_id } = event.payload as { hitl_id: string };
      setHitlQueue(q => q.filter(h => h.hitl_id !== hitl_id));
    }
  });

  const handleRun = async () => {
    try {
      await run(code, lang);
      const pending = await HITL.pending();
      setHitlQueue(pending.records.filter(record => record.session_id === sessionId));
    } catch (err) { console.error("Sandbox execution failed", err); }
  };

  const handleBuild = async () => {
    if (!buildName.trim()) return;
    await HITL.trigger(sessionId, {
      name:     buildName,
      type:     "build",
      severity: "major",
      files:    entries.map(e => `exec_${e.id}.${e.lang === "typescript" ? "ts" : e.lang}`),
    }, "build_complete");
    setBuildName("");
  };

  const handleDecide = async (id: string, decision: "approved" | "rejected") => {
    await HITL.decide(id, decision);
    const record = hitlQueue.find(h => h.hitl_id === id);
    setHitlQueue(q => q.filter(h => h.hitl_id !== id));
    if (decision === "approved" && record?.trigger === "sandbox_execution" && record.session_id === sessionId) {
      await run(String(record.artifact.code), String(record.artifact.lang), id);
    }
  };

  return (
    <div className="flex h-full bg-[#0a0f1c]">
      {/* Code editor */}
      <div className="flex-1 flex flex-col border-r border-[#21262d]">
        {/* Lang tabs */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#21262d] bg-[#0d1117]">
          {["typescript", "javascript"].map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                lang === l ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-zinc-500 hover:text-zinc-300"
              }`}>{l}</button>
          ))}
          <div className="flex-1" />
          <button onClick={clearLog} className="text-zinc-600 hover:text-zinc-400">
            <Trash2 size={11} />
          </button>
        </div>

        {/* Editor */}
        <textarea
          value={code} onChange={e => setCode(e.target.value)}
          className="flex-1 bg-transparent text-zinc-200 font-mono text-xs p-3 resize-none outline-none placeholder-zinc-700"
          placeholder={`// Write ${lang} code here\n// All executions are logged (rule-SB-001)\n// No filesystem or network access`}
          spellCheck={false}
        />

        {/* Actions */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[#21262d] bg-[#0d1117]">
          <button onClick={handleRun} disabled={running || !code.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-mono hover:bg-emerald-500/30 disabled:opacity-40">
            <Play size={11} /> {running ? "Running..." : "Run"}
          </button>
          <input value={buildName} onChange={e => setBuildName(e.target.value)}
            placeholder="build name for HITL review..."
            className="flex-1 bg-[#161b22] border border-[#21262d] rounded px-2 py-1 text-xs font-mono text-zinc-300 placeholder-zinc-600 outline-none" />
          <button onClick={handleBuild} disabled={!buildName.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-mono hover:bg-amber-500/30 disabled:opacity-40">
            <Package size={11} /> Build
          </button>
        </div>
      </div>

      {/* Output + HITL */}
      <div className="w-72 flex flex-col bg-[#0d1117]">
        {/* HITL queue */}
        <AnimatePresence>
          {hitlQueue.length > 0 && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
              className="overflow-hidden border-b border-[#21262d]">
              <div className="p-2 space-y-2">
                <p className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={10} /> HITL REVIEW ({hitlQueue.length})
                </p>
                {hitlQueue.map(h => (
                  <div key={h.hitl_id} className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
                    <p className="text-amber-300 font-mono text-[10px] mb-0.5">{h.artifact.name}</p>
                    <p className="text-zinc-600 font-mono text-[9px] mb-1.5">
                      {h.artifact.severity?.toUpperCase()} · {h.trigger}
                    </p>
                    {h.trigger === "sandbox_execution" && <pre className="text-zinc-300 text-[9px] whitespace-pre-wrap max-h-40 overflow-auto">{String(h.artifact.code)}</pre>}
                    <div className="flex gap-1">
                      <button onClick={() => handleDecide(h.hitl_id, "approved")}
                        className="flex-1 flex items-center justify-center gap-1 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-mono">
                        <CheckCircle size={9} /> Approve
                      </button>
                      <button onClick={() => handleDecide(h.hitl_id, "rejected")}
                        className="flex-1 flex items-center justify-center gap-1 py-0.5 bg-red-500/20 text-red-400 rounded text-[9px] font-mono">
                        <XCircle size={9} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Execution log */}
        <div ref={logRef} className="flex-1 overflow-y-auto p-2 space-y-2">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Execution Log</p>
          {entries.length === 0 && <p className="text-zinc-700 font-mono text-[10px]">No executions yet</p>}
          {entries.map(e => (
            <div key={e.id} className={`rounded p-2 font-mono text-[9px] border ${
              e.success ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
            }`}>
              <div className="flex items-center gap-1 mb-1">
                {e.success ? <CheckCircle size={9} className="text-emerald-400" /> : <XCircle size={9} className="text-red-400" />}
                <span className="text-zinc-400">{e.lang}</span>
                <span className="text-zinc-600 ml-auto">{e.elapsed_ms}ms</span>
              </div>
              {e.stdout && <pre className="text-emerald-300 whitespace-pre-wrap">{e.stdout.slice(0, 300)}</pre>}
              {e.stderr && <pre className="text-red-300 whitespace-pre-wrap">{e.stderr.slice(0, 200)}</pre>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
