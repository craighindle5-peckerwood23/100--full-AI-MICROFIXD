/**
 * src/components/os/StatusBar.tsx
 * Always-visible bottom status bar.
 * Shows: server connection, model, arcana level, HITL count, uptime, time.
 */
import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, Clock, AlertTriangle, Zap } from "lucide-react";

interface StatusBarProps {
  serverConnected: boolean;
  hitlPending:     number;
  onHITLClick:     () => void;
}

export default function StatusBar({ serverConnected, hitlPending, onHITLClick }: StatusBarProps) {
  const [time, setTime]     = useState(new Date());
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id    = setInterval(() => {
      setTime(new Date());
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}h${m}m` : m > 0 ? `${m}m${sec}s` : `${sec}s`;
  };

  return (
    <div className="flex items-center h-6 px-3 gap-3 bg-[#0d1117] border-t border-[#21262d] flex-shrink-0 z-50">

      {/* Server */}
      <div className={`flex items-center gap-1 text-[10px] ${serverConnected ? "text-emerald-400" : "text-zinc-600"}`}>
        {serverConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
        <span>{serverConnected ? "Server OK" : "No Server"}</span>
      </div>

      <span className="text-zinc-700">|</span>

      {/* Model */}
      <span className="text-[10px] text-zinc-500">gemini-2.0-flash-exp</span>

      <span className="text-zinc-700">|</span>

      {/* Arcana */}
      <div className="flex items-center gap-1 text-[10px] text-cyan-500">
        <Zap size={9} />
        <span>L7 Arcana</span>
      </div>

      <div className="flex-1" />

      {/* HITL pending */}
      {hitlPending > 0 && (
        <button
          onClick={onHITLClick}
          className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
        >
          <AlertTriangle size={10} />
          <span>{hitlPending} awaiting review</span>
        </button>
      )}

      {/* Uptime */}
      <span className="text-[10px] text-zinc-600">up {fmtUptime(uptime)}</span>

      <span className="text-zinc-700">|</span>

      {/* Time */}
      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
        <Clock size={9} />
        <span>{time.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
