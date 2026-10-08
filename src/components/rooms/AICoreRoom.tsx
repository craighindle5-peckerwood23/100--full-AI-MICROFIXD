import GroqConnectionPanel from './GroqConnectionPanel';
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
import WorldThinkingPanel from '../thinking/WorldThinkingPanel';

const LANGGRAPH_NODES = [
  { id: 'ingest', name: 'Input Parsing', type: 'Ingestion' },
  { id: 'omni_route', name: 'Omni Router (server providers)', type: 'LLM Selector' },
  { id: 'retrieve', name: 'Memory Retrieval', type: 'Vector Search' },
  { id: 'reason', name: 'LangGraph Reasoning', type: 'Cognitive' },
  { id: 'constitutional', name: 'Constitutional Safety Gate', type: 'Safety Filter' },
  { id: 'voice_synth', name: 'Voice & Action Dispatch', type: 'Actuation' },
];

export default function AICoreRoom() {
  const [inferenceError,setInferenceError]=useState('');
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(1);
  const [providers, setProviders] = useState<Record<LLMProviderId, ProviderConfig>>(omniRouter.getProviders());
  const [priorityOrder, setPriorityOrder] = useState<LLMProviderId[]>(omniRouter.getPriorityOrder());
  const [lastExecution, setLastExecution] = useState<RouterExecutionResult | null>(null);
  const [history, setHistory] = useState<RouterHistoryItem[]>(omniRouter.getHistory());
  const [showKeyInputs, setShowKeyInputs] = useState(false);
  const [showWorldThinking, setShowWorldThinking] = useState(false);
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
    setIsProcessing(true);setInferenceError('');
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
        void voice.speak(result.text).catch(error=>setInferenceError(`Speech playback failed: ${error.message}`));
      }
    } catch (err: any) {
      sound.playAlert();
      setInferenceError(err instanceof Error?err.message:String(err));
      setQuery(userQuery);
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
              GROQ &bull; GEMINI &bull; OPENROUTER &bull; CLOUDFLARE
            </span>
          </div>
          <p className="text-xs text-cyan-500/80 mt-1">
            Server-side provider fallback with verified responses and voice feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { sound.playTick(); setShowWorldThinking(!showWorldThinking); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
              showWorldThinking 
                ? 'bg-purple-500/20 border-purple-400 text-purple-200 font-bold shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                : 'bg-black/50 border-cyan-500/30 text-cyan-400 hover:text-white'
            }`}
          >
            <Brain size={13} className="text-purple-400" />
            <span>{showWorldThinking ? 'Omni Router' : 'World Thinking & Oversight'}</span>
          </button>

          <button
            onClick={() => { sound.playTick(); setShowKeyInputs(!showKeyInputs); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
              showKeyInputs 
                ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold' 
                : 'bg-black/50 border-cyan-500/30 text-cyan-400 hover:text-white'
            }`}
          >
            <Key size={13} />
            <span>{showKeyInputs ? 'Hide connection' : 'Groq connection'}</span>
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

      {showKeyInputs && <GroqConnectionPanel/>}
      {inferenceError && <div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100 break-words">{inferenceError}</div>}

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
