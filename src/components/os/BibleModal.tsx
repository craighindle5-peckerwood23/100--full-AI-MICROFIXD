import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, X, Code, Sparkles, Terminal, CheckCircle2 } from 'lucide-react';
import { sound } from '../../utils/audio';

interface Props {
  onClose: () => void;
}

const CHAPTERS = [
  { id: 1, title: 'Boot System', summary: 'Darkness -> Particle Formation -> Hologram Emergence -> Avatar Activation -> Orbit Reveal.' },
  { id: 2, title: 'AI Avatar', summary: 'Living holographic entity expressing system state, cognition, and emotion.' },
  { id: 3, title: 'Orbit Navigation', summary: 'Orbital navigation ring of 10 subsystem nodes accessing immersive deep rooms.' },
  { id: 4, title: 'Mission Control', summary: 'Multi-step autonomous objective planning, DAG task graphs, and mission dispatcher.' },
  { id: 5, title: 'Agent Runtime & Kernel', summary: 'Carter, Sentinel, Nexus, Turing, DaVinci, and Atlas lifecycle & orchestration.' },
  { id: 6, title: 'Sandbox Orchestrator', summary: 'Zero-trust isolated environments, memory limits, and automated patch testing.' },
  { id: 7, title: 'Workspace UX', summary: 'Context-preserving panels, deep rooms, and multi-modal developer canvas.' },
  { id: 8, title: 'System Infrastructure', summary: 'Microkernel architecture, compute node pooling, and failover redundancy.' },
  { id: 9, title: 'Telemetry & Observability', summary: 'High-frequency metric sampling, real-time event streaming, and performance traces.' },
  { id: 10, title: 'Memory Graphs', summary: 'Episodic, semantic, and working vector stores with autonomous memory consolidation.' },
  { id: 11, title: 'Continual Learning', summary: 'Self-reflection loops, recursive meta-cognition, and fine-tuning cycles.' },
  { id: 12, title: 'Automation Engine', summary: 'Event-driven workflow pipelines, cron triggers, and autonomous reactive rules.' },
  { id: 13, title: 'Developer Layer', summary: 'RESTful and event-driven APIs, SDK interfaces, and subsystem contracts.' },
  { id: 14, title: 'Cognitive Engine (LangGraph)', summary: 'Stateful multi-agent graphs, conditional edges, cycle detection, and token streaming.' },
  { id: 15, title: 'Governance & Constitutional Safety', summary: '14 immutable ethical directives, real-time syscall interceptors, and 100% compliance.' },
  { id: 16, title: 'Federation Layer', summary: 'Distributed MCP cross-cluster routing, peer latency telemetry, and consensus protocols.' },
  { id: 17, title: 'Security Kernel & Privacy', summary: 'Threat detection, air-gapped encryption, and zero-knowledge audits.' },
  { id: 18, title: 'Observability Internals', summary: 'Low-overhead telemetry taps, distributed tracing spans, and health alarms.' },
  { id: 19, title: 'Integration Points & External APIs', summary: 'Third-party tool schemas, web search grounders, and container runtimes.' },
  { id: 20, title: 'State Flows & State Machine Design', summary: 'Deterministic finite-state machines guaranteeing recoverability across reboots.' },
  { id: 21, title: 'Animation & Holographic Motion', summary: 'Optical iris tracking, cyan-hologram shaders, and ambient sound synthesizers.' },
  { id: 22, title: 'Implementation Guidelines & Non-Goals', summary: 'Single-chamber OS paradigm avoiding traditional dashboard cliches.' },
  { id: 23, title: 'Comparative Analysis', summary: 'Synthetic OS vs Carter vs LangGraph vs Level 6 Autonomous Agent systems.' },
  { id: 24, title: 'Hardware & Performance', summary: 'HBM3e memory scaling, H100 Tensor Cores, and sub-10ms UI responsiveness.' },
  { id: 25, title: 'Legal, Ethical, and Compliance', summary: 'Human-in-the-loop overrides, auditable decision trees, and non-proliferative safety.' }
];

export default function BibleModal({ onClose }: Props) {
  const [selectedChapter, setSelectedChapter] = useState(CHAPTERS[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl font-mono text-cyan-400">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-4xl max-h-[88vh] bg-[#03070d] border border-cyan-500/40 rounded-3xl p-6 shadow-[0_0_80px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-wider">MICROFYXD OS BIBLE</span>
                <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  LEVEL 6 SPECIFICATION
                </span>
              </div>
              <p className="text-xs text-cyan-400/70">
                25 Architectural Subsystems & Cognitive Operational Directives
              </p>
            </div>
          </div>

          <button
            onClick={() => { sound.playTick(); onClose(); }}
            className="w-9 h-9 rounded-full border border-cyan-500/20 hover:bg-cyan-500/10 flex items-center justify-center text-cyan-400/80 hover:text-cyan-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Chapter List */}
          <div className="md:col-span-5 flex flex-col gap-1.5 overflow-y-auto pr-1">
            {CHAPTERS.map(ch => {
              const isSelected = ch.id === selectedChapter.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => { sound.playTick(); setSelectedChapter(ch); }}
                  className={`text-left p-2.5 rounded-xl border transition-all flex items-center justify-between text-xs ${
                    isSelected 
                      ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                      : 'border-cyan-500/10 hover:border-cyan-500/30 text-cyan-300/80 hover:bg-cyan-950/20'
                  }`}
                >
                  <span className="font-semibold">Ch. {ch.id}: {ch.title}</span>
                  {isSelected && <Sparkles size={12} className="text-cyan-400" />}
                </button>
              );
            })}
          </div>

          {/* Chapter Inspector */}
          <div className="md:col-span-7 flex flex-col border border-cyan-500/30 rounded-2xl bg-black/60 p-5 overflow-y-auto">
            <div className="text-[10px] text-cyan-500/60 uppercase tracking-widest mb-1">
              CHAPTER {selectedChapter.id} // DEEP ARCHITECTURE SPEC
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{selectedChapter.title}</h3>

            <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 mb-4">
              <span className="text-[10px] text-cyan-400/70 uppercase block mb-1 font-semibold">Executive Architecture Summary</span>
              <p className="text-xs text-cyan-200/90 leading-relaxed font-sans">{selectedChapter.summary}</p>
            </div>

            <div className="space-y-3 text-xs text-cyan-400/80">
              <div className="p-3 rounded-lg bg-black/50 border border-cyan-500/15">
                <span className="text-[10px] text-cyan-500/60 block uppercase font-semibold">Autonomous Invariant</span>
                <span className="text-white">Strict atomicity, deterministic state transitions, and unbypassed constitutional verification.</span>
              </div>
              <div className="p-3 rounded-lg bg-black/50 border border-cyan-500/15">
                <span className="text-[10px] text-cyan-500/60 block uppercase font-semibold">Cognitive Grounding</span>
                <span className="text-white">Orchestrated by LangGraph directed acyclic graph runtime with continuous memory graph integration.</span>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-cyan-500/15 flex items-center justify-between text-[11px] text-cyan-500/70">
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={13} />
                Fully Implemented & Operational
              </span>
              <span>Level 6 Certified</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
