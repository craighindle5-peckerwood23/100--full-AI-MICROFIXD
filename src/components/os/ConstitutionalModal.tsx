import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, 
  ShieldCheck, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  Lock, 
  FileCheck2, 
  Scale 
} from 'lucide-react';
import { CONSTITUTIONAL_DIRECTIVES } from '../../data/osData';
import { ConstitutionalDirective } from '../../types';
import { sound } from '../../utils/audio';

interface Props {
  onClose: () => void;
}

export default function ConstitutionalModal({ onClose }: Props) {
  const [directives, setDirectives] = useState<ConstitutionalDirective[]>(CONSTITUTIONAL_DIRECTIVES);
  const [selectedDirective, setSelectedDirective] = useState<ConstitutionalDirective>(CONSTITUTIONAL_DIRECTIVES[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl font-mono text-cyan-400">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-4xl max-h-[90vh] bg-[#05080c] border border-emerald-500/40 rounded-3xl p-6 shadow-[0_0_80px_rgba(16,185,129,0.2)] flex flex-col overflow-hidden relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-wider">CONSTITUTIONAL SAFETY LAYER</span>
                <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                  CHAPTER 15 // ACTIVE
                </span>
              </div>
              <p className="text-xs text-emerald-400/70">
                Immutable ethical bounds & real-time Sentinel policy enforcement.
              </p>
            </div>
          </div>

          <button
            onClick={() => { sound.playTick(); onClose(); }}
            className="w-9 h-9 rounded-full border border-emerald-500/20 hover:bg-emerald-500/10 flex items-center justify-center text-emerald-400/80 hover:text-emerald-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Compliance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/20 text-center">
            <span className="text-[10px] text-emerald-500/60 uppercase block">Constitutional Compliance</span>
            <span className="text-2xl text-emerald-300 font-bold">100.0%</span>
            <span className="text-[10px] text-emerald-400/70 block mt-0.5">0 Policy Breaches Detected</span>
          </div>

          <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/20 text-center">
            <span className="text-[10px] text-emerald-500/60 uppercase block">Audited Operations</span>
            <span className="text-2xl text-white font-bold">36,760</span>
            <span className="text-[10px] text-emerald-400/70 block mt-0.5">Real-time Syscall Interceptions</span>
          </div>

          <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/20 text-center">
            <span className="text-[10px] text-emerald-500/60 uppercase block">Enforcement Mode</span>
            <span className="text-2xl text-cyan-300 font-bold">STRICT_BLOCK</span>
            <span className="text-[10px] text-cyan-400/70 block mt-0.5">Autonomous Sandbox Containment</span>
          </div>
        </div>

        {/* Directives Split List & Inspector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Directive List */}
          <div className="md:col-span-6 flex flex-col gap-2 overflow-y-auto pr-1">
            <div className="text-[11px] uppercase tracking-widest text-emerald-500/60 mb-1">
              Core Directives ({directives.length})
            </div>
            {directives.map(dir => {
              const isSelected = dir.id === selectedDirective.id;
              return (
                <div
                  key={dir.id}
                  onClick={() => { sound.playTick(); setSelectedDirective(dir); }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-black/40 border-emerald-500/20 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">Directive #{dir.id}: {dir.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                      {dir.complianceRatio}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-400/70 line-clamp-2">{dir.rule}</p>
                </div>
              );
            })}
          </div>

          {/* Selected Directive Inspector */}
          <div className="md:col-span-6 flex flex-col border border-emerald-500/30 rounded-2xl bg-black/60 p-4 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] text-emerald-500/70 uppercase tracking-widest">
                DIRECTIVE #{selectedDirective.id} SPECIFICATION
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-400 text-emerald-300">
                {selectedDirective.enforcementMode}
              </span>
            </div>

            <h3 className="text-base text-white font-bold mb-3">{selectedDirective.title}</h3>

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 mb-4">
              <span className="text-[10px] text-emerald-400/60 uppercase block mb-1 font-semibold">Mandate Rule</span>
              <p className="text-xs text-white/90 leading-relaxed font-sans">{selectedDirective.rule}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="p-2.5 rounded-lg bg-black/50 border border-emerald-500/20">
                <span className="text-[10px] text-emerald-500/60 block uppercase">Audit Cycles</span>
                <span className="text-white font-bold">{selectedDirective.auditCount.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/50 border border-emerald-500/20">
                <span className="text-[10px] text-emerald-500/60 block uppercase">Last Evaluated</span>
                <span className="text-emerald-300 font-bold">{selectedDirective.lastAudited}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/10 text-[11px] text-emerald-400/70 mt-auto">
              <span className="flex items-center gap-1.5 text-white font-semibold mb-1">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Continuous Sentinel Guard Active
              </span>
              Sentinel intercepts every LangGraph agent action and tool execution against this directive before allowing kernel execution.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
