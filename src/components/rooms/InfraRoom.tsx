import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Server, 
  Cpu, 
  Activity, 
  ShieldCheck, 
  Zap, 
  RefreshCw, 
  Thermometer, 
  CheckCircle2, 
  Power 
} from 'lucide-react';
import { sound } from '../../utils/audio';

interface ClusterNode {
  id: string;
  name: string;
  role: string;
  vCpus: number;
  gpuUnit: string;
  load: number;
  tempC: number;
  status: 'ONLINE' | 'REBALANCING' | 'MAINTENANCE';
}

export default function InfraRoom() {
  const [nodes, setNodes] = useState<ClusterNode[]>([
    { id: 'node-1', name: 'Alpha-01 Primary', role: 'LangGraph Cognitive Core', vCpus: 32, gpuUnit: '2x H100 SXM5', load: 44, tempC: 54, status: 'ONLINE' },
    { id: 'node-2', name: 'Alpha-02 Storage', role: 'Vector Embedding & Graph DB', vCpus: 32, gpuUnit: '2x H100 SXM5', load: 62, tempC: 59, status: 'ONLINE' },
    { id: 'node-3', name: 'Beta-01 Sandbox', role: 'WASM & Isolated Hypervisor', vCpus: 32, gpuUnit: '2x H100 SXM5', load: 21, tempC: 48, status: 'ONLINE' },
    { id: 'node-4', name: 'Quantum-Sim-1', role: 'Heuristic Quantum Annealer', vCpus: 32, gpuUnit: 'Q-Sim Unit 64-Qubit', load: 38, tempC: 38, status: 'ONLINE' }
  ]);

  const [quantumCoherence, setQuantumCoherence] = useState(99.4);
  const [isRebalancing, setIsRebalancing] = useState(false);

  const handleRebalance = async () => {
    sound.playWarp();
    setIsRebalancing(true);
    setNodes(prev => prev.map(n => ({ ...n, status: 'REBALANCING' })));

    await new Promise(r => setTimeout(r, 1200));

    setNodes(prev => prev.map(n => ({
      ...n,
      load: Math.floor(30 + Math.random() * 25),
      tempC: Math.floor(45 + Math.random() * 10),
      status: 'ONLINE'
    })));
    setQuantumCoherence(99.8);
    setIsRebalancing(false);
    sound.playCognitivePulse();
  };

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Server className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">INFRASTRUCTURE KERNEL // CHAPTER 8</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            COMPUTE MESH HIGH-AVAILABILITY
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRebalance}
            disabled={isRebalancing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-xs text-white disabled:opacity-50 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            <RefreshCw size={13} className={isRebalancing ? 'animate-spin' : ''} />
            {isRebalancing ? 'Rebalancing Mesh...' : 'Rebalance Load'}
          </button>
        </div>
      </div>

      {/* Cluster Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
          <span className="text-[10px] text-cyan-500/60 uppercase block">Total Compute</span>
          <span className="text-xl text-white font-bold">128 vCPUs</span>
          <span className="text-[10px] text-cyan-400/80 block mt-1">8x H100 Tensor Cores</span>
        </div>
        <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
          <span className="text-[10px] text-cyan-500/60 uppercase block">Interconnect Bandwidth</span>
          <span className="text-xl text-cyan-300 font-bold">800 Gbps</span>
          <span className="text-[10px] text-emerald-400 block mt-1">Mesh Topology 0.2ms</span>
        </div>
        <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
          <span className="text-[10px] text-cyan-500/60 uppercase block">Quantum Coherence</span>
          <span className="text-xl text-emerald-300 font-bold">{quantumCoherence.toFixed(1)}%</span>
          <span className="text-[10px] text-cyan-400/80 block mt-1">Annealer Active</span>
        </div>
        <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
          <span className="text-[10px] text-cyan-500/60 uppercase block">Redundancy Matrix</span>
          <span className="text-xl text-white font-bold">Active N+2</span>
          <span className="text-[10px] text-emerald-400 block mt-1">Failover Automated</span>
        </div>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
        {nodes.map(node => (
          <div
            key={node.id}
            className="p-4 rounded-2xl border border-cyan-500/30 bg-black/60 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-bold text-white tracking-wide">{node.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                  node.status === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                }`}>
                  {node.status}
                </span>
              </div>
              <div className="text-xs text-cyan-300/80 mb-3">{node.role}</div>

              <div className="flex items-center justify-between text-xs text-cyan-400/70 mb-2">
                <span>Load Allocation</span>
                <strong className="text-white">{node.load}%</strong>
              </div>
              <div className="h-1.5 w-full bg-cyan-950 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full transition-all duration-500 ${node.load > 70 ? 'bg-yellow-400' : 'bg-cyan-400'}`}
                  style={{ width: `${node.load}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] border-t border-cyan-500/10 pt-3">
              <div>
                <span className="text-cyan-500/50 block">Cores</span>
                <span className="text-white font-bold">{node.vCpus} vCPUs</span>
              </div>
              <div>
                <span className="text-cyan-500/50 block">Hardware</span>
                <span className="text-cyan-300 font-bold truncate">{node.gpuUnit}</span>
              </div>
              <div>
                <span className="text-cyan-500/50 block">Thermal</span>
                <span className="text-emerald-400 font-bold">{node.tempC}°C</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
