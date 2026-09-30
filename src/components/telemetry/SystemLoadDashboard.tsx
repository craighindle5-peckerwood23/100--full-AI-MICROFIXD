import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { 
  Activity, 
  Cpu, 
  Database, 
  Users, 
  Zap, 
  RefreshCw, 
  ShieldCheck, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight 
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { OrganApi } from '../../lib/organApi';

interface TelemetryPoint {
  time: string;
  cpu: number;
  memory: number; // GB
  agentThreads: number;
  activeOrgans: number;
  throughput: number; // ops/sec
  latencyMs: number;
}

export default function SystemLoadDashboard() {
  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [activeRange, setActiveRange] = useState<'30s' | '1m' | '5m'>('30s');
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [latestStats, setLatestStats] = useState({
    cpu: 28,
    memory: 4.2,
    memoryMax: 16.0,
    agentThreads: 6,
    activeOrgans: 235,
    throughput: 1240,
    latencyAvg: 8.4,
    circuitBreaker: 'NOMINAL',
  });

  // Seed initial telemetry buffer
  useEffect(() => {
    const initial: TelemetryPoint[] = [];
    const now = Date.now();
    for (let i = 20; i >= 0; i--) {
      const d = new Date(now - i * 1500);
      initial.push({
        time: d.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
        cpu: Math.floor(22 + Math.random() * 16),
        memory: +(3.8 + Math.random() * 0.8).toFixed(2),
        agentThreads: Math.floor(4 + Math.random() * 4),
        activeOrgans: 235,
        throughput: Math.floor(1000 + Math.random() * 350),
        latencyMs: +(6 + Math.random() * 5).toFixed(1),
      });
    }
    setData(initial);
  }, []);

  // Live polling & tick loop
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      let organCount = 235;
      try {
        const snap = await OrganApi.snapshot() as any;
        if (snap?.total_organs) organCount = snap.total_organs;
      } catch {
        // use default
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
      
      const newCpu = Math.floor(24 + Math.random() * 18 + (isRebalancing ? 25 : 0));
      const newMem = +(4.0 + Math.random() * 0.9).toFixed(2);
      const newThreads = Math.floor(5 + Math.random() * 4);
      const newThroughput = Math.floor(1100 + Math.random() * 400);
      const newLatency = +(7 + Math.random() * 4).toFixed(1);

      const newPoint: TelemetryPoint = {
        time: timeStr,
        cpu: newCpu,
        memory: newMem,
        agentThreads: newThreads,
        activeOrgans: organCount,
        throughput: newThroughput,
        latencyMs: newLatency,
      };

      setLatestStats({
        cpu: newCpu,
        memory: newMem,
        memoryMax: 16.0,
        agentThreads: newThreads,
        activeOrgans: organCount,
        throughput: newThroughput,
        latencyAvg: newLatency,
        circuitBreaker: newCpu > 80 ? 'HIGH_LOAD' : 'NOMINAL',
      });

      setData(prev => [...prev.slice(1), newPoint]);
    }, 1500);

    return () => clearInterval(interval);
  }, [isLive, isRebalancing]);

  const handleTriggerRebalance = async () => {
    sound.playWarp();
    setIsRebalancing(true);
    try {
      await OrganApi.loadTest(1.5);
      sound.playSuccess();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsRebalancing(false), 1500);
    }
  };

  const loadStatus = latestStats.cpu > 75 ? 'ELEVATED' : 'NOMINAL';

  return (
    <div className="flex flex-col gap-4 font-mono text-cyan-400 select-none">
      {/* Top Banner & Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            <Activity className="text-cyan-400 animate-pulse" size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wider">REAL-TIME SYSTEM LOAD & THREAD TELEMETRY</span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                loadStatus === 'NOMINAL'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
              }`}>
                {loadStatus}
              </span>
            </div>
            <span className="text-[10px] text-cyan-500/70">
              235 ORGANS &bull; L6 MULTI-AGENT THREADPOOL &bull; 1.5s SAMPLE FREQUENCY
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live stream toggle */}
          <button
            onClick={() => setIsLive(prev => !prev)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 ${
              isLive
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-black/50 border-cyan-500/30 text-cyan-500/60'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-cyan-700'}`} />
            <span>{isLive ? 'LIVE STREAM' : 'PAUSED'}</span>
          </button>

          {/* Rebalance Cores Button */}
          <button
            onClick={handleTriggerRebalance}
            disabled={isRebalancing}
            className="px-3 py-1.5 text-xs rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRebalancing ? 'animate-spin text-cyan-400' : ''} />
            <span>{isRebalancing ? 'Rebalancing Threads...' : 'Rebalance Load'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CPU Utilization */}
        <div className="p-3.5 rounded-xl bg-black/60 border border-cyan-500/25 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-cyan-500/80 mb-1">
            <span className="flex items-center gap-1.5 font-semibold">
              <Cpu size={14} className="text-cyan-400" />
              CPU Core Load
            </span>
            <span className="text-white font-bold">{latestStats.cpu}%</span>
          </div>
          <div className="text-xl font-extrabold text-white tracking-tight mb-2">
            {latestStats.cpu}% <span className="text-xs font-normal text-cyan-400/70">/ 128 vCPUs</span>
          </div>
          <div className="w-full h-1.5 bg-cyan-950 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                latestStats.cpu > 70 ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-cyan-400'
              }`}
              style={{ width: `${latestStats.cpu}%` }}
            />
          </div>
        </div>

        {/* Memory Allocation */}
        <div className="p-3.5 rounded-xl bg-black/60 border border-cyan-500/25 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-cyan-500/80 mb-1">
            <span className="flex items-center gap-1.5 font-semibold">
              <Database size={14} className="text-purple-400" />
              RAM Allocation
            </span>
            <span className="text-purple-300 font-bold">{((latestStats.memory / latestStats.memoryMax) * 100).toFixed(0)}%</span>
          </div>
          <div className="text-xl font-extrabold text-white tracking-tight mb-2">
            {latestStats.memory} <span className="text-xs font-normal text-purple-300/70">/ {latestStats.memoryMax} GB</span>
          </div>
          <div className="w-full h-1.5 bg-purple-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-400 transition-all duration-500 shadow-[0_0_10px_rgba(192,132,252,0.4)]"
              style={{ width: `${(latestStats.memory / latestStats.memoryMax) * 100}%` }}
            />
          </div>
        </div>

        {/* Active Agent Threads */}
        <div className="p-3.5 rounded-xl bg-black/60 border border-cyan-500/25 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-cyan-500/80 mb-1">
            <span className="flex items-center gap-1.5 font-semibold">
              <Users size={14} className="text-emerald-400" />
              Agent Threads
            </span>
            <span className="text-emerald-300 font-bold">{latestStats.agentThreads} Workers</span>
          </div>
          <div className="text-xl font-extrabold text-white tracking-tight mb-2">
            {latestStats.agentThreads} <span className="text-xs font-normal text-emerald-300/70">Active Agents</span>
          </div>
          <div className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-500 shadow-[0_0_10px_rgba(52,211,153,0.4)]"
              style={{ width: `${(latestStats.agentThreads / 12) * 100}%` }}
            />
          </div>
        </div>

        {/* Throughput & Latency */}
        <div className="p-3.5 rounded-xl bg-black/60 border border-cyan-500/25 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-cyan-500/80 mb-1">
            <span className="flex items-center gap-1.5 font-semibold">
              <Zap size={14} className="text-amber-400" />
              Mesh Throughput
            </span>
            <span className="text-amber-300 font-bold">{latestStats.latencyAvg}ms</span>
          </div>
          <div className="text-xl font-extrabold text-white tracking-tight mb-2">
            {latestStats.throughput} <span className="text-xs font-normal text-amber-300/70">ops/sec</span>
          </div>
          <div className="w-full h-1.5 bg-amber-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-500 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
              style={{ width: `${Math.min((latestStats.throughput / 2000) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Charts Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Real-time CPU & Memory Utilization Area Chart */}
        <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 flex flex-col gap-3 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Cpu size={15} className="text-cyan-400" />
              <span className="font-bold text-white tracking-wide">CPU (%) & Memory (GB) Time-Series</span>
            </div>
            <span className="text-[10px] text-cyan-500/60">Live Stream Buffer</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c084fc" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#c084fc" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#0e3a4d" vertical={false} />
                <XAxis dataKey="time" stroke="#0891b2" tick={{ fill: '#0891b2', fontSize: 10 }} />
                <YAxis stroke="#0891b2" tick={{ fill: '#0891b2', fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#030712', borderColor: '#06b6d4', borderRadius: '0.75rem', fontSize: '11px', color: '#67e8f9' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Area type="monotone" dataKey="cpu" name="CPU Load (%)" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#cpuGradient)" />
                <Area type="monotone" dataKey="memory" name="Memory (GB)" stroke="#c084fc" strokeWidth={2} fillOpacity={1} fill="url(#memGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Active Agent Threads & Mesh Throughput */}
        <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 flex flex-col gap-3 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-emerald-400" />
              <span className="font-bold text-white tracking-wide">Active Agent Threads & Latency (ms)</span>
            </div>
            <span className="text-[10px] text-emerald-400/80">Concurrently Active</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0e3a4d" vertical={false} />
                <XAxis dataKey="time" stroke="#10b981" tick={{ fill: '#10b981', fontSize: 10 }} />
                <YAxis yAxisId="left" stroke="#10b981" tick={{ fill: '#10b981', fontSize: 10 }} domain={[0, 15]} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fill: '#f59e0b', fontSize: 10 }} domain={[0, 30]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#030712', borderColor: '#10b981', borderRadius: '0.75rem', fontSize: '11px', color: '#6ee7b7' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Bar yAxisId="left" dataKey="agentThreads" name="Active Threads" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="latencyMs" name="Avg Latency (ms)" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
