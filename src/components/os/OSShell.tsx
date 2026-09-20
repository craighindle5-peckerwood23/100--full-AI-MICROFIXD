import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Subsystem } from '../../types';
import { 
  Rocket, 
  Radio, 
  Users, 
  Box, 
  Terminal, 
  Cpu, 
  Activity, 
  Network, 
  Brain, 
  GitBranch, 
  Database, 
  ShieldCheck, 
  BookOpen, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Send, 
  Command, 
  Mic, 
  Sparkles,
  CheckCircle2,
  Server,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import { omniRouter } from '../../utils/omniRouter';
import { getSupabaseCredentials } from '../../lib/supabase';
import { autonomousCore } from '../../autonomy/autonomousCore';

// Page Rooms (Complete Pages)
import MissionControlRoom from '../rooms/MissionControlRoom';
import AICoreRoom from '../rooms/AICoreRoom';
import AgentsRoom from '../rooms/AgentsRoom';
import SandboxRoom from '../rooms/SandboxRoom';
import WorkspaceRoom from '../rooms/WorkspaceRoom';
import InfraRoom from '../rooms/InfraRoom';
import TelemetryPanel from '../rooms/TelemetryPanel';
import MemoryRoom from '../rooms/MemoryRoom';
import LearningRoom from '../rooms/LearningRoom';
import AutomationRoom from '../rooms/AutomationRoom';
import AutonomyRoom from '../rooms/AutonomyRoom';
import SupabaseRoom from '../rooms/SupabaseRoom';
import ConstitutionalRoom from '../rooms/ConstitutionalRoom';
import FederationRoom from '../rooms/FederationRoom';
import BibleRoom from '../rooms/BibleRoom';
import FallbackAlertBanner from './FallbackAlertBanner';

interface Props {
  onReboot?: () => void;
}

interface NavItem {
  id: Subsystem;
  label: string;
  hotkey: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'autonomy', label: 'Autonomous Core', hotkey: 'A', icon: ShieldAlert },
  { id: 'mission_control', label: 'Mission Control', hotkey: '1', icon: Rocket },
  { id: 'ai_core', label: 'Omni Router', hotkey: '2', icon: Radio },
  { id: 'agents', label: 'Agent Matrix', hotkey: '3', icon: Users },
  { id: 'sandbox', label: 'Sandbox', hotkey: '4', icon: Box },
  { id: 'workspace', label: 'Workspace', hotkey: '5', icon: Terminal },
  { id: 'infra', label: 'Infrastructure', hotkey: '6', icon: Cpu },
  { id: 'telemetry', label: 'Telemetry', hotkey: '7', icon: Activity },
  { id: 'memory', label: 'Memory Graph', hotkey: '8', icon: Network },
  { id: 'learning', label: 'Continual Learning', hotkey: '9', icon: Brain },
  { id: 'automation', label: 'Automation', hotkey: '0', icon: GitBranch },
  { id: 'supabase', label: 'Supabase Cloud', hotkey: 'S', icon: Database },
  { id: 'governance', label: 'Constitutional', hotkey: 'C', icon: ShieldCheck },
  { id: 'federation', label: 'Federation', hotkey: 'F', icon: Network },
  { id: 'bible', label: 'OS Bible', hotkey: 'B', icon: BookOpen },
];

