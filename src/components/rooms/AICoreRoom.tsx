import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Cpu, 
  Radio, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  ArrowRight, 
  Activity, 
  Sliders,
  Terminal,
  RotateCcw,
  Lock,
  Unlock,
  ShieldAlert
} from 'lucide-react';
import { 
  omniRouter, 
  LLMProviderId, 
  ProviderConfig, 
  RouterExecutionResult, 
  RouterHistoryItem 
} from '../../utils/omniRouter';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import { autonomousCore } from '../../autonomy/autonomousCore';

const LANGGRAPH_NODES = [
  { id: 'ingest', name: 'Input Parsing', type: 'Ingestion' },
  { id: 'omni_route', name: 'Omni Router (Groq/Gemini/DeepSeek)', type: 'LLM Selector' },
  { id: 'retrieve', name: 'Memory Retrieval', type: 'Vector Search' },
  { id: 'reason', name: 'LangGraph Reasoning', type: 'Cognitive' },
  { id: 'constitutional', name: 'Constitutional Safety Gate', type: 'Safety Filter' },
  { id: 'voice_synth', name: 'Voice & Action Dispatch', type: 'Actuation' },
];

export default function AICoreRoom() {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(1);
  const [providers, setProviders] = useState<Record<LLMProviderId, ProviderConfig>>(omniRouter.getProviders());
  const [priorityOrder, setPriorityOrder] = useState<LLMProviderId[]>(omniRouter.getPriorityOrder());
  const [lastExecution, setLastExecution] = useState<RouterExecutionResult | null>(null);
  const [history, setHistory] = useState<RouterHistoryItem[]>(omniRouter.getHistory());
  const [showKeyInputs, setShowKeyInputs] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(voice.isSpeaking());
  const [fallbackAlert, setFallbackAlert] = useState(autonomousCore.getFallbackAlert());

  // Subscribe to voice & autonomous core events
  useEffect(() => {
    const unsubVoice = voice.subscribe((speaking) => {
      setVoiceSpeaking(speaking);
    });
    const unsubAutonomy = autonomousCore.subscribe(() => {
      setFallbackAlert({ ...autonomousCore.getFallbackAlert() });
    });
    return () => {
      unsubVoice();
      unsubAutonomy();
    };
  }, []);

  const refreshState = () => {
    setProviders(omniRouter.getProviders());
    setPriorityOrder(omniRouter.getPriorityOrder());
    setHistory(omniRouter.getHistory());
  };

  const handleKeyChange = (provider: LLMProviderId, key: string) => {
    omniRouter.setApiKey(provider, key);
    refreshState();
  };

  const handleModelChange = (provider: LLMProviderId, model: string) => {
    omniRouter.setModel(provider, model);
    refreshState();
  };

  const handleMovePriority = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...priorityOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    omniRouter.setPriorityOrder(newOrder);
    setPriorityOrder(newOrder);
    sound.playTick();
  };

  const handleRunInference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    sound.playCognitivePulse();
    setIsProcessing(true);
    const userQuery = query;
    setQuery('');

    // Animate LangGraph pipeline
    for (let i = 0; i < LANGGRAPH_NODES.length; i++) {
      setActiveNodeIndex(i);
      sound.playTick();
      await new Promise(r => setTimeout(r, 120));
    }

    try {
      const result = await omniRouter.execute(userQuery);
      setLastExecution(result);
      refreshState();
      sound.playSuccess();

      // Read response via voice
      if (voice.isEnabled()) {
        const snippet = result.text.length > 200 ? result.text.slice(0, 190) + '...' : result.text;
        voice.speak(snippet);
      }
    } catch (err: any) {
      sound.playAlert();
      console.error('Omni Router inference error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const readAloud = (text: string) => {
    sound.playTick();
    if (voiceSpeaking) {
      voice.stop();
    } else {
      voice.speak(text);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 text-cyan-400 font-mono overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="text-cyan-400 animate-pulse" size={20} />
            <h1 className="text-lg font-bold text-white tracking-wide">
              OMNI LLM ROUTER & COGNITIVE ENGINE
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-bold">
              GROQ &bull; GEMINI &bull; DEEPSEEK
            </span>
          </div>
          <p className="text-xs text-cyan-500/80 mt-1">
            Intelligent multi-model key juggling, latency-optimized cascade fallbacks, and real-time synthetic voice feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { sound.playTick(); setShowKeyInputs(!showKeyInputs); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
              showKeyInputs 
                ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold' 
                : 'bg-black/50 border-cyan-500/30 text-cyan-400 hover:text-white'
            }`}
          >
            <Key size={13} />
            <span>{showKeyInputs ? 'Hide API Keys' : 'Configure API Keys'}</span>
          </button>

          <button
            onClick={() => { voice.toggleVoice(); sound.playTick(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
              voice.isEnabled()
                ? 'bg-cyan-950/80 border-cyan-400/50 text-cyan-300'
                : 'bg-black/50 border-cyan-900 text-cyan-700'
            }`}
          >
            {voice.isEnabled() ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>Voice {voice.isEnabled() ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* API Key Configuration Drawer (Optional expandable) */}
      <AnimatePresence>
        {showKeyInputs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-xl bg-black/80 border border-cyan-500/30 p-4 space-y-4 backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders size={14} className="text-cyan-400" />
                PROVIDER API CREDENTIALS & MODEL TARGETS
              </span>
              <span className="text-[10px] text-cyan-500/80">
                Credentials saved securely in browser session
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Groq */}
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Groq Cloud</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-500/30">
                    Ultra Fast
                  </span>
                </div>
                <div>
                  <label className="text-[10px] text-cyan-400 block mb-0.5">GROQ_API_KEY</label>
                  <input
                    type="password"
                    value={providers.groq?.apiKey || ''}
                    onChange={e => handleKeyChange('groq', e.target.value)}
                    placeholder="gsk_..."
                    className="w-full bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-white placeholder:text-cyan-800 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-cyan-400 block mb-0.5">MODEL</label>
                  <select
                    value={providers.groq?.model || 'llama-3.3-70b-versatile'}
                    onChange={e => handleModelChange('groq', e.target.value)}
                    className="w-full bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-white focus:outline-none font-mono"
                  >
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                    <option value="gemma2-9b-it">gemma2-9b-it</option>
                  </select>
                </div>
              </div>

              {/* Gemini */}
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Google Gemini</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
                    Multimodal
                  </span>
                </div>
                <div>
                  <label className="text-[10px] text-cyan-400 block mb-0.5">GEMINI_API_KEY</label>
                  <input
                    type="password"
                    value={providers.gemini?.apiKey || ''}
                    onChange={e => handleKeyChange('gemini', e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-white placeholder:text-cyan-800 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-cyan-400 block mb-0.5">MODEL</label>
                  <select
                    value={providers.gemini?.model || 'gemini-2.5-flash'}
                    onChange={e => handleModelChange('gemini', e.target.value)}
                    className="w-full bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-white focus:outline-none font-mono"
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  </select>
                </div>
              </div>

              {/* DeepSeek */}
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">DeepSeek AI</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                    Reasoning
                  </span>
                </div>
                <div>
                  <label className="text-[10px] text-cyan-400 block mb-0.5">DEEPSEEK_API_KEY</label>
                  <input
                    type="password"
                    value={providers.deepseek?.apiKey || ''}
                    onChange={e => handleKeyChange('deepseek', e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-white placeholder:text-cyan-800 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-cyan-400 block mb-0.5">MODEL</label>
                  <select
                    value={providers.deepseek?.model || 'deepseek-chat'}
                    onChange={e => handleModelChange('deepseek', e.target.value)}
                    className="w-full bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-xs text-white focus:outline-none font-mono"
                  >
                    <option value="deepseek-chat">deepseek-chat (V3)</option>
                    <option value="deepseek-reasoner">deepseek-reasoner (R1)</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Autonomous Fallback & Manual Override Control Bar */}
      <div className="p-3.5 rounded-xl bg-black/60 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
        <div className="flex items-center gap-2.5">
          <ShieldAlert size={16} className={fallbackAlert.active ? 'text-amber-400 animate-bounce' : 'text-cyan-400'} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase tracking-wider text-xs">
                AUTONOMOUS CONNECTIVITY WATCHDOG & FALLBACK ENGINE
              </span>
              <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                fallbackAlert.manualOverrideActive
                  ? 'bg-red-950 border border-red-500/50 text-red-300'
                  : fallbackAlert.active
                  ? 'bg-amber-950 border border-amber-500/50 text-amber-300 animate-pulse'
                  : 'bg-emerald-950 border border-emerald-500/50 text-emerald-300'
              }`}>
                {fallbackAlert.manualOverrideActive
                  ? 'MANUAL OVERRIDE LOCKED'
                  : fallbackAlert.active
                  ? 'FALLBACK CASCADE ACTIVE'
                  : 'AUTONOMOUS SUPERVISION NOMINAL'}
              </span>
            </div>
            <p className="text-[11px] text-cyan-500/80 mt-0.5">
              {fallbackAlert.active 
                ? `Switched from ${fallbackAlert.primaryProvider.toUpperCase()} to ${fallbackAlert.fallbackProvider.toUpperCase()} (${fallbackAlert.fallbackModel}) due to connectivity timeout.`
                : 'Watches endpoints at 1.0Hz; automatically switches to neural fallback on socket failure with zero user downtime.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo Fallback */}
          {fallbackAlert.active && (
            <button
              onClick={() => autonomousCore.undoFallback()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-200 text-xs font-bold transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)]"
              title="Revert back to primary provider"
            >
              <RotateCcw size={13} />
              <span>Undo Switch</span>
            </button>
          )}

          {/* Manual Override Toggle */}
          <button
            onClick={() => autonomousCore.toggleManualOverride()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              fallbackAlert.manualOverrideActive
                ? 'bg-red-500/25 border-red-400 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                : 'bg-black/40 hover:bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
            }`}
            title="Lock current model configuration and disable automatic cascade switching"
          >
            {fallbackAlert.manualOverrideActive ? <Lock size={13} className="text-red-400" /> : <Unlock size={13} />}
            <span>{fallbackAlert.manualOverrideActive ? 'Manual Override (LOCKED)' : 'Manual Override'}</span>
          </button>

          {/* Test Connectivity Failure Button */}
          <button
            onClick={() => autonomousCore.injectSimulatedProblem('connectivity')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-200 text-xs font-bold transition-all"
            title="Simulate network drop on primary LLM to test visual indicator & fallback"
          >
            <Zap size={13} className="text-amber-400" />
            <span>Test Connectivity Alert</span>
          </button>
        </div>
      </div>

      {/* Provider Status & Priority Fallback Ladder */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {priorityOrder.map((pId, index) => {
          const p = providers[pId];
          if (!p) return null;

          return (
            <div 
              key={pId}
              className="p-3 rounded-xl bg-black/60 border border-cyan-500/30 space-y-2 relative overflow-hidden backdrop-blur-md"
            >
              {/* Fallback priority badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-400/40 text-[10px] font-bold text-white flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="font-bold text-xs text-white">{p.name}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMovePriority(index, 'up')}
                    disabled={index === 0}
                    className="text-[10px] px-1 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400 hover:text-white disabled:opacity-20"
                    title="Move up priority"
                  >
                    &uarr;
                  </button>
                  <button
                    onClick={() => handleMovePriority(index, 'down')}
                    disabled={index === priorityOrder.length - 1}
                    className="text-[10px] px-1 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400 hover:text-white disabled:opacity-20"
                    title="Move down priority"
                  >
                    &darr;
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-cyan-300/80 truncate">
                {p.model}
              </div>

              <div className="flex items-center justify-between border-t border-cyan-500/20 pt-2 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    p.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' :
                    p.status === 'STANDBY' ? 'bg-cyan-400' :
                    p.status === 'KEY_MISSING' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  <span className="text-white font-mono">{p.status}</span>
                </span>
                <span className="text-cyan-500/70">
                  {p.latencyMs ? `${p.latencyMs}ms` : 'Ready'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Interactive Inference & Execution Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Prompt & Real-time Fallback Execution View */}
        <div className="lg:col-span-2 space-y-4">
          <form 
            onSubmit={handleRunInference} 
            className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 space-y-3 backdrop-blur-md"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Brain size={15} className="text-cyan-400" />
                AUTONOMOUS OMNI PROMPT CONSOLE
              </label>
              <div className="flex items-center gap-2 text-[10px] text-cyan-400">
                {voiceSpeaking && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Speaking...
                  </span>
                )}
                <span>Auto-Fallback Active</span>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                rows={3}
                placeholder="Submit prompt to the Omni Router... (e.g. 'Synthesize multi-agent task DAG', 'Run security audit across memory graphs')"
                className="w-full bg-cyan-950/30 border border-cyan-500/30 rounded-lg p-3 text-xs text-white placeholder:text-cyan-600 focus:outline-none focus:border-cyan-400 font-mono resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {[
                  'Plan multi-agent deployment',
                  'Audit constitutional rules',
                  'Analyze latency bottlenecks',
                  'Memory graph search'
                ].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => { sound.playTick(); setQuery(chip); }}
                    className="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-300 hover:border-cyan-400 hover:text-white transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isProcessing || !query.trim()}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-white text-xs font-bold transition-all disabled:opacity-40 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Executing Cascade...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Dispatch to Omni</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Execution Response Card */}
          {lastExecution && (
            <div className="p-4 rounded-xl bg-black/80 border border-cyan-500/40 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    RESOLVED VIA {lastExecution.providerUsed.toUpperCase()}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300">
                    {lastExecution.modelUsed}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-cyan-400">
                  <span>{lastExecution.latencyMs}ms</span>
                  <span>~{lastExecution.tokensEstimated} tokens</span>
                  <button
                    onClick={() => readAloud(lastExecution.text)}
                    className="p-1 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 hover:text-white"
                    title={voiceSpeaking ? 'Stop speaking' : 'Read response aloud'}
                  >
                    {voiceSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                </div>
              </div>

              {/* Fallback chain visualizer */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] py-1">
                <span className="text-cyan-500/80">FALLBACK PATH:</span>
                {lastExecution.fallbackChain.map((chain, idx) => (
                  <React.Fragment key={chain.provider}>
                    <span className={`px-2 py-0.5 rounded border font-mono ${
                      chain.status === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                        : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                    }`}>
                      {chain.provider} [{chain.status.toUpperCase()}]
                      {chain.error && ` (${chain.error.slice(0, 20)}...)`}
                    </span>
                    {idx < lastExecution.fallbackChain.length - 1 && (
                      <ArrowRight size={10} className="text-cyan-500" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Output Content */}
              <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-xs text-cyan-100 whitespace-pre-wrap leading-relaxed">
                {lastExecution.text}
              </div>
            </div>
          )}

          {/* LangGraph Cognitive Pipeline */}
          <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 space-y-3 backdrop-blur-md">
            <h2 className="text-xs font-bold text-white flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              LANGGRAPH COGNITIVE PIPELINE TOPOLOGY
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {LANGGRAPH_NODES.map((node, i) => {
                const isActive = activeNodeIndex === i;
                return (
                  <div
                    key={node.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isActive 
                        ? 'bg-cyan-900/40 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]' 
                        : 'bg-cyan-950/20 border-cyan-900 text-cyan-500/80'
                    }`}
                  >
                    <div className="text-[10px] text-cyan-400/80 uppercase">{node.type}</div>
                    <div className="text-xs font-bold truncate mt-0.5">{node.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Recent Router History */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 space-y-3 backdrop-blur-md h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Terminal size={14} className="text-cyan-400" />
                RECENT OMNI DISPATCHES
              </span>
              <button
                onClick={() => { omniRouter.clearHistory(); refreshState(); sound.playTick(); }}
                className="text-[10px] text-cyan-500 hover:text-white"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] scrollbar-thin">
              {history.length === 0 ? (
                <div className="text-center py-8 text-xs text-cyan-600">
                  No dispatches recorded yet.
                </div>
              ) : (
                history.map(item => (
                  <div 
                    key={item.id}
                    className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/20 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold">
                        {item.provider.toUpperCase()}
                      </span>
                      <span className="text-cyan-500">{item.timestamp}</span>
                    </div>
                    <div className="font-semibold text-white truncate text-[11px]">
                      "{item.prompt}"
                    </div>
                    <div className="text-[10px] text-cyan-400/80 line-clamp-2">
                      {item.response}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[9px] text-cyan-500/60 border-t border-cyan-500/10">
                      <span>Latency: {item.latencyMs}ms</span>
                      {item.fallbackOccurred && (
                        <span className="text-amber-400">Fallback used</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
