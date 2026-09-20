import React, { useState, useEffect } from 'react';
import { SystemMetrics } from '../../types';
import { Activity, Download, Filter, Radio, ShieldCheck } from 'lucide-react';
import { sound } from '../../utils/audio';

export default function TelemetryPanel() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 18,
    memory: 42,
    gpu: 24,
    network: 64,
    activeAgents: 6,
    quantumCoherence: 99.4,
    tokensPerSec: 184
  });

  const [filter, setFilter] = useState<string>('ALL');
  const [events, setEvents] = useState<Array<{ time: string; src: string; msg: string; type: 'info' | 'success' | 'warn' }>>([
    { time: '10:45:01.002', src: 'SYS.CORE', msg: 'Telemetry pulse synchronized with HBM3e cache.', type: 'info' },
    { time: '10:45:02.140', src: 'AGENT.CARTER', msg: 'LangGraph token velocity peaked at 184 t/s.', type: 'info' },
    { time: '10:45:04.992', src: 'SEC.KERNEL', msg: 'Sentinel anomaly audit: 0 violations, 100% compliance.', type: 'success' },
    { time: '10:45:05.110', src: 'INFRA', msg: 'Node Alpha-01 thermal equilibrium sustained at 54°C.', type: 'success' },
    { time: '10:45:08.330', src: 'FEDERATION', msg: 'Sigma-09 MCP link verified with zero packet loss.', type: 'info' }
  ]);

  // Simulate telemetry updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.min(100, Math.max(5, prev.cpu + (Math.random() * 8 - 4))),
        memory: Math.min(100, Math.max(20, prev.memory + (Math.random() * 3 - 1.5))),
        gpu: Math.min(100, Math.max(10, prev.gpu + (Math.random() * 10 - 5))),
        network: Math.min(200, Math.max(10, prev.network + (Math.random() * 20 - 10))),
        activeAgents: 6,
        quantumCoherence: +(99.2 + Math.random() * 0.7).toFixed(2),
        tokensPerSec: Math.floor(170 + Math.random() * 40)
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    sound.playWarp();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ metrics, events, timestamp: new Date().toISOString() }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `microfyxd-telemetry-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredEvents = filter === 'ALL' 
    ? events 
    : events.filter(e => e.src.includes(filter));

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Activity className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">TELEMETRY & OBSERVABILITY // CHAPTER 9 & 18</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            HIGH-RESOLUTION SAMPLING (100Hz)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-xs text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            <Download size={13} /> Export Snapshot
          </button>
        </div>
      </div>

      {/* Primary Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard title="CPU Mesh" value={metrics.cpu} unit="%" />
        <MetricCard title="HBM3e Memory" value={metrics.memory} unit="%" />
        <MetricCard title="H100 GPU" value={metrics.gpu} unit="%" />
        <MetricCard title="Interconnect" value={metrics.network} unit=" MB/s" isGauge={false} />
        <MetricCard title="Tokens / Sec" value={metrics.tokensPerSec || 184} unit=" t/s" isGauge={false} />
        <MetricCard title="Q-Coherence" value={metrics.quantumCoherence || 99.4} unit="%" />
      </div>

      {/* Live Event Stream Panel */}
      <div className="flex-1 flex flex-col border border-cyan-500/30 rounded-2xl bg-black/60 p-4 min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-cyan-500/15 pb-2">
          <div className="flex items-center gap-2 text-xs text-white font-semibold uppercase tracking-wider">
            <Radio size={14} className="text-cyan-400 animate-pulse" />
            <span>REAL-TIME OBSERVABILITY EVENT FEED</span>
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            <Filter size={12} className="text-cyan-500/50" />
            {['ALL', 'SYS.CORE', 'AGENT', 'SEC.KERNEL', 'INFRA'].map(f => (
              <button
                key={f}
                onClick={() => { sound.playTick(); setFilter(f); }}
                className={`px-2 py-0.5 rounded transition-all border ${filter === f ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'border-cyan-500/15 text-cyan-500/60 hover:text-white'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto space-y-2 font-mono text-xs flex-1 pr-1">
          {filteredEvents.map((evt, i) => (
            <EventRow key={i} time={evt.time} src={evt.src} msg={evt.msg} type={evt.type} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, unit, isGauge = true }: { title: string; value: number; unit: string; isGauge?: boolean }) {
  const displayValue = value.toFixed(1);
  const color = value > 80 ? 'text-red-400' : value > 60 ? 'text-yellow-400' : 'text-cyan-300';
  const barColor = value > 80 ? 'bg-red-500' : value > 60 ? 'bg-yellow-500' : 'bg-cyan-400';

  return (
    <div className="border border-cyan-500/20 rounded-xl bg-black/50 p-3 flex flex-col justify-between">
      <div className="text-cyan-500/60 font-mono text-[9px] uppercase tracking-widest">{title}</div>
      
      <div className={`text-xl md:text-2xl font-mono font-bold ${color} my-1`}>
        {displayValue}<span className="text-[10px] text-cyan-500/60 font-normal ml-0.5">{unit}</span>
      </div>

      {isGauge && (
        <div className="w-full h-1 bg-cyan-950 rounded-full overflow-hidden">
          <div 
            className={`h-full ${barColor} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EventRow({ time, src, msg, type }: { key?: React.Key; time: string; src: string; msg: string; type: 'info' | 'success' | 'warn' }) {
  const colors = {
    info: 'text-cyan-400/80',
    success: 'text-emerald-400/90',
    warn: 'text-yellow-400/90',
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 ${colors[type]} pb-2 border-b border-cyan-500/10 last:border-0 text-[11px]`}>
      <span className="opacity-50 text-[10px] w-24 flex-shrink-0 font-mono">[{time}]</span>
      <span className="w-auto sm:w-28 flex-shrink-0 sm:border-r border-cyan-500/20 font-semibold">{src}</span>
      <span className="text-white/80 font-mono">{msg}</span>
    </div>
  );
}
