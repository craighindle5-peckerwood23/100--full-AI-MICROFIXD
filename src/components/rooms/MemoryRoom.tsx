import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  Search, 
  Share2, 
  Layers, 
  HardDrive, 
  Sparkles, 
  Tag, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';
import { MemoryNode } from '../../types';
import { INITIAL_MEMORY_NODES } from '../../data/osData';
import { sound } from '../../utils/audio';

export default function MemoryRoom() {
  const [memoryNodes, setMemoryNodes] = useState<MemoryNode[]>(INITIAL_MEMORY_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(INITIAL_MEMORY_NODES[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isConsolidating, setIsConsolidating] = useState(false);

  const selectedNode = memoryNodes.find(n => n.id === selectedNodeId) || memoryNodes[0];

  const filteredNodes = memoryNodes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          n.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || n.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleConsolidate = async () => {
    sound.playWarp();
    setIsConsolidating(true);
    await new Promise(r => setTimeout(r, 1000));
    
    // Add a new consolidated episodic node
    const newNode: MemoryNode = {
      id: `mem-${Date.now().toString().slice(-2)}`,
      title: `Episodic Consolidation #${memoryNodes.length + 1}`,
      type: 'episodic',
      summary: 'Automated clustering compressed 3,200 ephemeral tokens into high-density semantic weights.',
      weight: 0.89,
      connections: ['mem-01', 'mem-02'],
      timestamp: new Date().toLocaleTimeString(),
      tags: ['Consolidation', 'Episodic', 'Cluster']
    };

    setMemoryNodes(prev => [newNode, ...prev]);
    setSelectedNodeId(newNode.id);
    setIsConsolidating(false);
    sound.playCognitivePulse();
  };

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Database className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">MEMORY SUBSYSTEM // CHAPTER 10</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            VECTOR KNOWLEDGE GRAPH ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleConsolidate}
            disabled={isConsolidating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-xs text-white disabled:opacity-50 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            <Sparkles size={13} className={isConsolidating ? 'animate-spin' : ''} />
            {isConsolidating ? 'Consolidating Shards...' : 'Consolidate Shards'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-2.5 rounded-xl border border-cyan-500/20">
        <div className="flex items-center gap-1.5 text-xs">
          {['all', 'constitutional', 'working', 'semantic', 'episodic'].map(t => (
            <button
              key={t}
              onClick={() => { sound.playTick(); setFilterType(t); }}
              className={`px-2.5 py-1 rounded-lg uppercase text-[10px] transition-all border ${
                filterType === t 
                  ? 'bg-cyan-500/20 border-cyan-400 text-white' 
                  : 'border-cyan-500/15 text-cyan-500/60 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-2.5 text-cyan-500/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Vector semantic search..."
            className="w-full bg-black/70 border border-cyan-500/30 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Main Grid: Node Graph List (Left) & Node Deep View (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Memory Nodes */}
        <div className="lg:col-span-5 flex flex-col gap-2 overflow-y-auto pr-1">
          {filteredNodes.map(node => {
            const isSelected = node.id === selectedNodeId;
            return (
              <div
                key={node.id}
                onClick={() => {
                  sound.playTick();
                  setSelectedNodeId(node.id);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'bg-black/40 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-black/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-white tracking-wide truncate">{node.title}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded uppercase font-semibold bg-cyan-900/30 border border-cyan-500/30 text-cyan-300">
                    {node.type}
                  </span>
                </div>
                <p className="text-[11px] text-cyan-400/70 line-clamp-2 mb-2">{node.summary}</p>
                <div className="flex items-center justify-between text-[10px] text-cyan-500/60 border-t border-cyan-500/10 pt-1.5">
                  <span>Weight: <strong className="text-cyan-200">{(node.weight * 100).toFixed(0)}%</strong></span>
                  <span>Links: <strong className="text-white">{node.connections.length}</strong></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Node Visual Relationship Map & Inspector */}
        <div className="lg:col-span-7 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Selected Node Details */}
          <div className="border border-cyan-500/30 rounded-2xl bg-black/60 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="text-[10px] text-cyan-500/70 uppercase tracking-widest">
                  MEMORY NODE // {selectedNode.id}
                </div>
                <h3 className="text-lg text-white font-bold tracking-wide">{selectedNode.title}</h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg uppercase text-[10px] bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold">
                {selectedNode.type}
              </span>
            </div>

            <p className="text-xs text-cyan-200/90 leading-relaxed mb-3">{selectedNode.summary}</p>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-cyan-500/70 border-t border-cyan-500/10 pt-2 mb-3">
              <div>
                <span className="block text-[10px] opacity-70">Semantic Association Weight</span>
                <span className="text-white font-bold">{(selectedNode.weight * 100).toFixed(1)}% Relevance</span>
              </div>
              <div>
                <span className="block text-[10px] opacity-70">Committed Timestamp</span>
                <span className="text-white font-bold">{selectedNode.timestamp}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selectedNode.tags.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/30 text-[10px] text-cyan-300">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Connected Graph Topology */}
          <div className="border border-cyan-500/20 rounded-2xl bg-black/50 p-4 flex flex-col flex-1 min-h-[160px]">
            <div className="flex items-center justify-between mb-3 text-xs text-white font-semibold">
              <div className="flex items-center gap-2">
                <Share2 size={14} className="text-cyan-400" />
                <span>CONNECTED GRAPH ASSOCIATIONS</span>
              </div>
              <span className="text-[10px] text-cyan-500/60">Cosine Distance Graph</span>
            </div>

            <div className="flex-1 flex flex-wrap items-center justify-center gap-4 p-4 border border-cyan-500/10 rounded-xl bg-black/80">
              {/* Central Node */}
              <div className="p-3 rounded-2xl border-2 border-cyan-400 bg-cyan-950/60 text-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                <span className="text-xs font-bold text-white block">{selectedNode.title}</span>
                <span className="text-[9px] text-cyan-300 uppercase">{selectedNode.type}</span>
              </div>

              {/* Connected Nodes */}
              {selectedNode.connections.map(cId => {
                const targetNode = memoryNodes.find(n => n.id === cId);
                return (
                  <div
                    key={cId}
                    onClick={() => { sound.playTick(); setSelectedNodeId(cId); }}
                    className="p-2.5 rounded-xl border border-cyan-500/30 bg-black/60 text-center cursor-pointer hover:border-cyan-400 hover:scale-105 transition-all"
                  >
                    <span className="text-[11px] font-medium text-white block">{targetNode ? targetNode.title : cId}</span>
                    <span className="text-[9px] text-cyan-500/60">Edge Link</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
