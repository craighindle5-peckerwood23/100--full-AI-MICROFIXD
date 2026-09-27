/**
 * src/components/os/HITLOverlay.tsx
 * Full-screen HITL gate for CRITICAL errors + self-modification events.
 * Blocks all interaction until human decides: Approve or Reject.
 * rule-SB-003: triggered on every critical build, self-mod, or organ override.
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Shield, CheckCircle, XCircle, GitBranch, Cpu, Zap } from "lucide-react";
import type { HITLRecord } from "../../lib/serverApi";

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  self_modification: <Cpu size={20} className="text-violet-400" />,
  critical_error:    <AlertTriangle size={20} className="text-red-400" />,
  organ_override:    <Zap size={20} className="text-amber-400" />,
  github_push:       <GitBranch size={20} className="text-cyan-400" />,
  build_complete:    <Shield size={20} className="text-emerald-400" />,
};

const SEVERITY_STYLES = {
  critical: { border: "border-red-500/40",    bg: "bg-red-500/10",    text: "text-red-400",    label: "CRITICAL" },
  major:    { border: "border-amber-500/40",  bg: "bg-amber-500/10",  text: "text-amber-400",  label: "MAJOR"    },
  minor:    { border: "border-zinc-500/40",   bg: "bg-zinc-500/10",   text: "text-zinc-400",   label: "MINOR"    },
};

interface HITLOverlayProps {
  record:   HITLRecord;
  onDecide: (decision: "approved" | "rejected", notes?: string) => void;
}

export default function HITLOverlay({ record, onDecide }: HITLOverlayProps) {
  const [notes, setNotes]       = useState("");
  const [deciding, setDeciding] = useState(false);

  const severity = record.artifact?.severity ?? "major";
  const style    = SEVERITY_STYLES[severity as keyof typeof SEVERITY_STYLES] ?? SEVERITY_STYLES.major;
  const icon     = TRIGGER_ICONS[record.trigger] ?? <Shield size={20} className="text-zinc-400" />;

  const handle = async (decision: "approved" | "rejected") => {
    setDeciding(true);
    onDecide(decision, notes || undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        className={`w-full max-w-lg bg-[#0d1117] border ${style.border} rounded-2xl overflow-hidden shadow-2xl`}
      >
        {/* Header */}
        <div className={`${style.bg} border-b ${style.border} px-5 py-3 flex items-center gap-3`}>
          {icon}
          <div>
            <p className={`font-mono text-xs font-bold ${style.text} tracking-widest`}>
              ⚠ HUMAN REVIEW REQUIRED — {style.label}
            </p>
            <p className="text-zinc-400 font-mono text-[10px] mt-0.5">
              {record.trigger.replace(/_/g, " ").toUpperCase()} · {new Date(record.ts).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-1">Artifact</p>
            <p className="text-zinc-200 font-mono text-sm font-semibold">{record.artifact.name}</p>
            {record.artifact.description && (
              <p className="text-zinc-400 font-mono text-xs mt-1">{String(record.artifact.description)}</p>
            )}
          </div>

          {record.artifact.files && (
            <div>
              <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-1">Files Affected</p>
              <div className="space-y-0.5">
                {(record.artifact.files as string[]).map((f, i) => (
                  <div key={i} className="text-zinc-400 font-mono text-[10px]">· {f}</div>
                ))}
              </div>
            </div>
          )}

          {record.artifact.diff && (
            <div>
              <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-1">Proposed Change</p>
              <pre className="text-[10px] font-mono text-zinc-400 bg-[#161b22] border border-[#21262d] rounded p-2 overflow-x-auto max-h-32">
                {String(record.artifact.diff)}
              </pre>
            </div>
          )}

          {/* Human notes */}
          <div>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-1">Notes (optional)</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Reason for approval or rejection..."
              rows={2}
              className="w-full bg-[#161b22] border border-[#21262d] rounded px-2 py-1.5 text-xs font-mono text-zinc-300 placeholder-zinc-600 outline-none resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-4">
          <button
            onClick={() => handle("approved")}
            disabled={deciding}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-mono text-sm font-semibold hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
          >
            <CheckCircle size={14} /> Approve
          </button>
          <button
            onClick={() => handle("rejected")}
            disabled={deciding}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-mono text-sm font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-colors"
          >
            <XCircle size={14} /> Reject
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
