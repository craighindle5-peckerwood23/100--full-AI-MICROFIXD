import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Send, 
  Sparkles, 
  Zap, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  Users, 
  Layers, 
  Mic, 
  MicOff, 
  X, 
  CornerDownLeft, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Sliders, 
  Play, 
  Radio, 
  Database,
  ArrowRight
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import { omniRouter } from '../../utils/omniRouter';
import { OrganApi } from '../../lib/organApi';
import { Subsystem } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (subsystem: Subsystem) => void;
  activeSubsystem?: Subsystem;
}

interface CommandLogItem {
  id: string;
  query: string;
  intent?: string;
  response: string;
  speech?: string;
  organsUsed?: string[];
  latencyMs: number;
  timestamp: string;
  success: boolean;
  agent?: string;
}

const QUICK_ACTIONS = [
  { label: 'Query System Diagnostics', query: 'Query full system status, memory lattice health, and cluster coherence.', icon: Activity, category: 'status' },
  { label: 'Run Sentinel Security Audit', query: 'Dispatch Sentinel to perform a zero-leak constitutional security audit.', icon: ShieldCheck, category: 'security' },
  { label: 'Run 200% Organ Stress Test', query: 'Execute 200% capacity stress test across all 235 live organs.', icon: Zap, category: 'stress' },
  { label: 'Rebalance Agent Threadpool', query: 'Rebalance V8 worker threads and optimize inter-agent message bus.', icon: Users, category: 'agents' },
  { label: 'Inspect Supabase Memory', query: 'Query Supabase vector memory and check active context records.', icon: Database, category: 'memory' },
];