export default function OSShell({ onReboot }: Props) {
  const [activeSubsystem, setActiveSubsystem] = useState<Subsystem>('ai_core');
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(voice.isEnabled());
  const [isSpeaking, setIsSpeaking] = useState(voice.isSpeaking());
  const [commandInput, setCommandInput] = useState('');
  const [isCommandRunning, setIsCommandRunning] = useState(false);
  const [activeModel, setActiveModel] = useState('Groq / Gemini / DeepSeek');
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [watchdogStatus, setWatchdogStatus] = useState(autonomousCore.getWatchdog());
  const [fallbackState, setFallbackState] = useState(autonomousCore.getFallbackAlert());

  // Subscribe to voice synthesis & autonomous core state
  useEffect(() => {
    const unsubVoice = voice.subscribe((speaking) => {
      setIsSpeaking(speaking);
    });
    const unsubAutonomy = autonomousCore.subscribe(() => {
      setWatchdogStatus({ ...autonomousCore.getWatchdog() });
      setFallbackState({ ...autonomousCore.getFallbackAlert() });
    });
    return () => {
      unsubVoice();
      unsubAutonomy();
    };
  }, []);

  // Check Supabase and Omni Router status
  useEffect(() => {
    const creds = getSupabaseCredentials();
    setSupabaseConnected(Boolean(creds.url && creds.anonKey));
    const provs = omniRouter.getProviders();
    const activeOne = Object.values(provs).find(p => p.apiKey && p.enabled);
    if (activeOne) {
      setActiveModel(`${activeOne.name} (${activeOne.model})`);
    }
  }, [activeSubsystem]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const match = NAV_ITEMS.find(n => n.hotkey.toLowerCase() === e.key.toLowerCase());
      if (match) {
        handleNavigate(match.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (subsystem: Subsystem) => {
    if (subsystem === activeSubsystem) return;
    sound.playWarp();
    setActiveSubsystem(subsystem);

    // Announce space navigation via synthetic voice
    const item = NAV_ITEMS.find(n => n.id === subsystem);
    if (item && voice.isEnabled()) {
      voice.speak(`Accessing ${item.label}.`);
    }
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || isCommandRunning) return;

    const query = commandInput.trim();
    setCommandInput('');
    sound.playCognitivePulse();
    setIsCommandRunning(true);

    const lower = query.toLowerCase();

    // Natural language routing triggers
    if (lower.includes('autonom') || lower.includes('watchdog') || lower.includes('heal') || lower.includes('oversight') || lower.includes('execution')) {
      handleNavigate('autonomy');
      voice.speak('Opening Autonomous Core, Watchdog and Execution Engine.');
    } else if (lower.includes('mission')) {
      handleNavigate('mission_control');
      voice.speak('Switching to Mission Control.');
    } else if (lower.includes('omni') || lower.includes('ai') || lower.includes('router') || lower.includes('groq') || lower.includes('gemini') || lower.includes('deepseek')) {
      handleNavigate('ai_core');
      voice.speak('Opening Omni LLM Router and AI Core.');
    } else if (lower.includes('agent') || lower.includes('carter') || lower.includes('sentinel')) {
      handleNavigate('agents');
      voice.speak('Opening Agent Matrix.');
    } else if (lower.includes('sandbox') || lower.includes('wasm') || lower.includes('code')) {
      handleNavigate('sandbox');
      voice.speak('Opening Sandbox Orchestrator.');
    } else if (lower.includes('supabase') || lower.includes('database') || lower.includes('sql')) {
      handleNavigate('supabase');
      voice.speak('Opening Supabase Cloud Backend.');
    } else if (lower.includes('safety') || lower.includes('constitutional') || lower.includes('directive')) {
      handleNavigate('governance');
      voice.speak('Opening Chapter 15 Constitutional Safety.');
    } else if (lower.includes('bible') || lower.includes('doc') || lower.includes('chapter')) {
      handleNavigate('bible');
      voice.speak('Opening Microfyxd OS 25-Chapter Architecture Bible.');
    } else if (lower.includes('telemetry') || lower.includes('health') || lower.includes('metric')) {
      handleNavigate('telemetry');
      voice.speak('Streaming live telemetry at 100 Hertz.');
    } else if (lower.includes('memory')) {
      handleNavigate('memory');
      voice.speak('Accessing memory graphs.');
    } else if (lower.includes('learn')) {
      handleNavigate('learning');
      voice.speak('Entering Continual Learning loop.');
    } else if (lower.includes('auto')) {
      handleNavigate('automation');
      voice.speak('Accessing Automation pipelines.');
    } else {
      // Execute query through Omni LLM Router with fallback!
      try {
        const result = await omniRouter.execute(query);
        voice.speak(result.text.slice(0, 180));
      } catch {
        voice.speak('Command processed by microkernel.');
      }
    }

    setIsCommandRunning(false);
  };

  // Render the selected full page
  const renderCurrentPage = () => {
    switch (activeSubsystem) {
      case 'autonomy':
        return <AutonomyRoom />;
      case 'mission_control':
        return <MissionControlRoom />;
      case 'ai_core':
        return <AICoreRoom />;
      case 'agents':
        return <AgentsRoom />;
      case 'sandbox':
        return <SandboxRoom />;
      case 'workspace':
        return <WorkspaceRoom />;
      case 'infra':
        return <InfraRoom />;
      case 'telemetry':
        return <TelemetryPanel />;
      case 'memory':
        return <MemoryRoom />;
      case 'learning':
        return <LearningRoom />;
      case 'automation':
        return <AutomationRoom />;
      case 'supabase':
        return <SupabaseRoom />;
      case 'governance':
        return <ConstitutionalRoom />;
      case 'federation':
        return <FederationRoom />;
      case 'bible':
        return <BibleRoom />;
      default:
        return <AICoreRoom />;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#020509] flex flex-col overflow-hidden font-mono text-cyan-400 select-none">
      {/* Ambient background styling */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.08)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* TOP SYSTEM OS BAR */}
      <header className="w-full z-40 px-4 py-2.5 border-b border-cyan-500/20 bg-black/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            <span className="font-black text-xs text-white">MFX</span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-widest">MICROFYXD OS</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-400/40 text-cyan-300 font-bold">
                LEVEL 6 SYNTHETIC AI
              </span>
            </div>
            <span className="text-[10px] text-cyan-500/80 hidden sm:inline">
              RING-0 MICROKERNEL v6.2.0 &bull; ZERO-TRUST LATTICE
            </span>
          </div>
        </div>

        {/* Center: Real-time Telemetry Strip */}
        <div className="hidden xl:flex items-center gap-4 text-[10px] px-3 py-1 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-500/80">CPU:</span>
            <span className="text-white font-bold">28%</span>
          </span>
          <span className="text-cyan-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="text-cyan-500/80">HBM3e:</span>
            <span className="text-white font-bold">42.8 GB</span>
          </span>
          <span className="text-cyan-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="text-cyan-500/80">H100 TENSOR:</span>
            <span className="text-cyan-300 font-bold">71%</span>
          </span>
          <span className="text-cyan-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="text-cyan-500/80">TOKEN SPEED:</span>
            <span className="text-emerald-400 font-bold">184 t/s</span>
          </span>
        </div>

        {/* Right: Cloud status & Audio / Voice Controls */}
        <div className="flex items-center gap-2">
          {/* Supabase Link Chip */}
          <button
            onClick={() => handleNavigate('supabase')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
              activeSubsystem === 'supabase'
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                : supabaseConnected
                ? 'bg-cyan-950/40 border-emerald-500/40 text-emerald-300 hover:bg-cyan-900/60'
                : 'bg-black/50 border-cyan-500/20 text-cyan-400/80 hover:text-white'
            }`}
            title="Supabase Cloud PostgreSQL Status"
          >
            <Database size={13} className={supabaseConnected ? 'text-emerald-400' : 'text-cyan-400'} />
            <span className="hidden md:inline font-bold">
              {supabaseConnected ? 'SUPABASE LINKED' : 'SUPABASE FALLBACK'}
            </span>
          </button>

          {/* Autonomous Core & Watchdog Chip */}
          <button
            onClick={() => handleNavigate('autonomy')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
              activeSubsystem === 'autonomy'
                ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                : fallbackState.active && !fallbackState.dismissed
                ? 'bg-amber-950/80 border-amber-400 text-amber-300 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : fallbackState.manualOverrideActive
                ? 'bg-red-950/80 border-red-400 text-red-200'
                : watchdogStatus.status === 'REPAIRING'
                ? 'bg-amber-950/60 border-amber-400/60 text-amber-300'
                : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300 hover:text-white'
            }`}
            title="Autonomous Core & Watchdog Supervisor"
          >
            <ShieldAlert size={13} className={fallbackState.active ? 'text-amber-400' : 'text-cyan-400'} />
            <span className="hidden sm:inline font-bold">
              {fallbackState.manualOverrideActive
                ? 'CORE: OVERRIDE'
                : fallbackState.active
                ? 'CORE: FALLBACK'
                : watchdogStatus.status === 'REPAIRING'
                ? 'CORE: HEALING'
                : 'AUTONOMOUS CORE'}
            </span>
          </button>

          {/* Omni Router Provider Chip */}
          <button
            onClick={() => handleNavigate('ai_core')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
              activeSubsystem === 'ai_core'
                ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300 hover:text-white'
            }`}
            title="Omni LLM Router: Groq + Gemini + DeepSeek"
          >
            <Radio size={13} className="text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline font-bold">OMNI ROUTER</span>
          </button>

          {/* Synthetic Voice Waveform & Toggle */}
          <button
            onClick={() => {
              const state = voice.toggleVoice();
              setIsVoiceEnabled(state);
              sound.playTick();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
              isVoiceEnabled
                ? 'bg-cyan-950/60 border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'bg-black/50 border-cyan-900 text-cyan-700'
            }`}
            title={isVoiceEnabled ? 'Synthetic Voice Enabled (Click to Mute)' : 'Synthetic Voice Muted'}
          >
            {/* Live voice audio equalizer bars */}
            <div className="flex items-center gap-0.5 h-3">
              <span className={`w-0.5 rounded-full bg-cyan-400 transition-all ${isSpeaking ? 'h-3 animate-pulse' : 'h-1'}`} />
              <span className={`w-0.5 rounded-full bg-cyan-400 transition-all ${isSpeaking ? 'h-4 animate-bounce' : 'h-1.5'}`} />
              <span className={`w-0.5 rounded-full bg-cyan-400 transition-all ${isSpeaking ? 'h-2 animate-pulse' : 'h-1'}`} />
            </div>
            <span className="text-[11px] font-bold">
              {isVoiceEnabled ? (isSpeaking ? 'SPEAKING' : 'VOICE ON') : 'VOICE OFF'}
            </span>
          </button>

          {/* Sound Chimes Toggle */}
          <button
            onClick={() => {
              const next = sound.toggleMute();
              setIsMuted(next);
            }}
            className="p-1.5 rounded-lg border border-cyan-500/20 text-cyan-400/80 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Reboot Button */}
          {onReboot && (
            <button
              onClick={() => {
                sound.playWarp();
                voice.speak('Initiating system reboot.');
                onReboot();
              }}
              className="p-1.5 rounded-lg border border-cyan-500/20 text-cyan-400/80 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
              title="Re-run Startup Sequence"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </header>

      {/* VISUAL INDICATOR SYSTEM: FALLBACK ALERT BANNER WITH UNDO / MANUAL OVERRIDE */}
      <FallbackAlertBanner onOpenAutonomyRoom={() => handleNavigate('autonomy')} />

      {/* MODERN OS NAVIGATION SPACE SELECTOR (Tabs / Pills) */}
      <nav className="w-full z-30 px-3 py-1.5 bg-black/60 border-b border-cyan-500/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {NAV_ITEMS.map(item => {
          const isActive = activeSubsystem === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs tracking-wider whitespace-nowrap transition-all uppercase ${
                isActive 
                  ? 'bg-cyan-500/20 border border-cyan-400 text-white font-bold shadow-[0_0_12px_rgba(6,182,212,0.25)]' 
                  : 'bg-transparent border border-transparent text-cyan-500/80 hover:text-cyan-200 hover:bg-cyan-950/30'
              }`}
            >
              <Icon size={13} className={isActive ? 'text-cyan-300' : 'text-cyan-600'} />
              <span>{item.label}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                isActive ? 'bg-cyan-950 text-cyan-300' : 'bg-black/40 text-cyan-700'
              }`}>
                {item.hotkey}
              </span>
            </button>
          );
        })}
      </nav>

      {/* MAIN VIEWPORT: COMPLETE NEW PAGE (NO OVERLAY, NO HOLOGRAPHIC HEAD) */}
      <main className="flex-1 w-full overflow-hidden relative z-10 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubsystem}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full h-full flex flex-col overflow-hidden"
          >
            {renderCurrentPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* BOTTOM OS SYNTHETIC VOICE COMMAND BAR */}
      <footer className="w-full z-30 px-4 py-2 border-t border-cyan-500/20 bg-black/85 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <form 
          onSubmit={handleCommandSubmit}
          className="w-full sm:max-w-2xl flex items-center gap-2 p-1.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 focus-within:border-cyan-400 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all"
        >
          <div className="pl-2 text-cyan-400">
            <Command size={13} />
          </div>
          <input
            type="text"
            value={commandInput}
            onChange={e => setCommandInput(e.target.value)}
            placeholder="Command Carter or switch page... (e.g. 'open mission control', 'audit safety', 'test supabase')"
            className="flex-1 bg-transparent px-2 py-0.5 text-xs text-white placeholder:text-cyan-700 focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={isCommandRunning || !commandInput.trim()}
            className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200 text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-40"
          >
            <Send size={11} />
            <span className="hidden md:inline">Execute</span>
          </button>
        </form>

        {/* Quick action chips */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-cyan-500/80">
          <span>SHORTCUTS:</span>
          {[
            { name: 'Autonomous Core', id: 'autonomy' },
            { name: 'Missions', id: 'mission_control' },
            { name: 'Omni Router', id: 'ai_core' },
            { name: 'Supabase', id: 'supabase' },
            { name: 'Safety', id: 'governance' },
            { name: 'Bible', id: 'bible' },
          ].map(chip => (
            <button
              key={chip.name}
              onClick={() => handleNavigate(chip.id as Subsystem)}
              className="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-300 hover:border-cyan-400 hover:text-white transition-all"
            >
              {chip.name}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
