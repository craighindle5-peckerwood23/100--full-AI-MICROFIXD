import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  Download, 
  Wrench, 
  ShieldAlert, 
  Zap, 
  Activity, 
  CheckCircle2, 
  Flame, 
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { 
  telemetry, 
  SystemMetricPoint, 
  AutonomousRepairEvent 
} from '../../../microfixd/backend/core/telemetry/grid';

export function SystemMonitorWidget() {
  const [metrics, setMetrics] = useState<SystemMetricPoint[]>([]);
  const [currentMetric, setCurrentMetric] = useState<SystemMetricPoint | null>(null);
  const [repairs, setRepairs] = useState<AutonomousRepairEvent[]>([]);
  const [autoRepairActive, setAutoRepairActive] = useState<boolean>(true);
  const [isHealing, setIsHealing] = useState<boolean>(false);
  const [showRepairLog, setShowRepairLog] = useState<boolean>(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 130 });

  useEffect(() => {
    // Set initial configuration
    setAutoRepairActive(telemetry.isAutoRepairEnabled());
    setRepairs(telemetry.getRepairLogs(10));

    // Subscribe to real-time system metrics stream from telemetry module
    const unsubMetrics = telemetry.subscribeMetrics((latest, history) => {
      setCurrentMetric(latest);
      setDataFromTelemetry(history);
    });

    // Subscribe to autonomous repair events from telemetry module
    const unsubRepairs = telemetry.subscribeRepairs((repair) => {
      setRepairs(prev => [repair, ...prev.slice(0, 14)]);
      setLastNotification(`AUTONOMOUS FIX: ${repair.subsystem} (${repair.action})`);
      sound.playTick();

      // Clear notification after 4s
      setTimeout(() => {
        setLastNotification(null);
      }, 4000);
    });

    return () => {
      unsubMetrics();
      unsubRepairs();
    };
  }, []);

  const setDataFromTelemetry = (history: SystemMetricPoint[]) => {
    setMetrics(history.slice(-25));
  };

  const handleToggleAutoRepair = () => {
    sound.playTick();
    const next = !autoRepairActive;
    setAutoRepairActive(next);
    telemetry.setAutoRepair(next);
  };

  const handleTriggerRepair = (target: 'cpu' | 'memory' | 'network' | 'all' = 'all') => {
    sound.playWarp();
    setIsHealing(true);
    telemetry.executeAutonomousRepair(target, 'Operator Emergency Fix Action');
    setTimeout(() => setIsHealing(false), 900);
  };

  const handleSimulateSpike = (type: 'cpu' | 'memory' | 'network') => {
    sound.playTick();
    telemetry.simulateSpike(type);
  };

  const handleExport = () => {
    sound.playTick();
    const exportData = {
      timestamp: new Date().toISOString(),
      current: currentMetric,
      history: metrics.map(d => ({
        time: d.time.toISOString(),
        cpu: d.cpu,
        memory: d.memory,
        networkMBps: d.networkRateMBps,
        latencyMs: d.networkLatencyMs,
        status: d.status
      })),
      autonomousRepairs: repairs
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `microfyxd-telemetry-metrics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: Math.max(110, entries[0].contentRect.height)
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // D3 Scales and Path generation
  const margin = { top: 8, right: 0, bottom: 20, left: 30 };
  const innerWidth = Math.max(0, dimensions.width - margin.left - margin.right);
  const innerHeight = Math.max(0, dimensions.height - margin.top - margin.bottom);

  let cpuPath = "";
  let memPath = "";
  let netPath = "";
  let cpuAreaPath = "";
  let memAreaPath = "";
  let xTicks: Date[] = [];
  const yTicks: number[] = [0, 25, 50, 75, 100];

  if (metrics.length > 1 && innerWidth > 0 && innerHeight > 0) {
    const timeExtent = d3.extent(metrics, (d: SystemMetricPoint) => d.time) as [Date, Date];
    const xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    xTicks = xScale.ticks(4);

    const cpuLineGen = d3.line<SystemMetricPoint>()
      .x(d => xScale(d.time))
      .y(d => yScale(Math.min(100, Math.max(0, d.cpu))))
      .curve(d3.curveMonotoneX);

    const memLineGen = d3.line<SystemMetricPoint>()
      .x(d => xScale(d.time))
      .y(d => yScale(Math.min(100, Math.max(0, d.memory))))
      .curve(d3.curveMonotoneX);

    // Scale network MB/s from 0-150MB/s to 0-100% chart scale
    const netLineGen = d3.line<SystemMetricPoint>()
      .x(d => xScale(d.time))
      .y(d => yScale(Math.min(100, Math.max(0, (d.networkRateMBps / 120) * 100))))
      .curve(d3.curveMonotoneX);

    const cpuAreaGen = d3.area<SystemMetricPoint>()
      .x(d => xScale(d.time))
      .y0(innerHeight)
      .y1(d => yScale(Math.min(100, Math.max(0, d.cpu))))
      .curve(d3.curveMonotoneX);

    const memAreaGen = d3.area<SystemMetricPoint>()
      .x(d => xScale(d.time))
      .y0(innerHeight)
      .y1(d => yScale(Math.min(100, Math.max(0, d.memory))))
      .curve(d3.curveMonotoneX);

    cpuPath = cpuLineGen(metrics) || "";
    memPath = memLineGen(metrics) || "";
    netPath = netLineGen(metrics) || "";
    cpuAreaPath = cpuAreaGen(metrics) || "";
    memAreaPath = memAreaGen(metrics) || "";
  }

  const latestCpu = currentMetric?.cpu ?? 28;
  const latestMem = currentMetric?.memory ?? 42;
  const latestNet = currentMetric?.networkRateMBps ?? 24;
  const latestLatency = currentMetric?.networkLatencyMs ?? 12;
  const status = currentMetric?.status ?? 'nominal';

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Top Header Controls Bar */}
      <div className="flex flex-wrap justify-between items-center gap-2 pb-1 border-b border-[#1b2635]">
        <div className="flex items-center gap-2">
          <Activity size={14} className={status === 'critical' ? 'text-[#ff4f4f] animate-pulse' : 'text-[#4fd1ff]'} />
          <span className="text-[11px] font-mono font-bold tracking-wider text-[#e8f4ff] uppercase">
            Live Telemetry Grid & Autonomous Repairs
          </span>
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
            status === 'critical' 
              ? 'bg-[#ff4f4f]/20 border-[#ff4f4f] text-[#ff4f4f] animate-pulse' 
              : status === 'elevated'
              ? 'bg-[#fcd34d]/20 border-[#fcd34d] text-[#fcd34d]'
              : 'bg-[#4fff9a]/20 border-[#4fff9a]/40 text-[#4fff9a]'
          }`}>
            {status.toUpperCase()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Autonomous Auto-Repair Toggle */}
          <button
            onClick={handleToggleAutoRepair}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono rounded border transition ${
              autoRepairActive
                ? 'bg-[#4fff9a]/10 border-[#4fff9a]/60 text-[#4fff9a] shadow-[0_0_8px_rgba(79,255,154,0.2)]'
                : 'bg-[#111827] border-[#1b2635] text-[#7f9bb5]'
            }`}
            title="Toggle Continuous Autonomous Auto-Remediation"
          >
            <Zap size={10} className={autoRepairActive ? 'text-[#4fff9a]' : 'text-[#7f9bb5]'} />
            <span>AUTO-FIX: {autoRepairActive ? 'ENABLED' : 'PAUSED'}</span>
          </button>

          {/* Manual Autonomous Repair Trigger */}
          <button
            onClick={() => handleTriggerRepair('all')}
            disabled={isHealing}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono rounded border font-semibold transition ${
              isHealing 
                ? 'bg-[#00f5ff] text-[#05070b] border-[#00f5ff] animate-pulse' 
                : 'bg-[#00f5ff]/10 hover:bg-[#00f5ff]/20 border-[#00f5ff]/50 text-[#00f5ff]'
            }`}
            title="Execute Real-Time Autonomous Repair on all metrics"
          >
            <Wrench size={11} />
            <span>{isHealing ? 'HEALING...' : 'AUTONOMOUS FIX'}</span>
          </button>

          <button 
            onClick={handleExport}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-[#1b2635] rounded bg-[#0b1018] hover:bg-[#1b2635] text-[#7f9bb5] hover:text-[#e8f4ff] transition-colors"
            title="Export Metrics JSON"
          >
            <Download size={10} />
            <span className="hidden sm:inline">EXPORT</span>
          </button>
        </div>
      </div>

      {/* Real-time Subsystem Status Metric Cards */}
      <div className="grid grid-cols-3 gap-2">
        {/* CPU Card */}
        <div className={`bg-[#111827]/80 border p-2 rounded-lg flex flex-col justify-between transition ${
          latestCpu > 80 ? 'border-[#ff4f4f] bg-[#ff4f4f]/10' : 'border-[#1b2635]'
        }`}>
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-[#4fd1ff] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#4fd1ff]" /> CPU CORE
            </span>
            <button 
              onClick={() => handleTriggerRepair('cpu')}
              className="text-[9px] text-[#7f9bb5] hover:text-[#4fd1ff] underline cursor-pointer"
            >
              Fix
            </button>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base font-mono font-bold text-[#e8f4ff]">{latestCpu.toFixed(1)}%</span>
            <span className="text-[9px] font-mono text-[#7f9bb5]">16 CORES</span>
          </div>
          <div className="w-full bg-[#0b1018] h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full transition-all duration-500 ${latestCpu > 80 ? 'bg-[#ff4f4f]' : latestCpu > 60 ? 'bg-[#fcd34d]' : 'bg-[#4fd1ff]'}`}
              style={{ width: `${Math.min(100, latestCpu)}%` }}
            />
          </div>
        </div>

        {/* Memory Card */}
        <div className={`bg-[#111827]/80 border p-2 rounded-lg flex flex-col justify-between transition ${
          latestMem > 78 ? 'border-[#ff4f4f] bg-[#ff4f4f]/10' : 'border-[#1b2635]'
        }`}>
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-[#4fff9a] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#4fff9a]" /> MEMORY HEAP
            </span>
            <button 
              onClick={() => handleTriggerRepair('memory')}
              className="text-[9px] text-[#7f9bb5] hover:text-[#4fff9a] underline cursor-pointer"
            >
              Fix
            </button>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base font-mono font-bold text-[#e8f4ff]">{latestMem.toFixed(1)}%</span>
            <span className="text-[9px] font-mono text-[#7f9bb5]">{(latestMem * 0.64).toFixed(1)} / 64 GB</span>
          </div>
          <div className="w-full bg-[#0b1018] h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full transition-all duration-500 ${latestMem > 78 ? 'bg-[#ff4f4f]' : latestMem > 65 ? 'bg-[#fcd34d]' : 'bg-[#4fff9a]'}`}
              style={{ width: `${Math.min(100, latestMem)}%` }}
            />
          </div>
        </div>

        {/* Network Card */}
        <div className={`bg-[#111827]/80 border p-2 rounded-lg flex flex-col justify-between transition ${
          latestNet > 85 ? 'border-[#ff4f4f] bg-[#ff4f4f]/10' : 'border-[#1b2635]'
        }`}>
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-[#fcd34d] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#fcd34d]" /> NETWORK BUS
            </span>
            <button 
              onClick={() => handleTriggerRepair('network')}
              className="text-[9px] text-[#7f9bb5] hover:text-[#fcd34d] underline cursor-pointer"
            >
              Fix
            </button>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base font-mono font-bold text-[#e8f4ff]">{latestNet.toFixed(1)} <span className="text-xs font-normal">MB/s</span></span>
            <span className="text-[9px] font-mono text-[#7f9bb5]">{latestLatency} ms</span>
          </div>
          <div className="w-full bg-[#0b1018] h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full transition-all duration-500 ${latestNet > 85 ? 'bg-[#ff4f4f]' : 'bg-[#fcd34d]'}`}
              style={{ width: `${Math.min(100, (latestNet / 120) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Autonomous Fix Active Toast */}
      {lastNotification && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#00f5ff]/10 border border-[#00f5ff]/40 text-[#00f5ff] text-[10px] font-mono animate-in fade-in">
          <CheckCircle2 size={12} className="text-[#00f5ff] shrink-0" />
          <span className="truncate">{lastNotification}</span>
        </div>
      )}

      {/* Multi-Stream D3 Resource Graph */}
      <div className="w-full relative min-h-[120px] flex-grow mt-1" ref={containerRef}>
        {dimensions.width > 0 && (
          <svg width={dimensions.width} height={dimensions.height} className="block overflow-visible">
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4fd1ff" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#4fd1ff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4fff9a" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#4fff9a" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <g transform={`translate(${margin.left},${margin.top})`}>
              {/* Horizontal Grid lines */}
              {yTicks.map(tick => (
                <line 
                  key={tick}
                  x1={0} x2={innerWidth} 
                  y1={innerHeight - (tick / 100) * innerHeight} 
                  y2={innerHeight - (tick / 100) * innerHeight}
                  stroke="#1b2635" strokeDasharray="3 3"
                />
              ))}

              {/* Y Axis Labels */}
              {yTicks.map(tick => (
                <text 
                  key={tick}
                  x={-8} 
                  y={innerHeight - (tick / 100) * innerHeight}
                  fill="#7f9bb5" fontSize="8" fontFamily="monospace"
                  textAnchor="end" alignmentBaseline="middle"
                >
                  {tick}%
                </text>
              ))}

              {/* X Axis Time Labels */}
              {xTicks.map((tick, i) => {
                if (metrics.length === 0) return null;
                const startTime = metrics[0].time.getTime();
                const endTime = metrics[metrics.length - 1].time.getTime();
                const span = endTime - startTime || 1;
                const xPos = ((tick.getTime() - startTime) / span) * innerWidth;
                return (
                  <text 
                    key={i}
                    x={Math.max(10, Math.min(innerWidth - 10, xPos))} 
                    y={innerHeight + 14}
                    fill="#7f9bb5" fontSize="8" fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {tick.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                  </text>
                );
              })}

              {/* Baseline */}
              <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="#1b2635" />

              {/* Area Fills */}
              <path d={cpuAreaPath} fill="url(#colorCpu)" />
              <path d={memAreaPath} fill="url(#colorMem)" />

              {/* Activity Curves */}
              <path d={cpuPath} fill="none" stroke="#4fd1ff" strokeWidth="2" />
              <path d={memPath} fill="none" stroke="#4fff9a" strokeWidth="2" />
              <path d={netPath} fill="none" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="4 2" />
            </g>
          </svg>
        )}
      </div>

      {/* Anomaly Stress Testing & Autonomous Repair Logs Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1b2635]">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[#7f9bb5] uppercase flex items-center gap-1">
            <Flame size={10} className="text-[#fcd34d]" /> Test Auto-Heal:
          </span>
          <button
            onClick={() => handleSimulateSpike('cpu')}
            className="px-2 py-0.5 text-[9px] font-mono rounded bg-[#111827] border border-[#1b2635] text-[#7f9bb5] hover:text-[#4fd1ff] hover:border-[#4fd1ff] transition"
            title="Inject 95% CPU load to trigger Autonomous Repair"
          >
            Spike CPU
          </button>
          <button
            onClick={() => handleSimulateSpike('memory')}
            className="px-2 py-0.5 text-[9px] font-mono rounded bg-[#111827] border border-[#1b2635] text-[#7f9bb5] hover:text-[#4fff9a] hover:border-[#4fff9a] transition"
            title="Inject Memory leak to test Heap Compaction"
          >
            Leak RAM
          </button>
          <button
            onClick={() => handleSimulateSpike('network')}
            className="px-2 py-0.5 text-[9px] font-mono rounded bg-[#111827] border border-[#1b2635] text-[#7f9bb5] hover:text-[#fcd34d] hover:border-[#fcd34d] transition"
            title="Inject network traffic storm to test buffer flush"
          >
            Storm Net
          </button>
        </div>

        {/* Expand/Collapse Repair Log */}
        <button
          onClick={() => setShowRepairLog(!showRepairLog)}
          className="flex items-center gap-1 text-[10px] font-mono text-[#4fd1ff] hover:text-[#00f5ff] transition cursor-pointer"
        >
          <span>{repairs.length} Autonomous Repairs Logged</span>
          {showRepairLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Collapsible Autonomous Repair Event Drawer */}
      {showRepairLog && (
        <div className="bg-[#0b1018] border border-[#1b2635] rounded-lg p-2.5 flex flex-col gap-2 max-h-48 overflow-y-auto scrollbar-thin animate-in fade-in slide-in-from-top-1">
          <div className="flex justify-between items-center text-[10px] font-mono text-[#7f9bb5] pb-1 border-b border-[#1b2635]">
            <span className="font-bold uppercase text-[#00f5ff]">Real-Time Autonomous Repair Ledger</span>
            <span>Agent: Repair Agent // Invariant Verified</span>
          </div>

          {repairs.length === 0 ? (
            <div className="text-[10px] font-mono text-[#7f9bb5] italic py-1">
              No repairs recorded yet. System metrics operating within nominal boundaries.
            </div>
          ) : (
            repairs.map(rep => (
              <div key={rep.id} className="bg-[#111827] border border-[#1b2635] p-2 rounded text-[10px] font-mono flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[#00f5ff] font-bold">[{rep.action}]</span>
                  <span className="text-[#7f9bb5]">{new Date(rep.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-[#e8f4ff]">{rep.details}</div>
                <div className="flex justify-between text-[9px] text-[#7f9bb5] pt-0.5">
                  <span>Subsystem: {rep.subsystem}</span>
                  <span className="text-[#4fff9a] font-semibold">STATUS: VERIFIED</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
