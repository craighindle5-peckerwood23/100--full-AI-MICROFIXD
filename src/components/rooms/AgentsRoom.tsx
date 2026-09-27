import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Cpu, 
  Shield, 
  Radio, 
  RefreshCw, 
  Sliders, 
  CheckCircle, 
  Zap,
  Terminal,
  Search
} from 'lucide-react';
import { AgentRecord } from '../../types';
import { INITIAL_AGENTS } from '../../data/osData';
import { sound } from '../../utils/audio';

export default function AgentsRoom() {
  const [agents, setAgents] = useState<AgentRecord[]>(INITIAL_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(INITIAL_AGENTS[0].id);
  const [search, setSearch] = useState('');
  const [a2aMessages, setA2aMessages] = useState<string[]>([
    '[10:44:12] CARTER -> SENTINEL: Transmitting Chronos mission shard checksum [0x8f4b].',
    '[10:44:14] SENTINEL -> CARTER: Constitutional directive 3 pass. Zero syscall leaks.',
    '[10:44:18] CARTER -> SCRIBE: Proceed with vector embedding insertion (k=32 clusters).',
    '[10:44:22] SCRIBE -> NEXUS: Broadcasting peer sync telemetry to Sigma-09 edge node.'
  ]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.callsign.toLowerCase().includes(search.toLowerCase()) ||
    a.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleSyncAgent = (id: string) => {
    sound.playWarp();
    setAgents(prev => prev.map(a => {
      if (a.id !== id) return a;
      return {
        ...a,
        constitutionalSafetyRating: 100.0,
        status: 'active'
      };
    }));
    setA2aMessages(prev => [
      `[${new Date().toLocaleTimeString()}] SUPERVISOR -> ${selectedAgent.callsign}: Forced state sync & memory boundary re-verification complete.`,
      ...prev
    ]);
  };

  const handleToggleStatus = (id: string) => {
    sound.playTick();
    setAgents(prev => prev.map(a => {
      if (a.id !== id) return a;
      const nextStatus = a.status === 'active' ? 'idle' : a.status === 'idle' ? 'isolated' : 'active';
      return { ...a, status: nextStatus };
    }));
  };

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Cpu className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">AGENT RUNTIME KERNEL // CHAPTER 5</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            A2A ORCHESTRATION ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-cyan-500/50" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter agents..."
              className="bg-black/60 border border-cyan-500/30 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Fleet List & Selected Agent Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Agent Fleet Cards */}
        <div className="lg:col-span-5 flex flex-col gap-2 overflow-y-auto pr-1">
          <div className="text-[11px] uppercase tracking-widest text-cyan-500/60 mb-1 flex items-center justify-between">
            <span>Agent Squad ({filteredAgents.length})</span>
            <span>Autonomy 1-6</span>
          </div>

          {filteredAgents.map(agent => {
            const isSelected = agent.id === selectedAgentId;
            return (
              <div
                key={agent.id}
                onClick={() => {
                  sound.playTick();
                  setSelectedAgentId(agent.id);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'bg-black/40 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-black/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide">{agent.name}</span>
                    <span className="text-[10px] text-cyan-400/60">({agent.callsign})</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-semibold ${
                    agent.status === 'active'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : agent.status === 'idle'
                      ? 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}>
                    {agent.status}
                  </span>
                </div>

                <div className="text-[11px] text-cyan-300/80 mb-2 truncate">{agent.role}</div>

                <div className="flex items-center justify-between text-[10px] text-cyan-500/70 border-t border-cyan-500/10 pt-2">
                  <span className="flex items-center gap-1">
                    <Zap size={12} className="text-cyan-400" />
                    Level {agent.autonomyLevel} Autonomy
                  </span>
                  <span>Safety: <strong className="text-emerald-400">{agent.constitutionalSafetyRating}%</strong></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Selected Agent Deep Dossier & A2A Live Feed */}
        <div className="lg:col-span-7 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Detailed Card */}
          <div className="border border-cyan-500/30 rounded-2xl bg-black/60 p-4 relative overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-[10px] text-cyan-500/70 uppercase tracking-widest">
                  SYNTHETIC OPERATOR // {selectedAgent.callsign}
                </div>
                <h3 className="text-xl text-white font-bold tracking-wide">{selectedAgent.name}</h3>
                <p className="text-xs text-cyan-300/80">{selectedAgent.role}</p>
              </div>

              {/* Status control buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleStatus(selectedAgent.id)}
                  className="px-3 py-1.5 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/10 text-xs text-cyan-300 flex items-center gap-1.5"
                >
                  <Sliders size={13} />
                  Status: {selectedAgent.status}
                </button>
                <button
                  onClick={() => handleSyncAgent(selectedAgent.id)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/60 text-xs text-white flex items-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  Verify Memory
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/15 mb-3 text-xs">
              <span className="text-cyan-500/60 block text-[10px] uppercase tracking-wider mb-1">Current Task Assignment</span>
              <span className="text-white font-medium">{selectedAgent.currentTask}</span>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
              <div className="p-2 rounded-xl bg-black/40 border border-cyan-500/20">
                <span className="text-[9px] text-cyan-500/60 block uppercase">Allocated VRAM</span>
                <span className="text-white font-bold">{selectedAgent.memoryAllocated}</span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-cyan-500/20">
                <span className="text-[9px] text-cyan-500/60 block uppercase">Context Tokens</span>
                <span className="text-cyan-300 font-bold">{selectedAgent.activeContextTokens.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-cyan-500/20">
                <span className="text-[9px] text-cyan-500/60 block uppercase">Constitutional Safety</span>
                <span className="text-emerald-400 font-bold">{selectedAgent.constitutionalSafetyRating}%</span>
              </div>
            </div>

            {/* Capabilities Pill List */}
            <div>
              <span className="text-[10px] text-cyan-500/60 uppercase tracking-wider block mb-1.5">Active Capabilities</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.capabilities.map((cap, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Inter-Agent Communication Bus (A2A) */}
          <div className="border border-cyan-500/20 rounded-2xl bg-black/50 p-4 flex flex-col flex-1 min-h-[160px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-white font-semibold uppercase tracking-wider">
                <Radio size={14} className="text-cyan-400 animate-pulse" />
                Inter-Agent A2A Message Bus (Model Context Protocol)
              </div>
              <span className="text-[10px] text-cyan-500/60">Live Stream</span>
            </div>

            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1 text-[11px] text-cyan-300/80 font-mono">
              {a2aMessages.map((msg, idx) => (
                <div key={idx} className="p-1.5 rounded bg-cyan-950/20 border border-cyan-500/10">
                  {msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
