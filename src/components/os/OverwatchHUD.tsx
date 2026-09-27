/**
 * src/components/os/OverwatchHUD.tsx
 * Metacognitive Overwatch live status HUD — always-present corner widget.
 * Shows: current cognitive state, integrity score, active watch alerts.
 * Connects to backend WebSocket for live updates.
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Eye, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useServerEvents } from "../../hooks/useServerEvents";

interface OverwatchState {
  status:          "idle" | "watching" | "alert" | "intervening";
  integrity_score: number;
  active_node:     string | null;
  alerts:          string[];
  last_meta:       string | null;
}

export default function OverwatchHUD() {
  const [expanded, setExpanded] = useState(false);
  const [ow, setOw] = useState<OverwatchState>({
    status:          "idle",
    integrity_score: 1.0,
    active_node:     null,
    alerts:          [],
    last_meta:       null,
  });

  useServerEvents((event) => {
    if (event.type === "overwatch:update") {
      setOw(event.payload as OverwatchState);
    }
    if (event.type === "overwatch:alert") {
      const { message } = event.payload as { message: string };
      setOw(s => ({ ...s, alerts: [message, ...s.alerts].slice(0, 5), status: "alert" }));
    }
    if (event.type === "overwatch:node_change") {
      const { node } = event.payload as { node: string };
      setOw(s => ({ ...s, active_node: node, status: "watching" }));
    }
  });

  const statusColor = {
    idle:        "text-zinc-500",
    watching:    "text-cyan-400",
    alert:       "text-amber-400",
    intervening: "text-red-400",
  }[ow.status];

  const integrityColor = ow.integrity_score >= 0.8 ? "text-emerald-400"
    : ow.integrity_score >= 0.6 ? "text-amber-400" : "text-red-400";

  return (
    <motion.div
      className="absolute bottom-2 right-2 z-40"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden shadow-xl min-w-[180px]">

        {/* Header row */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#161b22] transition-colors"
        >
          <Eye size={11} className={statusColor} />
          <span className={`font-mono text-[10px] font-semibold ${statusColor}`}>OVERWATCH</span>
          <span className={`ml-auto font-mono text-[10px] font-bold ${integrityColor}`}>
            {Math.round(ow.integrity_score * 100)}%
          </span>
          {expanded ? <ChevronDown size={9} className="text-zinc-600" /> : <ChevronUp size={9} className="text-zinc-600" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
              className="overflow-hidden border-t border-[#21262d]"
            >
              <div className="p-2 space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-zinc-500">Status</span>
                  <span className={statusColor}>{ow.status.toUpperCase()}</span>
                </div>
                {ow.active_node && (
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-zinc-500">Node</span>
                    <span className="text-zinc-300">{ow.active_node}</span>
                  </div>
                )}
                {ow.alerts.slice(0, 2).map((alert, i) => (
                  <div key={i} className="flex items-start gap-1 text-[9px] font-mono text-amber-400">
                    <AlertTriangle size={8} className="mt-0.5 flex-shrink-0" />
                    <span className="truncate">{alert}</span>
                  </div>
                ))}
                {ow.last_meta && (
                  <div className="text-[9px] font-mono text-zinc-500 truncate pt-0.5 border-t border-[#21262d]">
                    {ow.last_meta}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Alert pulse ring */}
      {ow.status === "alert" && (
        <motion.div
          className="absolute inset-0 rounded-lg border border-amber-400/50"
          animate={{ opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}
    </motion.div>
  );
}