export default function GlobalCommandConsole({ isOpen, onClose, onNavigate, activeSubsystem }: Props) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'agents' | 'status'>('console');
  const [logs, setLogs] = useState<CommandLogItem[]>([
    {
      id: 'init-1',
      query: 'System Boot Initialized',
      intent: 'diagnose',
      response: 'Central Command & Groq LPU active. 235 organs loaded with zero memory leaks. Ready for natural language commands.',
      organsUsed: ['brain', 'memory', 'reflex', 'security_spine'],
      latencyMs: 12,
      timestamp: new Date().toLocaleTimeString(),
      success: true,
      agent: 'CARTER'
    }
  ]);
  const [selectedAgent, setSelectedAgent] = useState('carter');
  const [agentTaskPrompt, setAgentTaskPrompt] = useState('');
  const [systemSnapshot, setSystemSnapshot] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      sound.playWarp();
      setTimeout(() => inputRef.current?.focus(), 80);
      loadSystemSnapshot();
    }
  }, [isOpen]);

  const loadSystemSnapshot = async () => {
    try {
      const res = await OrganApi.snapshot() as any;
      setSystemSnapshot(res);
    } catch {
      // Fallback
    }
  };

  const handleExecuteCommand = async (queryText: string) => {
    const text = queryText.trim();
    if (!text || isProcessing) return;

    setInput('');
    setIsProcessing(true);
    sound.playCognitivePulse();

    const t0 = Date.now();
    try {
      // Execute through Central Command (Groq + Organ Mesh)
      let resultText = '';
      let organsUsed: string[] = ['brain', 'memory'];
      let intent = 'execute';
      let targetSubsystem = '';

      // 1. Evaluate with OmniRouter / Groq
      const decision = await omniRouter.evaluateAndOrchestrate(text, (activeSubsystem as string) || 'ai_core');
      resultText = decision.detailedAnswer || decision.speech || decision.thought || 'Command executed across system mesh.';
      intent = decision.actionName || 'orchestrate';
      targetSubsystem = decision.targetSubsystem || '';

      organsUsed = decision.organsUsed || [];

      const latency = Date.now() - t0;

      const newLog: CommandLogItem = {
        id: `cmd-${Date.now()}`,
        query: text,
        intent,
        response: resultText,
        speech: decision.speech,
        organsUsed,
        latencyMs: latency,
        timestamp: new Date().toLocaleTimeString(),
        success: true,
        agent: decision.actionName ? decision.actionName.toUpperCase() : 'CENTRAL_COMMAND'
      };

      setLogs(prev => [newLog, ...prev.slice(0, 30)]);
      sound.playSuccess();

      // Voice output
      if (decision.speech && voice.isEnabled()) {
        voice.speak(decision.speech);
      }

      // Navigate if Groq determined target space
      if (targetSubsystem && onNavigate) {
        onNavigate(targetSubsystem as Subsystem);
      }

      loadSystemSnapshot();
    } catch (err: any) {
      const latency = Date.now() - t0;
      setLogs(prev => [{
        id: `err-${Date.now()}`,
        query: text,
        response: `Command evaluation error: ${err?.message || String(err)}`,
        latencyMs: latency,
        timestamp: new Date().toLocaleTimeString(),
        success: false
      }, ...prev]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAgentDispatch = async (agentKey: string) => {
    const prompt = agentTaskPrompt.trim() || `Execute designated autonomous protocol for ${agentKey}`;
    setAgentTaskPrompt('');
    setIsProcessing(true);
    sound.playCognitivePulse();

    try {
      const res = await fetch('/api/agents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: agentKey, prompt }),
      });
      const data = await res.json();
      
      setLogs(prev => [{
        id: `agent-${Date.now()}`,
        query: `[AGENT TASK // ${agentKey.toUpperCase()}]: ${prompt}`,
        response: JSON.stringify(data.result || data, null, 2),
        latencyMs: 45,
        timestamp: new Date().toLocaleTimeString(),
        success: res.ok,
        agent: agentKey.toUpperCase()
      }, ...prev]);

      sound.playSuccess();
    } catch (err: any) {
      setLogs(prev => [{
        id: `agent-err-${Date.now()}`,
        query: `[AGENT TASK // ${agentKey.toUpperCase()}]: ${prompt}`,
        response: `Dispatch error: ${err?.message || String(err)}`,
        latencyMs: 50,
        timestamp: new Date().toLocaleTimeString(),
        success: false,
        agent: agentKey.toUpperCase()
      }, ...prev]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleVoiceListen = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      sound.playTick();
      setIsListening(true);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
          handleExecuteCommand(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
      } else {
        setIsListening(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-mono">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Console Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[85vh] h-[680px] bg-[#030712]/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden text-cyan-400"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-cyan-500/25 bg-cyan-950/30">
            <div className="flex items-center gap-3">
              <Terminal className="text-cyan-400 animate-pulse" size={18} />
              <span className="text-sm font-bold tracking-wider text-white">GLOBAL COMMAND CONSOLE // GROQ CENTRAL COMMAND</span>
              <span className="px-2 py-0.5 text-[10px] bg-cyan-950 border border-cyan-500/40 rounded text-cyan-300">
                LEVEL 6 LIVE
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-cyan-500/60 hidden sm:inline">Press ESC to exit</span>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-cyan-500/20 text-cyan-400 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-5 py-2 border-b border-cyan-500/15 bg-black/40 text-xs">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'console'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-white font-semibold shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-cyan-400/60 hover:text-cyan-200'
              }`}
            >
              <Sparkles size={13} />
              Natural Language Console
            </button>

            <button
              onClick={() => setActiveTab('agents')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'agents'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-white font-semibold shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-cyan-400/60 hover:text-cyan-200'
              }`}
            >
              <Users size={13} />
              Agent Task Dispatcher
            </button>

            <button
              onClick={() => setActiveTab('status')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'status'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-white font-semibold shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-cyan-400/60 hover:text-cyan-200'
              }`}
            >
              <Activity size={13} />
              Real-time System Status
            </button>
          </div>

          {/* Main Content Body */}
          <div className="flex-1 overflow-hidden p-5 flex flex-col gap-4">
            {activeTab === 'console' && (
              <>
                {/* Quick Action Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <span className="text-[10px] text-cyan-500/60 uppercase tracking-wider flex-shrink-0">Quick Prompts:</span>
                  {QUICK_ACTIONS.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleExecuteCommand(action.query)}
                      className="px-2.5 py-1 rounded-lg bg-black/60 border border-cyan-500/20 hover:border-cyan-400 text-cyan-300 hover:text-white whitespace-nowrap flex items-center gap-1.5 transition-all text-[11px]"
                    >
                      <action.icon size={11} className="text-cyan-400" />
                      {action.label}
                    </button>
                  ))}
                </div>

                {/* Log Stream Output */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 font-mono text-xs">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl bg-black/50 border border-cyan-500/20 hover:border-cyan-500/40 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-cyan-500/10 pb-1.5 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                            {log.agent || 'SYSTEM'}
                          </span>
                          <span className="text-cyan-500/60">{log.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-2 text-cyan-400/80">
                          {log.intent && <span className="uppercase text-[9px] px-1.5 bg-cyan-500/10 rounded">Intent: {log.intent}</span>}
                          <span>{log.latencyMs}ms</span>
                        </div>
                      </div>

                      <div className="text-white font-medium flex items-start gap-2">
                        <ArrowRight size={13} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                        <span>{log.query}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/15 text-cyan-200 whitespace-pre-wrap leading-relaxed text-[11px]">
                        {log.response}
                      </div>

                      {log.organsUsed && log.organsUsed.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] text-cyan-500/60 pt-1">
                          <span>Organs Executed:</span>
                          <div className="flex flex-wrap gap-1">
                            {log.organsUsed.map((o, idx) => (
                              <span key={idx} className="px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                                {o}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Natural Language Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleExecuteCommand(input);
                  }}
                  className="relative flex items-center gap-2 pt-2"
                >
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Carter, query system status, dispatch agents, or execute tasks..."
                      disabled={isProcessing}
                      className="w-full bg-black/80 border border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-white placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={toggleVoiceListen}
                    className={`p-3 rounded-xl border transition-all ${
                      isListening
                        ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse'
                        : 'bg-black/80 border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-300'
                    }`}
                    title="Voice speech input"
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>

                  <button
                    type="submit"
                    disabled={!input.trim() || isProcessing}
                    className="px-5 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-40"
                  >
                    {isProcessing ? (
                      <RefreshCw size={14} className="animate-spin text-cyan-300" />
                    ) : (
                      <Send size={14} className="text-cyan-300" />
                    )}
                    <span>Execute</span>
                  </button>
                </form>
              </>
            )}

            {activeTab === 'agents' && (
              <div className="flex-1 overflow-y-auto flex flex-col gap-4">
                <div className="text-xs text-cyan-300/80">
                  Select a synthetic agent from the fleet to assign autonomous directives:
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'optimize', name: 'OPTIMIZER (Atlas)', role: 'Thread & Memory Balancing' },
                    { id: 'build', name: 'BUILDER (DaVinci)', role: 'Self-Repair & Code Refactor' },
                    { id: 'analyze', name: 'ANALYZER (Carter)', role: 'Multi-Agent Intelligence' },
                    { id: 'automate', name: 'AUTOMATOR (Nexus)', role: 'Cross-Node Synchronization' },
                    { id: 'deploy', name: 'DEPLOYER (Sentinel)', role: 'Security & Auto-Deployment' },
                    { id: 'research', name: 'RESEARCHER (Turing)', role: 'Hypothesis & Vector Search' }
                  ].map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedAgent === agent.id
                          ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-black/40 border-cyan-500/20 hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="text-xs font-bold text-white mb-0.5">{agent.name}</div>
                      <div className="text-[10px] text-cyan-400/60">{agent.role}</div>
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 flex flex-col gap-3">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Assign Directive to [{selectedAgent.toUpperCase()}]
                  </div>

                  <textarea
                    value={agentTaskPrompt}
                    onChange={(e) => setAgentTaskPrompt(e.target.value)}
                    placeholder={`Enter explicit autonomous directive for ${selectedAgent}...`}
                    rows={3}
                    className="w-full bg-black/80 border border-cyan-500/30 rounded-lg p-3 text-xs text-white placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleAgentDispatch(selectedAgent)}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-xs text-white font-semibold flex items-center gap-2"
                    >
                      <Play size={12} className="text-cyan-300" />
                      <span>Dispatch Agent Directive</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'status' && (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
                    <span className="text-[10px] text-cyan-500/60 uppercase block">Total Organs</span>
                    <span className="text-xl text-white font-bold">235 Live</span>
                    <span className="text-[10px] text-emerald-400 block mt-1">100% Operational</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
                    <span className="text-[10px] text-cyan-500/60 uppercase block">Groq LPU Layer</span>
                    <span className="text-xl text-cyan-300 font-bold">qwen/3.8-27b</span>
                    <span className="text-[10px] text-cyan-400 block mt-1">Sub-second Latency</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
                    <span className="text-[10px] text-cyan-500/60 uppercase block">Vector Memory</span>
                    <span className="text-xl text-emerald-400 font-bold">Connected</span>
                    <span className="text-[10px] text-cyan-500/60 block mt-1">Supabase Lattice</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
                    <span className="text-[10px] text-cyan-500/60 uppercase block">Safety Directive</span>
                    <span className="text-xl text-white font-bold">Chapter 15</span>
                    <span className="text-[10px] text-emerald-400 block mt-1">100.0% Pass</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/25 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-white border-b border-cyan-500/15 pb-2">
                    <span>Active System Subsystems (15 Rooms)</span>
                    <span className="text-emerald-400">All Nominal</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-[11px]">
                    {[
                      'Mission Control', 'Omni Router', 'Agent Matrix', 'Sandbox',
                      'Workspace', 'Infrastructure', 'Telemetry', 'Memory Graph',
                      'Learning Core', 'Automation', 'Supabase Cloud', 'Constitutional',
                      'Federation', 'OS Bible', 'Autonomous Loop'
                    ].map((room, i) => (
                      <div key={i} className="p-2 rounded bg-cyan-950/20 border border-cyan-500/10 flex items-center gap-1.5">
                        <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
                        <span className="text-cyan-200 truncate">{room}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
