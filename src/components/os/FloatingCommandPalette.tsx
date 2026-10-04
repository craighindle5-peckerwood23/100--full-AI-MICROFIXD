import {deliverSpokenResponse} from '../../lib/outputDelivery';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Mic, 
  MicOff, 
  Sparkles, 
  Send, 
  Maximize2, 
  Minimize2, 
  X, 
  Volume2, 
  VolumeX, 
  Activity, 
  ChevronUp, 
  ChevronDown, 
  Zap, 
  Radio, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Cpu,
  BookmarkPlus,
  Plus,
  Trash2,
  Bookmark,
  ShieldCheck,
  Database,
  Users,
  Sliders,
  Play
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import { voiceState } from '../../utils/voiceState';
import { omniRouter } from '../../utils/omniRouter';
import { OrganApi } from '../../lib/organApi';
import { Subsystem } from '../../types';

interface Props {
  onNavigate?: (subsystem: Subsystem) => void;
  activeSubsystem?: Subsystem;
}

interface MessageEntry {
  id: string;
  sender: 'user' | 'groq' | 'system';
  text: string;
  speech?: string;
  intent?: string;
  organs?: string[];
  latencyMs?: number;
  timestamp: string;
  isVoice?: boolean;
}

export interface QuickCommand {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
  category?: 'system' | 'security' | 'stress' | 'agents' | 'memory' | 'custom';
  isCustom?: boolean;
}

const DEFAULT_QUICK_COMMANDS: QuickCommand[] = [
  { id: 'qc-1', label: 'System Diagnostics', prompt: 'Query full system status, 235 organ health, and cluster coherence.', icon: 'activity', category: 'system' },
  { id: 'qc-2', label: 'Security Audit', prompt: 'Dispatch Sentinel to perform a zero-leak constitutional security audit.', icon: 'shield', category: 'security' },
  { id: 'qc-3', label: '200% Stress Test', prompt: 'Execute 200% capacity stress test across all 235 live organs.', icon: 'zap', category: 'stress' },
  { id: 'qc-4', label: 'Rebalance Threads', prompt: 'Rebalance V8 worker threads and optimize inter-agent message bus.', icon: 'users', category: 'agents' },
  { id: 'qc-5', label: 'Supabase Memory', prompt: 'Query Supabase vector memory and check active context records.', icon: 'database', category: 'memory' },
  { id: 'qc-6', label: 'Optimize LPU Paths', prompt: 'Run latency benchmarks and optimize fastest LPU execution paths.', icon: 'cpu', category: 'system' },
];

const STORAGE_KEY = 'microfyxd_quick_commands';

