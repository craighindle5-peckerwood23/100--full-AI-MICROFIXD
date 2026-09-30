import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Server, 
  Cpu, 
  Activity, 
  ShieldCheck, 
  Zap, 
  RefreshCw, 
  Thermometer, 
  CheckCircle2, 
  Power,
  Play,
  Layers,
  Search,
  Check,
  AlertCircle
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { OrganApi } from '../../lib/organApi';

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

interface OrganItem {
  id: string;
  name: string;
  layer: string;
  status: string;
  error_count?: number;
  metrics?: {
    avg_latency_ms: number;
    success_rate: number;
    total_calls: number;
  };
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

  // 235 Organ Registry State
  const [organs, setOrgans] = useState<OrganItem[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string>('all');
  const [organSearch, setOrganSearch] = useState<string>('');
  const [loadingAll, setLoadingAll] = useState(false);
  const [runningLoadTest, setRunningLoadTest] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [lastCallResult, setLastCallResult] = useState<any>(null);
  const [loadTestReport, setLoadTestReport] = useState<any>(null);

  const fetchOrgans = async () => {
    try {
      const res = await OrganApi.getAll() as { organs: OrganItem[] };
      if (res && Array.isArray(res.organs)) {
        setOrgans(res.organs);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchOrgans();
    const interval = setInterval(fetchOrgans, 15000);
    return () => clearInterval(interval);
  }, []);

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

  const handleLoadAllOrgans = async () => {
    sound.playWarp();
    setLoadingAll(true);
    try {
      const res = await OrganApi.loadAll() as any;
      if (res && res.organs) {
        setOrgans(res.organs);
      }
      sound.playSuccess();
      await fetchOrgans();
    } catch (err: any) {
      console.warn("Load all error:", err);
    } finally {
      setLoadingAll(false);
    }
  };

  const handleRunLoadTest = async () => {
    sound.playWarp();
    setRunningLoadTest(true);
    setLoadTestReport(null);
    try {
      const report = await OrganApi.loadTest(2.0);
      setLoadTestReport(report);
      sound.playSuccess();
      await fetchOrgans();
    } catch (err) {
      console.warn("Load test error:", err);
    } finally {
      setRunningLoadTest(false);
    }
  };

  const handleExecuteSingleOrgan = async (id: string) => {
    sound.playTick();
    setActiveCallId(id);
    setLastCallResult(null);
    try {
      const res = await OrganApi.execute(id, 'health', { test: true, timestamp: Date.now() });
      setLastCallResult({ id, result: res });
      sound.playSuccess();
      await fetchOrgans();
    } catch (err: any) {
      setLastCallResult({ id, error: err?.message || String(err) });
    } finally {
      setActiveCallId(null);
    }
  };

  const filteredOrgans = organs.filter(o => {
    const matchesLayer = selectedLayer === 'all' || o.layer === selectedLayer;
    const matchesSearch = !organSearch || o.name.toLowerCase().includes(organSearch.toLowerCase()) || o.id.toLowerCase().includes(organSearch.toLowerCase());
    return matchesLayer && matchesSearch;
  });

  const layers = ['all', 'cognition', 'perception', 'autonomy', 'memory', 'agents', 'security', 'execution', 'federation', 'voice', 'evolution'];

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Server className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">INFRASTRUCTURE & 235-ORGAN MESH // CHAPTER 6</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            {organs.length || 235} ORGANS LIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadAllOrgans}
            disabled={loadingAll}
            className="px-3 py-1.5 text-xs rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingAll ? 'animate-spin' : ''} />
            {loadingAll ? 'Initializing Organs...' : 'Load All 235 Organs'}
          </button>

          <button
            onClick={handleRunLoadTest}
            disabled={runningLoadTest}
            className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/60 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50"
          >
            <Zap size={13} className={runningLoadTest ? 'animate-bounce text-yellow-300' : 'text-emerald-400'} />
            {runningLoadTest ? '200% Load Running...' : 'Run 200% Load Test'}
          </button>

          <button
            onClick={handleRebalance}
            disabled={isRebalancing}
            className="px-3 py-1.5 text-xs rounded-lg border border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-300 flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={isRebalancing ? 'animate-spin' : ''} />
            Rebalance Cores
          </button>
        </div>
      </div>

      {/* Load Test Results Banner if active */}
      {loadTestReport && (
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs flex flex-wrap items-center justify-between gap-3 text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <strong className="text-white">200% Capacity Load Test Completed:</strong>
            <span>{loadTestReport.successfulOperations}/{loadTestReport.totalOperationsDispatched} Ops ({loadTestReport.successRate})</span>
            <span>• Throughput: {loadTestReport.throughputOpsPerSec} ops/sec</span>
            <span>• Latency: {loadTestReport.latency?.avgMs}ms avg</span>
          </div>
          <button 
            onClick={() => setLoadTestReport(null)}
            className="text-[10px] text-emerald-400/60 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split: Compute Nodes & 235 Organs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Cluster Hardware Nodes */}
        <div className="lg:col-span-4 flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="text-[11px] uppercase tracking-widest text-cyan-500/60 flex items-center justify-between">
            <span>Primary Compute Grid</span>
            <span className="text-emerald-400 font-bold">{quantumCoherence}% Quantum Coherence</span>
          </div>

          {nodes.map(node => (
            <div
              key={node.id}
              className="p-3.5 rounded-xl border border-cyan-500/25 bg-black/60 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-white tracking-wide">{node.name}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-semibold uppercase ${
                    node.status === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                  }`}>
                    {node.status}
                  </span>
                </div>
                <div className="text-[11px] text-cyan-300/80 mb-2">{node.role}</div>

                <div className="flex items-center justify-between text-[11px] text-cyan-400/70 mb-1">
                  <span>Load</span>
                  <strong className="text-white">{node.load}%</strong>
                </div>
                <div className="h-1.5 w-full bg-cyan-950 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full transition-all duration-500 ${node.load > 70 ? 'bg-yellow-400' : 'bg-cyan-400'}`}
                    style={{ width: `${node.load}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 text-center text-[10px] border-t border-cyan-500/10 pt-2 text-cyan-500/70">
                <div><span>{node.vCpus} vCPUs</span></div>
                <div className="truncate"><span className="text-cyan-300">{node.gpuUnit}</span></div>
                <div><span className="text-emerald-400">{node.tempC}°C</span></div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: 235 Organ Registry & Live Invocation Panel */}
        <div className="lg:col-span-8 flex flex-col gap-2 overflow-hidden border border-cyan-500/20 rounded-2xl bg-black/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-cyan-500/15">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-cyan-400" />
              <span className="text-xs text-white font-bold tracking-wide">ORGAN MESH REPOSITORY ({filteredOrgans.length})</span>
            </div>

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-cyan-500/50" />
              <input
                type="text"
                value={organSearch}
                onChange={e => setOrganSearch(e.target.value)}
                placeholder="Filter by organ ID or name..."
                className="bg-black/60 border border-cyan-500/30 rounded-lg pl-8 pr-2 py-1 text-xs text-white placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Layer Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
            {layers.map(layer => (
              <button
                key={layer}
                onClick={() => setSelectedLayer(layer)}
                className={`px-2.5 py-0.5 rounded-full capitalize whitespace-nowrap transition-all ${
                  selectedLayer === layer
                    ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-200'
                    : 'bg-black/40 border border-cyan-500/20 text-cyan-500/60 hover:text-cyan-300'
                }`}
              >
                {layer}
              </button>
            ))}
          </div>

          {/* Organs Table / Grid */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
            {filteredOrgans.map(organ => (
              <div
                key={organ.id}
                className="p-2 rounded-lg bg-black/40 border border-cyan-500/15 hover:border-cyan-500/40 flex items-center justify-between gap-3 text-xs transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${organ.status === 'active' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold truncate">{organ.name}</span>
                      <span className="text-[10px] text-cyan-500/60 font-mono">[{organ.id}]</span>
                    </div>
                    <div className="text-[10px] text-cyan-400/60 flex items-center gap-2">
                      <span className="uppercase">Layer: {organ.layer}</span>
                      {organ.metrics && (
                        <span>• Latency: {Math.round(organ.metrics.avg_latency_ms)}ms</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-semibold ${
                    organ.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {organ.status}
                  </span>

                  <button
                    onClick={() => handleExecuteSingleOrgan(organ.id)}
                    disabled={activeCallId === organ.id}
                    className="p-1.5 rounded bg-cyan-950/60 border border-cyan-500/30 hover:bg-cyan-900/60 text-cyan-300 hover:text-white transition-all disabled:opacity-50"
                    title={`Test ${organ.name}`}
                  >
                    <Play size={11} className={activeCallId === organ.id ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Last Result Drawer if present */}
          {lastCallResult && (
            <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-[11px] text-cyan-300 flex items-center justify-between">
              <span className="truncate">
                <strong>Organ {lastCallResult.id}:</strong> {JSON.stringify(lastCallResult.result || lastCallResult.error).slice(0, 120)}...
              </span>
              <button 
                onClick={() => setLastCallResult(null)}
                className="text-[10px] text-cyan-400/60 hover:text-white ml-2"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
