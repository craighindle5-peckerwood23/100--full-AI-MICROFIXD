import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Layout, 
  FileText, 
  Share2, 
  Plus, 
  Sparkles, 
  Trash2, 
  Download,
  Copy,
  Check
} from 'lucide-react';
import { sound } from '../../utils/audio';

interface CanvasNode {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
  type: 'concept' | 'agent' | 'data';
}

export default function WorkspaceRoom() {
  const [activeTab, setActiveTab] = useState<'scratchpad' | 'canvas' | 'artifact'>('scratchpad');
  const [scratchpadText, setScratchpadText] = useState<string>(
`# Microfyxd OS Architecture Notes // Level 6 AI

## Cognitive Flow Hypothesis:
1. When user inputs intent via Avatar Chamber, Carter initializes LangGraph state.
2. Scribe pulls semantic vector embeddings from memory graphs with k=16 nearest neighbors.
3. Sentinel intercepts any tool calls before Sandbox dispatch to enforce Zero Harm and Bounded Autonomy.

## Subsystem Checkpoints:
- Mission Control DAG: 100% Deterministic & Auditable
- Inter-Agent Model Context Protocol: Latency < 15ms
- Continual Meta-Cognitive Reflection: 0 Hallucination Drift
`);

  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: '1', title: 'Carter Orchestrator', content: 'Central agent routing', x: 40, y: 50, type: 'agent' },
    { id: '2', title: 'Episodic Memory Cluster', content: 'Vector DB k=32', x: 280, y: 120, type: 'data' },
    { id: '3', title: 'Sentinel Safety Barrier', content: 'Directive audit gate', x: 180, y: 240, type: 'concept' },
  ]);

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    sound.playTick();
    navigator.clipboard.writeText(scratchpadText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddNode = () => {
    sound.playWarp();
    const newNode: CanvasNode = {
      id: Date.now().toString(),
      title: `Node #${nodes.length + 1}`,
      content: 'Connected cognitive entity',
      x: 100 + Math.random() * 200,
      y: 80 + Math.random() * 150,
      type: 'concept'
    };
    setNodes(prev => [...prev, newNode]);
  };

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Layout className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">COGNITIVE WORKSPACE // CHAPTER 7</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            MULTI-PANEL UX DEEP ROOM
          </span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-cyan-500/20 text-xs">
          <button
            onClick={() => { sound.playTick(); setActiveTab('scratchpad'); }}
            className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'scratchpad' ? 'bg-cyan-500/20 text-white border border-cyan-400' : 'text-cyan-400/60 hover:text-white'}`}
          >
            Prompt Scratchpad
          </button>
          <button
            onClick={() => { sound.playTick(); setActiveTab('canvas'); }}
            className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'canvas' ? 'bg-cyan-500/20 text-white border border-cyan-400' : 'text-cyan-400/60 hover:text-white'}`}
          >
            Concept Canvas ({nodes.length})
          </button>
          <button
            onClick={() => { sound.playTick(); setActiveTab('artifact'); }}
            className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'artifact' ? 'bg-cyan-500/20 text-white border border-cyan-400' : 'text-cyan-400/60 hover:text-white'}`}
          >
            Generated Artifacts
          </button>
        </div>
      </div>

      {/* Main Content Area based on Tab */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'scratchpad' && (
          <div className="h-full flex flex-col border border-cyan-500/30 rounded-2xl bg-black/60 p-4 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-white font-semibold">
                <FileText size={15} className="text-cyan-400" />
                <span>SYNTHETIC SCRATCHPAD & PROMPT DRAFTING</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/10 text-xs text-cyan-300"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <textarea
              value={scratchpadText}
              onChange={e => setScratchpadText(e.target.value)}
              className="flex-1 w-full bg-black/80 border border-cyan-500/20 rounded-xl p-4 text-xs text-cyan-200 font-mono leading-relaxed focus:outline-none focus:border-cyan-400 resize-none"
            />
          </div>
        )}

        {activeTab === 'canvas' && (
          <div className="h-full flex flex-col border border-cyan-500/30 rounded-2xl bg-black/60 p-4 min-h-0 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3 z-10">
              <div className="flex items-center gap-2 text-xs text-white font-semibold">
                <Share2 size={15} className="text-cyan-400" />
                <span>INTERACTIVE CONCEPT TOPOLOGY</span>
              </div>
              <button
                onClick={handleAddNode}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-xs text-white"
              >
                <Plus size={13} /> Add Node
              </button>
            </div>

            {/* Grid Canvas */}
            <div className="flex-1 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:24px_24px] border border-cyan-500/20 rounded-xl relative overflow-auto p-4">
              {nodes.map(node => (
                <div
                  key={node.id}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  className="absolute p-3 rounded-xl bg-black/90 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] w-48 transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300">
                      {node.type}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.playTick();
                        setNodes(prev => prev.filter(n => n.id !== node.id));
                      }}
                      className="text-cyan-500/40 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">{node.title}</div>
                  <div className="text-[10px] text-cyan-400/70">{node.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'artifact' && (
          <div className="h-full flex flex-col border border-cyan-500/30 rounded-2xl bg-black/60 p-4 min-h-0 overflow-y-auto">
            <div className="text-xs text-white font-semibold mb-3">SYNTHETIC ARTIFACT REPOSITORY</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-cyan-500/20 bg-black/40">
                <span className="text-[10px] text-cyan-400/60 block">MANIFEST // v6.4.0</span>
                <span className="text-xs text-white font-bold block mb-1">Microfyxd Kernel Blueprint</span>
                <p className="text-[11px] text-cyan-300/80 mb-2">Immutable JSON configuration for the 3-layer architecture.</p>
                <div className="text-[10px] text-cyan-500/50">Generated: 10:45:00 UTC</div>
              </div>
              <div className="p-3 rounded-xl border border-cyan-500/20 bg-black/40">
                <span className="text-[10px] text-cyan-400/60 block">SCHEMA // MCP-v2</span>
                <span className="text-xs text-white font-bold block mb-1">Model Context Protocol Definitions</span>
                <p className="text-[11px] text-cyan-300/80 mb-2">Inter-agent message structures for Carter, Sentinel, and Scribe.</p>
                <div className="text-[10px] text-cyan-500/50">Generated: 10:42:15 UTC</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
