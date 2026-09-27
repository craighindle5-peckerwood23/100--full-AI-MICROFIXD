import React, { useState } from 'react';
import { BookOpen, Code, Terminal, CheckCircle2, Search } from 'lucide-react';
import { sound } from '../../utils/audio';

const CHAPTERS = [
  { id: 1, title: 'Boot System', summary: 'Darkness -> Particle Formation -> Hologram Emergence -> Avatar Activation -> Orbit Reveal.' },
  { id: 2, title: 'AI Avatar', summary: 'Living entity expressing system state, cognition, and emotion through voice and optical iris.' },
  { id: 3, title: 'Orbit Navigation', summary: 'Orbital navigation ring of 10 subsystem nodes accessing dedicated deep spaces.' },
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
  { id: 21, title: 'Animation & Motion Design', summary: 'Modern OS layout with page routing, synthetic voice feedback, and microkernel indicators.' },
  { id: 22, title: 'Implementation Guidelines & Non-Goals', summary: 'Single-chamber OS paradigm avoiding traditional dashboard cliches.' },
  { id: 23, title: 'Comparative Analysis', summary: 'Synthetic OS vs Carter vs LangGraph vs Level 6 Autonomous Agent systems.' },
  { id: 24, title: 'Hardware & Performance', summary: 'HBM3e memory scaling, H100 Tensor Cores, and sub-10ms UI responsiveness.' },
  { id: 25, title: 'Legal, Ethical, and Compliance', summary: 'Human-in-the-loop overrides, auditable decision trees, and non-proliferative safety.' }
];

export default function BibleRoom() {
  const [selectedChapter, setSelectedChapter] = useState(CHAPTERS[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredChapters = CHAPTERS.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toString() === searchTerm
  );

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 text-cyan-400 font-mono overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <BookOpen size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white tracking-wider">
                MICROFYXD OS BIBLE: 25 CHAPTER SPECIFICATION
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                LEVEL 6 ARCHITECTURE
              </span>
            </div>
            <p className="text-xs text-cyan-500/80 mt-0.5">
              Definitive system architectural blueprint, component hierarchies, and subsystem specifications.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search 25 chapters..."
            className="w-full bg-black/60 border border-cyan-500/30 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-cyan-700 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <Search size={13} className="absolute left-2.5 top-2.5 text-cyan-600" />
        </div>
      </div>

      {/* Chapter Grid & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Chapters list */}
        <div className="lg:col-span-5 flex flex-col gap-2 overflow-y-auto max-h-[550px] pr-2 scrollbar-thin">
          {filteredChapters.map(chapter => {
            const isSelected = chapter.id === selectedChapter.id;
            return (
              <div
                key={chapter.id}
                onClick={() => { sound.playTick(); setSelectedChapter(chapter); }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'bg-black/50 border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">Chapter {chapter.id}: {chapter.title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono">
                    CH.{chapter.id}
                  </span>
                </div>
                <p className="text-[11px] text-cyan-400/70 line-clamp-2">{chapter.summary}</p>
              </div>
            );
          })}
        </div>

        {/* Selected chapter specification */}
        <div className="lg:col-span-7 flex flex-col border border-cyan-500/30 rounded-2xl bg-black/60 p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <span className="text-[10px] text-cyan-500/80 uppercase tracking-widest font-bold">
              MICROFYXD ARCHITECTURE BIBLE // CHAPTER {selectedChapter.id}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 border border-cyan-400 text-cyan-300">
              LEVEL 6 SYNTHETIC AI
            </span>
          </div>

          <h2 className="text-xl text-white font-bold tracking-wide">
            {selectedChapter.title}
          </h2>

          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-2">
            <span className="text-[10px] text-cyan-400/80 uppercase block font-semibold">Subsystem Abstract</span>
            <p className="text-xs text-white/90 leading-relaxed font-sans">
              {selectedChapter.summary}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-black/50 border border-cyan-500/20">
              <span className="text-[10px] text-cyan-500/70 block uppercase">Subsystem Class</span>
              <span className="text-white font-bold">Ring-0 Microkernel Organ</span>
            </div>
            <div className="p-3 rounded-lg bg-black/50 border border-cyan-500/20">
              <span className="text-[10px] text-cyan-500/70 block uppercase">Governance Status</span>
              <span className="text-emerald-300 font-bold">Constitutional Safe</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-cyan-500/20 text-xs text-cyan-300/80 leading-relaxed space-y-2 mt-auto">
            <div className="text-white font-bold text-xs flex items-center gap-1.5">
              <Code size={14} className="text-cyan-400" />
              IMPLEMENTATION SPECIFICATION CONTRACT
            </div>
            <p className="text-[11px]">
              Subsystem #{selectedChapter.id} operates as a modular, stateless microkernel service communicating across the high-throughput Zero-Copy Memory Bus. All state transitions emit auditable telemetry logs to both Supabase cloud persistence and the local Ring-0 cache.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
