import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, AlertTriangle, CheckCircle, XCircle, Eye, Activity } from "lucide-react";
import { useOverwatch } from "../../hooks/useOverwatch";

const LEVEL_STYLES = {
  info:     { dot: "bg-cyan-400",    text: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
  warn:     { dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  critical: { dot: "bg-red-400 animate-pulse", text: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

export default function OverwatchRoom() {
  const { alerts, unresolved, stats, resolve } = useOverwatch();

  return (
    <div className="flex h-full bg-[#0a0f1c]">
      {/* Left: Live alert feed */}
      <div className="flex-1 flex flex-col border-r border-[#21262d]">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d1117] border-b border-[#21262d]">
          <div className="flex items-center gap-2">
            <Eye size={13} className="text-cyan-400" />
            <span className="text-cyan-400 font-mono text-xs font-semibold tracking-wider">METACOGNITIVE OVERWATCH</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-zinc-500">{unresolved.length} active</span>
            <span className={`${stats.avg_integrity > 0.85 ? "text-emerald-400" : stats.avg_integrity > 0.6 ? "text-amber-400" : "text-red-400"}`}>
              integrity {(stats.avg_integrity * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-700">
              <Eye size={28} className="mb-2 opacity-30" />
              <p className="font-mono text-xs">Overwatch monitoring... No alerts yet.</p>
            </div>
          )}
          <AnimatePresence>
            {alerts.map(alert => {
              const style = LEVEL_STYLES[alert.level];
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: alert.resolved ? 0.4 : 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`rounded-lg p-2.5 border ${style.bg} ${alert.resolved ? "opacity-40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                      <span className={`text-[10px] font-mono font-semibold ${style.text}`}>
                        [{alert.level.toUpperCase()}] {alert.category}
                      </span>
                      {alert.organ && <span className="text-zinc-600 text-[9px]">· {alert.organ}</span>}
                    </div>
                    {!alert.resolved && (
                      <button onClick={() => resolve(alert.id)}
                        className="text-zinc-600 hover:text-emerald-400 flex-shrink-0">
                        <CheckCircle size={11} />
                      </button>
                    )}
                  </div>
                  <p className="text-zinc-400 font-mono text-[10px] mt-1 ml-3">{alert.message}</p>
                  <p className="text-zinc-700 font-mono text-[9px] mt-0.5 ml-3">{alert.ts.slice(11, 19)}</p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Stats */}
      <div className="w-52 bg-[#0d1117] p-3 space-y-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Overwatch Stats</p>
        {[
          { label: "Total Runs",     value: stats.total_runs },
          { label: "Interventions",  value: stats.interventions },
          { label: "Critical Alerts",value: stats.critical_count, color: "text-red-400" },
          { label: "Avg Integrity",  value: `${(stats.avg_integrity*100).toFixed(0)}%`,
            color: stats.avg_integrity > 0.85 ? "text-emerald-400" : "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-zinc-500 font-mono text-[10px]">{s.label}</span>
            <span className={`font-mono text-[10px] font-bold ${s.color ?? "text-cyan-400"}`}>{s.value}</span>
          </div>
        ))}

        <div className="pt-2 border-t border-[#21262d]">
          <p className="text-[9px] text-zinc-600 font-mono">Last check</p>
          <p className="text-[9px] text-zinc-500 font-mono">{stats.last_check.slice(11, 19)}</p>
        </div>
      </div>
    </div>
  );
}
