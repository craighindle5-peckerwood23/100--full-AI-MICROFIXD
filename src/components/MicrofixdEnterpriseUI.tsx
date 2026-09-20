import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cpu, 
  Activity, 
  ShieldCheck, 
  Terminal, 
  Play, 
  Layers, 
  Server, 
  Zap, 
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink
} from 'lucide-react';
import { agentRegistry } from '../../microfixd/core/agents/registry';
import { AgentExecutionEngine } from '../../microfixd/core/agents/executionEngine';
import { memory } from '../../microfixd/backend/core/memory/state';
import { telemetry } from '../../microfixd/backend/core/telemetry/grid';
import { missionEngine } from '../../microfixd/backend/core/mission/engine';

interface Props {
  onOpenOSChamber?: () => void;
}

export default function MicrofixdEnterpriseUI({ onOpenOSChamber }: Props) {
  const [activeStage, setActiveStage] = useState(0);
  const [activeTab, setActiveTab] = useState<'mission' | 'ai' | 'agents' | 'workspace' | 'system'>('mission');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [lastAgentResult, setLastAgentResult] = useState<{
    agent: string;
    action: string;
    summary: string;
    timestamp: number;
  } | null>(null);

  // Live metrics state
  const [metrics, setMetrics] = useState({
    neural: 98,
    memory: 76,
    threat: 100,
    sync: 82,
    cpu: 32,
    ram: 41,
    gpu: 28,
    network: '3.2 GB/s',
    autonomousTasks: 17
  });

  // Stage names and descriptors matching microfixd interface.html
  const stages = [
    {
      id: 'boot',
      title: 'Boot Sequence',
      subtitle: 'System initializing',
      body: 'Loading Neural Architecture…\nBringing Memory Tasks online…\nLinking Agents, Workspace, and Telemetry…',
      status: 'STATUS: NOMINAL',
      type: 'text'
    },
    {
      id: 'emergence',
      title: 'Emergence',
      subtitle: 'AI takes shape',
      body: 'Constructing cognitive mesh…\nActivating perception nodes…\nBinding mission core to agents…',
      wireframe: 'Glowing Wireframe Head Forming',
      type: 'wireframe'
    },
    {
      id: 'awareness',
      title: 'Awareness',
      subtitle: 'System online',
      body: 'Conscious loop engaged…\nTelemetry linked to intelligence core…\nThreat grid synchronized with mission state…',
      head: 'Fully Formed Digital Head',
      type: 'head'
    },
    {
      id: 'greeting',
      title: 'Greeting',
      subtitle: 'AI introduces itself',
      greeting: true,
      type: 'greeting'
    },
    {
      id: 'interaction',
      title: 'Interaction',
      subtitle: 'Awaits user command',
      type: 'interaction'
    },
    {
      id: 'interface',
      title: 'Full Interface',
      subtitle: 'System ready',
      visual: 'AI Head + Holographic Panels Active',
      type: 'interface'
    }
  ];

  // Stage progression interval
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage(prev => (prev + 1) % stages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [stages.length]);

  // Handle Action Pill Click (Calls /api/agents/dispatch with fallback to in-memory engine)
  const handleAction = async (action: string) => {
    setActiveAction(action);
    console.log('[Microfixed UI] User selected action:', action);

    try {
      // 1. Attempt API route dispatch
      const res = await fetch('/api/agents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (res && res.ok) {
        let data: any;
        if (typeof res.json === 'function') {
          data = await res.json();
        } else {
          const text = await res.text();
          data = JSON.parse(text);
        }
        setLastAgentResult({
          agent: data.agent,
          action: data.action,
          summary: data.result?.summary || 'Task dispatched and completed successfully.',
          timestamp: Date.now()
        });
      } else {
        throw new Error('API route returned status ' + (res ? res.status : 'error'));
      }
    } catch (err) {
      console.warn('[Microfixed UI] Fetch fallback to direct execution engine:', err);
      // Fallback: direct in-browser execution with AgentExecutionEngine
      const engine = new AgentExecutionEngine(agentRegistry as any);
      const result = await engine.runAgent(action.toLowerCase(), {
        mission: missionEngine.getCurrentMission(),
        memory,
        telemetry
      });

      const agentObj = (agentRegistry as any)[action.toLowerCase()];
      setLastAgentResult({
        agent: agentObj?.name || `${action.toUpperCase()} Agent`,
        action,
        summary: result.summary,
        timestamp: Date.now()
      });
    } finally {
      // Dynamically fluctuate metrics slightly to reflect activity
      setMetrics(prev => ({
        ...prev,
        neural: Math.min(100, Math.max(85, prev.neural + Math.floor(Math.random() * 5 - 2))),
        cpu: Math.min(100, Math.max(20, prev.cpu + Math.floor(Math.random() * 12 - 5))),
        ram: Math.min(100, Math.max(30, prev.ram + Math.floor(Math.random() * 6 - 3))),
        gpu: Math.min(100, Math.max(15, prev.gpu + Math.floor(Math.random() * 8 - 4)))
      }));
      setActiveAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#020308] text-[#e8f4ff] font-sans p-3 md:p-6 flex flex-col justify-between select-none relative overflow-x-hidden">
      {/* Background ambient radial gradients */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#111827_0%,_#05070b_55%,_#020308_100%)] pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(79,209,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(79,209,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />

      <div className="relative z-10 max-w-[1440px] w-full mx-auto flex flex-col gap-4">
        {/* TOP UTILITY BAR */}
        <header className="flex items-center justify-between border-b border-[#1b2635] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4fd1ff] shadow-[0_0_8px_#4fd1ff] animate-pulse" />
            <h1 className="text-xs uppercase tracking-[0.2em] font-bold text-[#4fd1ff]">
              MICROFIXED v2.5 ENTERPRISE
            </h1>
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-[#7f9bb5] bg-[#0b1018] px-2 py-0.5 rounded border border-[#1b2635]">
              Level 6 Autonomous Node
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenOSChamber && (
              <button
                id="switch-chamber-btn"
                onClick={onOpenOSChamber}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider bg-[#0b1018] text-[#4fd1ff] border border-[#2b8fb8]/50 hover:bg-[#4fd1ff] hover:text-[#020308] transition-all shadow-[0_0_12px_rgba(79,209,255,0.2)]"
              >
                <Sparkles size={13} />
                <span>Enter Synthetic Chamber</span>
              </button>
            )}
            <a
              href="/microfixd_interface.html"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-[#7f9bb5] hover:text-[#4fd1ff] px-2.5 py-1 rounded border border-[#1b2635] bg-[#05070b]"
            >
              <ExternalLink size={12} />
              <span className="hidden md:inline">Standalone HTML</span>
            </a>
          </div>
        </header>

        {/* TOP: 6 ACTIVATION STAGES */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {stages.map((stage, idx) => {
            const isActive = activeStage === idx;
            return (
              <motion.div
                key={stage.id}
                onClick={() => setActiveStage(idx)}
                whileHover={{ scale: 1.01 }}
                className={`relative rounded-xl border p-2.5 cursor-pointer transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[140px] ${
                  isActive 
                    ? 'border-[#4fd1ff] bg-[#0b1018] shadow-[0_0_18px_rgba(79,209,255,0.35)] ring-1 ring-[#4fd1ff]/40' 
                    : 'border-[#1b2635] bg-[#070b12]/80 hover:border-[#2b8fb8]/40'
                }`}
              >
                {/* Ambient glow accent inside active stage card */}
                {isActive && (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,209,255,0.18),transparent_70%)] pointer-events-none" />
                )}

                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1">
                      <span className={`font-semibold ${isActive ? 'text-[#4fd1ff]' : 'text-[#7f9bb5]'}`}>
                        {stage.title}
                      </span>
                      <span className="text-[#7f9bb5] text-[9px]">{stage.subtitle}</span>
                    </div>

                    {stage.type === 'text' && (
                      <div className="text-[10px] leading-relaxed text-[#e8f4ff] whitespace-pre-line mt-1">
                        {stage.body}
                        <div className="mt-1 text-[#4fff9a] font-mono text-[9px] tracking-widest">
                          {stage.status}
                        </div>
                      </div>
                    )}

                    {stage.type === 'wireframe' && (
                      <div className="flex flex-col">
                        <div className="text-[10px] leading-tight text-[#e8f4ff] whitespace-pre-line">
                          {stage.body}
                        </div>
                        <div className="mt-2 h-11 rounded border border-dashed border-[#2b8fb8] bg-[radial-gradient(circle,rgba(79,209,255,0.14),transparent_60%)] flex items-center justify-center text-[9px] uppercase tracking-widest text-[#4fd1ff] font-mono text-center px-1">
                          {stage.wireframe}
                        </div>
                      </div>
                    )}

                    {stage.type === 'head' && (
                      <div className="flex flex-col">
                        <div className="text-[10px] leading-tight text-[#e8f4ff] whitespace-pre-line">
                          {stage.body}
                        </div>
                        <div className="mt-2 h-11 rounded border border-solid border-[#4fff9a]/50 bg-[radial-gradient(circle,rgba(79,255,154,0.14),transparent_60%)] flex items-center justify-center text-[9px] uppercase tracking-widest text-[#4fff9a] font-mono text-center px-1">
                          {stage.head}
                        </div>
                      </div>
                    )}

                    {stage.type === 'greeting' && (
                      <div className="text-[10px] leading-relaxed text-[#e8f4ff] mt-1">
                        Good Morning, I am <span className="text-[#4fd1ff] font-semibold">Microfixed</span>.
                        <br />All systems operational.
                        <br /><span className="text-[#4fff9a]">17 tasks</span> completed overnight.
                        <br />How may I assist you today?
                      </div>
                    )}

                    {stage.type === 'interaction' && (
                      <div className="text-[10px] leading-tight text-[#e8f4ff]">
                        I am listening. What would you like to accomplish?
                        <div className="flex flex-wrap gap-1 mt-2">
                          {['optimize', 'build', 'analyze', 'automate', 'deploy', 'research'].map((act) => (
                            <button
                              key={act}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction(act);
                              }}
                              disabled={activeAction === act}
                              className={`px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider border transition-all ${
                                activeAction === act
                                  ? 'bg-[#4fd1ff] text-[#020308] border-[#4fd1ff]'
                                  : 'border-[#2b8fb8] text-[#4fd1ff] hover:bg-[#4fd1ff] hover:text-[#020308]'
                              }`}
                            >
                              {activeAction === act ? '...' : act}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {stage.type === 'interface' && (
                      <div className="h-20 rounded border border-solid border-[#00f5ff]/60 bg-[radial-gradient(circle_at_center,rgba(79,209,255,0.22),transparent_70%)] flex items-center justify-center text-[9px] uppercase tracking-widest text-[#00f5ff] font-mono text-center px-2">
                        {stage.visual}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[9px] text-[#7f9bb5]">
                    <span>STAGE {idx + 1}/6</span>
                    {isActive && (
                      <span className="text-[#4fff9a] flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4fff9a] animate-ping" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </section>

        {/* FEEDBACK BANNER (IF AGENT EXECUTED) */}
        <AnimatePresence>
          {lastAgentResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-xl border border-[#4fd1ff]/40 bg-[#0b1018] shadow-[0_0_20px_rgba(79,209,255,0.15)] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-full bg-[#4fd1ff]/10 text-[#4fd1ff]">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div className="font-semibold text-[#4fd1ff] uppercase tracking-wider text-[11px]">
                    [{lastAgentResult.agent}] Action Dispatched: {lastAgentResult.action.toUpperCase()}
                  </div>
                  <div className="text-[#e8f4ff] text-[11px] mt-0.5">
                    {lastAgentResult.summary}
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-mono text-[#7f9bb5] shrink-0">
                {new Date(lastAgentResult.timestamp).toLocaleTimeString()} · STATUS: OK
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM: ENTERPRISE DASHBOARD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT PANEL: Mission / AI / Insights (Col 7) */}
          <div className="lg:col-span-7 bg-[#0b1018] rounded-2xl border border-[#1b2635] p-3.5 md:p-4 flex flex-col gap-3 relative overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,209,255,0.08),transparent_60%)] pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-3">
              {/* Header with Navigation Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2635] pb-2.5">
                <div className="text-xs uppercase tracking-[0.16em] font-semibold text-[#4fd1ff]">
                  MICROFIXED v2.5 ENTERPRISE
                </div>

                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
                  {(['mission', 'ai', 'agents', 'workspace', 'system'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-2.5 py-1 rounded-full text-[10px] transition-all ${
                        activeTab === tab
                          ? 'bg-[#4fd1ff] text-[#020308] font-bold shadow-[0_0_10px_rgba(79,209,255,0.4)]'
                          : 'text-[#7f9bb5] hover:text-[#e8f4ff] hover:bg-[#111827]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Boot Log strip */}
              <div className="text-[11px] text-[#7f9bb5] leading-relaxed bg-[#05070b]/60 px-3 py-1.5 rounded-lg border border-[#1b2635] font-mono">
                Boot Log: <span className="text-[#4fd1ff]">Neural Processing</span> online · Memory tasks linked · Threat detection armed · Data sync grid ready.
              </div>

              {/* Panel body with 2 sub-columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Active Operations */}
                <div className="bg-[#05070b] border border-[#1b2635] rounded-xl p-3 flex flex-col gap-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-[#7f9bb5] font-semibold flex items-center justify-between">
                    <span>Active Operations</span>
                    <span className="text-[9px] text-[#4fff9a]">LIVE 60Hz</span>
                  </div>

                  {/* Operation row: Neural */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-[#e8f4ff]">Neural Processing</span>
                      <span className="text-[#4fd1ff] font-mono">{metrics.neural}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111827] rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${metrics.neural}%` }} 
                        className="h-full bg-gradient-to-r from-[#4fd1ff] to-[#4fff9a] rounded-full"
                      />
                    </div>
                  </div>

                  {/* Operation row: Memory */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-[#e8f4ff]">Memory Optimization</span>
                      <span className="text-[#4fd1ff] font-mono">{metrics.memory}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111827] rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${metrics.memory}%` }} 
                        className="h-full bg-gradient-to-r from-[#4fd1ff] to-[#4fff9a] rounded-full"
                      />
                    </div>
                  </div>

                  {/* Operation row: Threat */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-[#e8f4ff]">Threat Detection</span>
                      <span className="text-[#4fd1ff] font-mono">{metrics.threat}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111827] rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${metrics.threat}%` }} 
                        className="h-full bg-gradient-to-r from-[#4fd1ff] to-[#4fff9a] rounded-full"
                      />
                    </div>
                  </div>

                  {/* Operation row: Sync */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-[#e8f4ff]">Data Synchronization</span>
                      <span className="text-[#4fd1ff] font-mono">{metrics.sync}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111827] rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${metrics.sync}%` }} 
                        className="h-full bg-gradient-to-r from-[#4fd1ff] to-[#4fff9a] rounded-full"
                      />
                    </div>
                  </div>

                  {/* Autonomous Tasks counter */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#1b2635] mt-1">
                    <span className="text-[#7f9bb5]">Autonomous Tasks</span>
                    <span className="text-[#4fff9a] font-mono font-semibold">{metrics.autonomousTasks} Running</span>
                  </div>
                </div>

                {/* AI Insights & Mission Status */}
                <div className="bg-[#05070b] border border-[#1b2635] rounded-xl p-3 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#7f9bb5] font-semibold mb-2">
                      AI Insights
                    </div>
                    <ul className="text-[11px] text-[#e8f4ff] space-y-1.5 font-sans">
                      <li className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4fd1ff]" />
                        <span>Pattern recognition optimized</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4fff9a]" />
                        <span>Workflow efficiency increased (+14.2%)</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4fd1ff]" />
                        <span>Resource allocation balanced</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00f5ff]" />
                        <span>Constitutional security protocols active</span>
                      </li>
                    </ul>

                    <div className="mt-3 text-[11px] text-[#e8f4ff] flex items-center justify-between bg-[#111827]/60 p-2 rounded-lg border border-[#1b2635]">
                      <span>Mission Control Status:</span>
                      <span className="text-[#4fff9a] font-bold">92% On Track</span>
                    </div>
                  </div>

                  {/* Cognitive Diagram */}
                  <div className="h-16 rounded-lg border border-dashed border-[#2b8fb8]/60 bg-[radial-gradient(circle,rgba(79,209,255,0.08),transparent_60%)] flex flex-col items-center justify-center text-[10px] uppercase tracking-wider text-[#4fd1ff] p-2 text-center">
                    <div className="font-semibold text-[10px]">Cognitive Functions Active</div>
                    <div className="text-[9px] text-[#7f9bb5]">Knowledge Base · Continual Learning Rate: 0.0014</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: System Telemetry / Agents / Infrastructure (Col 5) */}
          <div className="lg:col-span-5 bg-[#0b1018] rounded-2xl border border-[#1b2635] p-3.5 md:p-4 flex flex-col gap-3 relative overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(79,255,154,0.05),transparent_60%)] pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-3">
              {/* Panel Header */}
              <div className="flex items-baseline justify-between border-b border-[#1b2635] pb-2.5">
                <div className="text-xs uppercase tracking-[0.12em] font-semibold text-[#4fd1ff]">
                  System Telemetry
                </div>
                <div className="text-[10px] text-[#7f9bb5]">
                  Live metrics · Infrastructure health
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Core Telemetry */}
                <div className="bg-[#05070b] border border-[#1b2635] rounded-xl p-3 flex flex-col gap-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-[#7f9bb5] font-semibold">
                    Core Telemetry
                  </div>

                  {/* CPU Usage */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-[#e8f4ff]">CPU Usage</span>
                      <span className="text-[#4fd1ff] font-mono">{metrics.cpu}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111827] rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${metrics.cpu}%` }} 
                        className="h-full bg-gradient-to-r from-[#4fd1ff] to-[#4fff9a] rounded-full"
                      />
                    </div>
                  </div>

                  {/* Memory */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-[#e8f4ff]">Memory</span>
                      <span className="text-[#4fd1ff] font-mono">{metrics.ram}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111827] rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${metrics.ram}%` }} 
                        className="h-full bg-gradient-to-r from-[#4fd1ff] to-[#4fff9a] rounded-full"
                      />
                    </div>
                  </div>

                  {/* GPU Load */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-[#e8f4ff]">GPU Load</span>
                      <span className="text-[#4fd1ff] font-mono">{metrics.gpu}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#111827] rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${metrics.gpu}%` }} 
                        className="h-full bg-gradient-to-r from-[#4fd1ff] to-[#4fff9a] rounded-full"
                      />
                    </div>
                  </div>

                  {/* Network */}
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#1b2635]">
                    <span className="text-[#7f9bb5]">Network Bandwidth</span>
                    <span className="text-[#4fff9a] font-mono font-semibold">{metrics.network}</span>
                  </div>
                </div>

                {/* Agents Management & Infrastructure */}
                <div className="bg-[#05070b] border border-[#1b2635] rounded-xl p-3 flex flex-col gap-2">
                  <div className="text-[11px] uppercase tracking-wider text-[#7f9bb5] font-semibold">
                    Agents Management
                  </div>

                  {/* Agents list */}
                  <div className="flex flex-col gap-1 text-[11px]">
                    {[
                      { name: 'Watching Agent', status: 'Active' },
                      { name: 'Repair Agent', status: 'Active' },
                      { name: 'Security Agent', status: 'Active' },
                      { name: 'Optimization Agent', status: 'Active' },
                      { name: 'Synchronization Agent', status: 'Active' }
                    ].map((ag) => (
                      <div key={ag.name} className="flex justify-between items-center py-0.5 border-b border-[#111827]">
                        <span className="text-[#e8f4ff]">{ag.name}</span>
                        <span className="text-[10px] uppercase font-mono text-[#4fff9a] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4fff9a]" />
                          {ag.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Workspace / Sandbox environments */}
                  <div className="text-[10px] uppercase tracking-wider text-[#7f9bb5] font-semibold mt-1">
                    Workspace / Sandbox
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                    <div className="bg-[#111827]/60 p-1 rounded text-center border border-[#1b2635]">
                      <div className="text-[#7f9bb5]">TEST</div>
                      <div className="text-[#4fff9a]">RUN</div>
                    </div>
                    <div className="bg-[#111827]/60 p-1 rounded text-center border border-[#1b2635]">
                      <div className="text-[#7f9bb5]">STAGE</div>
                      <div className="text-[#4fff9a]">RUN</div>
                    </div>
                    <div className="bg-[#111827]/60 p-1 rounded text-center border border-[#1b2635]">
                      <div className="text-[#7f9bb5]">PROD</div>
                      <div className="text-[#4fff9a]">RUN</div>
                    </div>
                  </div>

                  {/* System Infrastructure chips */}
                  <div className="text-[10px] uppercase tracking-wider text-[#7f9bb5] font-semibold mt-1">
                    System Infrastructure
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['Compute', 'Memory', 'Storage', 'Network'].map(sys => (
                      <span
                        key={sys}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-[#1b2635] text-[9px] uppercase tracking-wider text-[#4fff9a] bg-[#111827]/50"
                      >
                        <span className="w-1 h-1 rounded-full bg-[#4fff9a] shadow-[0_0_4px_#4fff9a]" />
                        {sys}: OK
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INTERACTION ACTION CONTROLS */}
        <section className="bg-[#0b1018] rounded-xl border border-[#1b2635] p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_0_15px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#4fd1ff]" />
            <span className="text-xs uppercase tracking-wider text-[#7f9bb5]">
              Quick Agent Dispatch Triggers:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'optimize', label: 'Optimize Neural Weights' },
              { id: 'build', label: 'Build & Compile' },
              { id: 'analyze', label: 'Analyze Mesh' },
              { id: 'automate', label: 'Automate Tasks' },
              { id: 'deploy', label: 'Deploy Production' },
              { id: 'research', label: 'Research Vectors' }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => handleAction(pill.id)}
                disabled={activeAction === pill.id}
                className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border transition-all shadow-sm ${
                  activeAction === pill.id
                    ? 'bg-[#4fd1ff] text-[#020308] border-[#4fd1ff] animate-pulse'
                    : 'bg-[#05070b] text-[#4fd1ff] border-[#2b8fb8]/60 hover:bg-[#4fd1ff] hover:text-[#020308] hover:border-[#4fd1ff]'
                }`}
              >
                {activeAction === pill.id ? 'Dispatching...' : pill.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