export default function FloatingCommandPalette({ onNavigate, activeSubsystem }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  // Quick Commands State
  const [quickCommands, setQuickCommands] = useState<QuickCommand[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_QUICK_COMMANDS;
  });

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newCmdLabel, setNewCmdLabel] = useState('');
  const [newCmdPrompt, setNewCmdPrompt] = useState('');

  const [messages, setMessages] = useState<MessageEntry[]>([
    {
      id: 'welcome-1',
      sender: 'groq',
      text: 'Flagship Groq Autonomous Agent online. Ask any question, trigger organ tasks, or use Quick Commands.',
      speech: 'Groq autonomous agent ready for commands.',
      intent: 'ready',
      organs: ['brain', 'memory', 'reflex'],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync voice state to global voiceState manager for aura rendering
  useEffect(() => {
    voiceState.setListening(isListening);
  }, [isListening]);

  useEffect(() => {
    voiceState.setProcessing(isProcessing);
  }, [isProcessing]);

  // Sync quick commands to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quickCommands));
    } catch {}
  }, [quickCommands]);

  // Auto-scroll message list
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript]);

  // Global toggle shortcut (Cmd+J / Ctrl+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        sound.playTick();
        setIsExpanded(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Web Speech API initialization & Continuous Hands-Free Voice loop
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const handleProcessGroqTask = useCallback(async (taskText: string, isFromVoice = false) => {
    const text = taskText.trim();
    if (!text || isProcessing) return;

    sound.playCognitivePulse();
    setIsProcessing(true);
    setInput('');
    setInterimTranscript('');

    const userMsg: MessageEntry = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoice: isFromVoice,
    };
    setMessages(prev => [...prev, userMsg]);

    const t0 = Date.now();
    try {
      // 1. Direct evaluation via Groq / OmniRouter Agent
      const decision = await omniRouter.evaluateAndOrchestrate(text, (activeSubsystem as string) || 'ai_core');
      let answer = decision.detailedAnswer || decision.speech || decision.thought || 'Task executed successfully.';
      let organsUsed: string[] = ['brain', 'memory'];

      organsUsed = decision.organsUsed || [];

      const latency = Date.now() - t0;
      const groqMsg: MessageEntry = {
        id: `groq-${Date.now()}`,
        sender: 'groq',
        text: answer,
        speech: decision.speech,
        intent: decision.actionName || 'orchestrate',
        organs: organsUsed,
        latencyMs: latency,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, groqMsg]);
      sound.playSuccess();

      // Voice response feedback
      if (decision.speech && voice.isEnabled()) {
        await deliverSpokenResponse(decision,text=>voice.speak(text));
      }

      // Auto-navigate if spatial intent was detected
      if (decision.targetSubsystem && onNavigate) {
        onNavigate(decision.targetSubsystem as Subsystem);
      }
    } catch (err: any) {
      const latency = Date.now() - t0;
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'system',
          text: `Groq Agent error: ${err?.message || String(err)}`,
          latencyMs: latency,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  }, [activeSubsystem, onNavigate, isProcessing]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser environment.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        sound.playTick();
      };

      recognition.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }

        if (interimTrans) {
          setInterimTranscript(interimTrans);
        }

        if (finalTrans) {
          setInterimTranscript('');
          handleProcessGroqTask(finalTrans, true);
        } else if (interimTrans && isHandsFree) {
          // In hands-free mode: trigger 1.4s silence window before auto-dispatching
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (interimTrans.trim().length > 3) {
              handleProcessGroqTask(interimTrans, true);
            }
          }, 1400);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('[WebSpeech] Recognition error:', e.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (isHandsFree) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {}
          }, 400);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('[WebSpeech] Failed to start recognition:', err);
      setIsListening(false);
    }
  }, [isHandsFree, handleProcessGroqTask]);

  const toggleHandsFree = () => {
    sound.playTick();
    if (isHandsFree) {
      setIsHandsFree(false);
      stopListening();
    } else {
      setIsHandsFree(true);
      setIsExpanded(true);
      startListening();
    }
  };

  const togglePushToTalk = () => {
    if (isListening) {
      stopListening();
    } else {
      setIsExpanded(true);
      startListening();
    }
  };

  // Quick Command Actions
  const handleSaveCurrentAsQuickCommand = () => {
    if (!input.trim()) return;
    setNewCmdPrompt(input.trim());
    setNewCmdLabel(input.trim().slice(0, 24));
    setShowSaveModal(true);
  };

  const handleSaveQuickCommandConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCmdLabel.trim() || !newCmdPrompt.trim()) return;

    sound.playSuccess();
    const newCmd: QuickCommand = {
      id: `custom-qc-${Date.now()}`,
      label: newCmdLabel.trim(),
      prompt: newCmdPrompt.trim(),
      category: 'custom',
      isCustom: true,
      icon: 'sparkles'
    };

    setQuickCommands(prev => [newCmd, ...prev]);
    setShowSaveModal(false);
    setNewCmdLabel('');
    setNewCmdPrompt('');
  };

  const handleDeleteQuickCommand = (id: string) => {
    sound.playTick();
    setQuickCommands(prev => prev.filter(c => c.id !== id));
  };

  const handleResetQuickCommands = () => {
    sound.playWarp();
    setQuickCommands(DEFAULT_QUICK_COMMANDS);
  };

  const renderIcon = (icon?: string) => {
    switch (icon) {
      case 'shield': return <ShieldCheck size={11} className="text-emerald-400" />;
      case 'zap': return <Zap size={11} className="text-amber-400" />;
      case 'database': return <Database size={11} className="text-purple-400" />;
      case 'users': return <Users size={11} className="text-cyan-400" />;
      case 'cpu': return <Cpu size={11} className="text-cyan-400" />;
      case 'sparkles': return <Sparkles size={11} className="text-yellow-400" />;
      default: return <Activity size={11} className="text-cyan-400" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 font-mono select-none">
      <AnimatePresence>
        {isExpanded ? (
          /* Expanded Floating Command Window */
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-[92vw] sm:w-[460px] h-[520px] bg-[#030712]/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_45px_rgba(6,182,212,0.3)] flex flex-col overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-cyan-950/40 border-b border-cyan-500/25 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-400 flex items-center justify-center">
                  <Sparkles size={13} className="text-cyan-300 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>GROQ COMMAND PALETTE</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                      LPU LIVE
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Manage Shortcuts Button */}
                <button
                  onClick={() => setShowManageModal(true)}
                  className="p-1 rounded text-cyan-400/80 hover:bg-cyan-500/20 hover:text-white transition-all"
                  title="Manage Quick Commands"
                >
                  <Sliders size={13} />
                </button>

                {/* Hands-Free Voice Mode Button */}
                <button
                  onClick={toggleHandsFree}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-all flex items-center gap-1 ${
                    isHandsFree
                      ? 'bg-red-500/20 border-red-400 text-red-300 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                      : 'bg-black/40 border-cyan-500/30 text-cyan-400 hover:text-white'
                  }`}
                  title={isHandsFree ? 'Disable Hands-Free Voice' : 'Enable Hands-Free Voice'}
                >
                  <Mic size={11} className={isHandsFree ? 'text-red-400' : 'text-cyan-400'} />
                  <span>{isHandsFree ? 'HANDS-FREE ON' : 'HANDS-FREE'}</span>
                </button>

                {/* Minimize Button */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded text-cyan-400 hover:bg-cyan-500/20 hover:text-white"
                  title="Minimize (⌘J)"
                >
                  <Minimize2 size={14} />
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-1 ${
                    m.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-cyan-500/60 px-1">
                    <span>{m.sender === 'user' ? (m.isVoice ? 'VOICE PROMPT' : 'YOU') : 'CARTER (GROQ)'}</span>
                    <span>&bull;</span>
                    <span>{m.timestamp}</span>
                    {m.latencyMs && <span className="text-cyan-400 font-bold">{m.latencyMs}ms</span>}
                  </div>

                  <div
                    className={`max-w-[88%] p-2.5 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap ${
                      m.sender === 'user'
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-100 rounded-tr-none'
                        : m.sender === 'system'
                        ? 'bg-red-950/40 border border-red-500/40 text-red-200 rounded-tl-none'
                        : 'bg-black/60 border border-cyan-500/25 text-cyan-200 rounded-tl-none shadow-[0_0_15px_rgba(0,0,0,0.4)]'
                    }`}
                  >
                    {m.text}

                    {m.organs && m.organs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-cyan-500/15 text-[9px]">
                        <span className="text-cyan-500/60">Organs:</span>
                        {m.organs.map((o, idx) => (
                          <span key={idx} className="px-1 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                            {o}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Interim Speech Transcript Bubble */}
              {interimTranscript && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-red-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                    Listening in real-time...
                  </span>
                  <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/40 text-red-200 text-[11px] italic">
                    "{interimTranscript}"
                  </div>
                </div>
              )}

              {/* Processing Pulse */}
              {isProcessing && (
                <div className="flex items-center gap-2 text-[11px] text-cyan-400/80 p-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>Groq reasoning & synthesizing organ mesh...</span>
                </div>
              )}
            </div>

            {/* Quick Commands Carousel Bar */}
            <div className="px-3 py-1.5 bg-black/60 border-t border-cyan-500/15 flex items-center gap-1.5 overflow-x-auto text-[10px]">
              <span className="text-cyan-500/60 uppercase text-[9px] flex-shrink-0 flex items-center gap-1 font-bold">
                <Bookmark size={10} className="text-cyan-400" />
                Quick:
              </span>

              {quickCommands.map((qc) => (
                <button
                  key={qc.id}
                  onClick={() => handleProcessGroqTask(qc.prompt)}
                  className={`px-2 py-0.8 rounded-lg border whitespace-nowrap flex items-center gap-1 transition-all flex-shrink-0 ${
                    qc.isCustom
                      ? 'bg-yellow-950/30 border-yellow-500/40 text-yellow-300 hover:bg-yellow-900/50'
                      : 'bg-cyan-950/40 border-cyan-500/25 text-cyan-300 hover:border-cyan-400 hover:text-white'
                  }`}
                  title={qc.prompt}
                >
                  {renderIcon(qc.icon)}
                  <span>{qc.label}</span>
                </button>
              ))}

              <button
                onClick={() => setShowManageModal(true)}
                className="p-1 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 hover:text-white flex-shrink-0"
                title="Add or Customize Quick Commands"
              >
                <Plus size={11} />
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProcessGroqTask(input);
              }}
              className="p-2.5 bg-black/80 border-t border-cyan-500/20 flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening via Web Speech API..." : "Type task or command Carter..."}
                disabled={isProcessing}
                className="flex-1 bg-black/60 border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400 font-mono"
              />

              {/* Bookmark / Save Current Prompt as Shortcut */}
              {input.trim().length > 3 && (
                <button
                  type="button"
                  onClick={handleSaveCurrentAsQuickCommand}
                  className="p-2 rounded-xl bg-yellow-950/40 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-900/60 transition-all"
                  title="Save current prompt as a Quick Command shortcut"
                >
                  <BookmarkPlus size={15} />
                </button>
              )}

              {/* Push-to-Talk Voice Button */}
              <button
                type="button"
                onClick={togglePushToTalk}
                className={`p-2 rounded-xl border transition-all ${
                  isListening
                    ? 'bg-red-500/30 border-red-500 text-red-300 animate-pulse'
                    : 'bg-black/60 border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-300'
                }`}
                title={isListening ? 'Stop Listening' : 'Push to Talk (Web Speech API)'}
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-cyan-200 transition-all disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </form>

            {/* Save Prompt As Quick Command Modal */}
            {showSaveModal && (
              <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                <form
                  onSubmit={handleSaveQuickCommandConfirm}
                  className="w-full max-w-sm bg-[#050c1a] border border-cyan-500/40 rounded-xl p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white border-b border-cyan-500/20 pb-2">
                    <span className="flex items-center gap-1.5">
                      <BookmarkPlus size={14} className="text-yellow-400" />
                      Save Quick Command Shortcut
                    </span>
                    <button type="button" onClick={() => setShowSaveModal(false)} className="text-cyan-500 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] text-cyan-500/80 block mb-1">Shortcut Label</label>
                    <input
                      type="text"
                      value={newCmdLabel}
                      onChange={e => setNewCmdLabel(e.target.value)}
                      placeholder="e.g. Audit Cache, Daily Briefing..."
                      className="w-full bg-black/60 border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-cyan-500/80 block mb-1">Natural Language Prompt</label>
                    <textarea
                      value={newCmdPrompt}
                      onChange={e => setNewCmdPrompt(e.target.value)}
                      rows={2}
                      className="w-full bg-black/60 border border-cyan-500/30 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSaveModal(false)}
                      className="px-3 py-1 rounded bg-black border border-cyan-500/20 text-xs text-cyan-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-yellow-500/20 border border-yellow-400 text-xs text-yellow-200 font-bold hover:bg-yellow-500/30"
                    >
                      Save Shortcut
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Manage Quick Commands Modal */}
            {showManageModal && (
              <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                <div className="w-full max-w-md max-h-[85%] bg-[#050c1a] border border-cyan-500/40 rounded-xl p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                  <div className="flex items-center justify-between text-xs font-bold text-white border-b border-cyan-500/20 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Sliders size={14} className="text-cyan-400" />
                      Manage Quick Commands ({quickCommands.length})
                    </span>
                    <button type="button" onClick={() => setShowManageModal(false)} className="text-cyan-500 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-64">
                    {quickCommands.map((qc) => (
                      <div
                        key={qc.id}
                        className="p-2 rounded-lg bg-black/50 border border-cyan-500/15 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {renderIcon(qc.icon)}
                            <span className="font-bold text-white truncate">{qc.label}</span>
                            {qc.isCustom && (
                              <span className="text-[9px] px-1 py-0.2 bg-yellow-950/60 border border-yellow-500/40 rounded text-yellow-300">
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-cyan-500/70 truncate">{qc.prompt}</div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              setShowManageModal(false);
                              handleProcessGroqTask(qc.prompt);
                            }}
                            className="p-1 rounded bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300"
                            title="Execute"
                          >
                            <Play size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuickCommand(qc.id)}
                            className="p-1 rounded bg-red-950/40 hover:bg-red-900 border border-red-500/30 text-red-300"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-cyan-500/20 pt-2 text-xs">
                    <button
                      onClick={handleResetQuickCommands}
                      className="text-[10px] text-cyan-500/60 hover:text-cyan-300"
                    >
                      Reset to Default
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setNewCmdLabel('');
                          setNewCmdPrompt('');
                          setShowManageModal(false);
                          setShowSaveModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-500/20 border border-cyan-400 text-xs text-white font-bold flex items-center gap-1"
                      >
                        <Plus size={12} /> Add New
                      </button>
                      <button
                        onClick={() => setShowManageModal(false)}
                        className="px-2.5 py-1 rounded bg-black border border-cyan-500/20 text-xs text-cyan-300"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* Minimized Persistent Floating Capsule Button */
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/80 border border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.35)] backdrop-blur-xl"
          >
            {/* Direct Voice Mic Button */}
            <button
              onClick={toggleHandsFree}
              className={`p-2.5 rounded-xl border transition-all ${
                isHandsFree
                  ? 'bg-red-500/30 border-red-400 text-red-300 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  : 'bg-cyan-950/60 border-cyan-500/30 hover:bg-cyan-900 text-cyan-300'
              }`}
              title={isHandsFree ? 'Hands-Free Voice Active (Click to Stop)' : 'Start Hands-Free Voice Mode'}
            >
              <Mic size={16} />
            </button>

            {/* Expand Palette Button */}
            <button
              onClick={() => {
                sound.playTick();
                setIsExpanded(true);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 text-xs text-white font-bold transition-all"
            >
              <Sparkles size={14} className="text-cyan-400 animate-pulse" />
              <span>COMMAND PALETTE</span>
              <span className="px-1.5 py-0.2 bg-black/60 border border-cyan-500/30 rounded text-[9px] text-cyan-400/80">⌘J</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
