/**
 * src/components/voice/VoiceToggle.tsx
 * Compact on/off toggle — mounts in TopBar, always visible.
 * Shows: mic icon, RMS visualizer, mode label, toggle button.
 */
import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useVoice } from "../../hooks/useVoice";

export default function VoiceToggle() {
  const { enabled, mode, rmsLevel, transcript, isSpeaking, toggle } = useVoice();
  const barRef = useRef<HTMLCanvasElement>(null);

  // Animate RMS bar
  useEffect(() => {
    const canvas = barRef.current;
    if (!canvas) return;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const height = Math.min(canvas.height, rmsLevel * canvas.height * 40);
    const grad   = ctx.createLinearGradient(0, canvas.height, 0, 0);
    grad.addColorStop(0, "#22d3ee");
    grad.addColorStop(1, "#06b6d4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, canvas.height - height, canvas.width, height);
  }, [rmsLevel]);

  const modeColor: Record<string, string> = {
    idle:       "text-zinc-600",
    listening:  "text-emerald-400",
    processing: "text-amber-400",
    speaking:   "text-cyan-400",
    error:      "text-red-400",
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* RMS visualizer */}
      {enabled && (
        <canvas
          ref={barRef}
          width={4}
          height={16}
          className="rounded-full opacity-80"
        />
      )}

      {/* Mode label */}
      <AnimatePresence mode="wait">
        {enabled && (
          <motion.span
            key={mode}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className={`text-[9px] font-mono uppercase tracking-widest ${modeColor[mode] ?? "text-zinc-600"}`}
          >
            {isSpeaking ? "speaking" : mode}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.9 }}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono transition-colors ${
          enabled
            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
            : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {enabled
          ? isSpeaking ? <Volume2 size={10} className="animate-pulse" /> : <Mic size={10} />
          : <MicOff size={10} />}
        <span>{enabled ? "Voice ON" : "Voice"}</span>
      </motion.button>
    </div>
  );
}
