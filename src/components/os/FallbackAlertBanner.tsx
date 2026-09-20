import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  RotateCcw, 
  Lock, 
  Unlock, 
  X, 
  Radio, 
  ArrowRight, 
  ShieldAlert, 
  Activity
} from 'lucide-react';
import { autonomousCore } from '../../autonomy/autonomousCore';
import { FallbackAlertState } from '../../types';

interface Props {
  onOpenAutonomyRoom?: () => void;
}

export default function FallbackAlertBanner({ onOpenAutonomyRoom }: Props) {
  const [alert, setAlert] = useState<FallbackAlertState>(autonomousCore.getFallbackAlert());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const unsub = autonomousCore.subscribe(() => {
      setAlert({ ...autonomousCore.getFallbackAlert() });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!alert.active || alert.dismissed) return;
    const interval = setInterval(() => {
      if (alert.timestampMs) {
        setElapsedSeconds(Math.floor((Date.now() - alert.timestampMs) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [alert.active, alert.dismissed, alert.timestampMs]);

  if (!alert.active || alert.dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full z-35 px-4 py-2 bg-gradient-to-r from-amber-950/90 via-black/95 to-amber-950/90 border-b border-amber-500/50 backdrop-blur-xl shadow-[0_4px_25px_rgba(245,158,11,0.25)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
      >
        {/* Left Side: Warning Icon & Status Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)] shrink-0 animate-pulse">
            <AlertTriangle size={18} />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-amber-200 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                AUTONOMOUS CORE: CONNECTIVITY ISSUE DETECTED
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300">
                CASCADE ACTIVE ({elapsedSeconds}s ago)
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-300 flex-wrap">
              <span className="text-red-400 line-through font-semibold">
                {alert.primaryProvider.toUpperCase()} ({alert.primaryModel})
              </span>
              <ArrowRight size={12} className="text-amber-400 shrink-0" />
              <span className="text-emerald-300 font-bold flex items-center gap-1 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                <Radio size={10} className="text-emerald-400 animate-pulse" />
                FALLBACK: {alert.fallbackProvider.toUpperCase()} ({alert.fallbackModel})
              </span>
              <span className="text-amber-400/80 text-[10px] hidden md:inline truncate max-w-md">
                [{alert.reason}]
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Controls (Undo, Manual Override, Inspect, Dismiss) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Undo Button */}
          <button
            onClick={() => autonomousCore.undoFallback()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-200 text-xs font-bold transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)] active:scale-95"
            title="Revert model switch and restore primary provider"
          >
            <RotateCcw size={13} />
            <span>Undo Switch</span>
          </button>

          {/* Manual Override Toggle */}
          <button
            onClick={() => autonomousCore.toggleManualOverride()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              alert.manualOverrideActive
                ? 'bg-red-500/25 border-red-400 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                : 'bg-zinc-800/80 hover:bg-zinc-700/80 border-zinc-600 text-zinc-200'
            }`}
            title="Freeze automated model cascade and lock to current provider"
          >
            {alert.manualOverrideActive ? <Lock size={13} className="text-red-400" /> : <Unlock size={13} />}
            <span>
              {alert.manualOverrideActive ? 'Manual Override (LOCKED)' : 'Manual Override'}
            </span>
          </button>

          {/* Open Autonomy Room */}
          {onOpenAutonomyRoom && (
            <button
              onClick={onOpenAutonomyRoom}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 text-xs transition-all"
              title="Open Autonomous Monitor & Oversight Room"
            >
              <Activity size={12} />
              <span>Inspect Oversight</span>
            </button>
          )}

          {/* Dismiss Banner */}
          <button
            onClick={() => autonomousCore.dismissFallbackAlert()}
            className="p-1 rounded-lg border border-amber-500/30 text-amber-400 hover:text-white hover:bg-amber-500/20 transition-colors"
            title="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
