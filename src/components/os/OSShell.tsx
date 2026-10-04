import SettingsWindow from './SettingsWindow';
import type {SettingsSection} from '../rooms/SettingsRoom';
import {deliverSpokenResponse} from '../../lib/outputDelivery';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Subsystem, AvatarState } from '../../types';
import Avatar from './Avatar';
import OrbitRing from './OrbitRing';
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
  Zap, Settings2
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import { omniRouter } from '../../utils/omniRouter';
import { getSupabaseCredentials, saveUIState, getUIState } from '../../lib/supabase';
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
import WorldThinkingOversightRoom from '../rooms/WorldThinkingOversightRoom';
import FallbackAlertBanner from './FallbackAlertBanner';
import GlobalCommandConsole from './GlobalCommandConsole';
import FloatingCommandPalette from './FloatingCommandPalette';

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
  { id: 'world_thinking', label: 'World Thinking & Oversight', hotkey: 'W', icon: Brain },
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
  const [activeSubsystem, setActiveSubsystem] = useState<Subsystem>('workspace');
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(voice.isEnabled());
  const [isSpeaking, setIsSpeaking] = useState(voice.isSpeaking());
  const [commandInput, setCommandInput] = useState('');
  const [isCommandRunning, setIsCommandRunning] = useState(false);
  const [activeModel, setActiveModel] = useState('Groq / Gemini / DeepSeek');
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [watchdogStatus, setWatchdogStatus] = useState(autonomousCore.getWatchdog());
  const [fallbackState, setFallbackState] = useState(autonomousCore.getFallbackAlert());
  const [isCommandConsoleOpen, setIsCommandConsoleOpen] = useState(false);

  // Holographic Core: the persistent avatar + glassmorphic orbit room-selector.
  // Starts open (full "hologram + orbit" view) right after boot; once a room
  // is picked it shrinks to a small always-present corner icon that can be
  // clicked again at any time to reopen the orbit menu.
  const [orbitOpen, setOrbitOpen] = useState(false);
  const [settingsSection,setSettingsSection]=useState<SettingsSection | null>(null);

  // Derive the avatar's visual/emotional state from real system signals
  // instead of a hardcoded value, so the "living" holographic entity
  // actually reflects autonomous core health, connectivity fallback, and
  // in-flight commands.
  const avatarState: AvatarState =
    fallbackState.active && !fallbackState.dismissed
      ? 'alert'
      : watchdogStatus.status === 'REPAIRING'
      ? 'processing'
      : isCommandRunning
      ? 'processing'
      : isSpeaking
      ? 'learning'
      : 'idle';

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
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {e.preventDefault();setSettingsSection('general');setOrbitOpen(false);return;}
      if (document.querySelector('dialog[open]')) return;
      // Global hotkey to open Command Console: Cmd+K / Ctrl+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandConsoleOpen(prev => !prev);
        return;
      }

      if (e.key === 'Escape' && isCommandConsoleOpen) {
        e.preventDefault();
        setIsCommandConsoleOpen(false);
        return;
      }

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
  }, [isCommandConsoleOpen, activeSubsystem]);

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

    try {
      // Intelligence Central Command & Main Orchestrator (Groq / OmniRouter)
      const decision = await omniRouter.evaluateAndOrchestrate(query, activeSubsystem);

      // 1. If Groq decides to target or switch a subsystem, navigate smoothly
      if (decision.targetSubsystem && decision.targetSubsystem !== activeSubsystem) {
        handleNavigate(decision.targetSubsystem as Subsystem);
      }

      // 2. If Groq decides to dispatch an agent action, dispatch to agent matrix
      if (decision.actionName) {
        fetch('/api/agents/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: decision.actionName, query }),
        }).catch(() => {});
      }

      // 3. Speak the contoured, natural expressive speech output aloud
      if (decision.speech && voice.isEnabled()) {
        await deliverSpokenResponse(decision,text=>voice.speak(text));
      }

      // 4. Persist interaction to Supabase UI State
      saveUIState({
        last_command: query,
        state_data: {
          lastThought: decision.thought,
          lastProvider: decision.providerUsed,
          lastAnswer: decision.detailedAnswer,
          latencyMs: decision.latencyMs
        }
      });
    } catch (err) {
      console.error('[command] Output incomplete:', err);
      void voice.speak(`Command or playback failed. ${String(err)}`).catch(() => {});
    } finally {
      setIsCommandRunning(false);
    }
  };

  // Render the selected full page
  const renderCurrentPage = () => {
    switch (activeSubsystem) {
      case 'autonomy':
        return <AutonomyRoom />;
      case 'world_thinking':
        return <WorldThinkingOversightRoom />;
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

        <div className="flex items-center gap-2">
          <button onClick={()=>{setSettingsSection('general');setOrbitOpen(false);}} className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20" title="Settings (Ctrl+,)"><Settings2 size={16}/>Settings</button>
          {/* Global Command Console Overlay Trigger */}
          <button
            onClick={() => {
              sound.playTick();
              setIsCommandConsoleOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 text-xs shadow-[0_0_12px_rgba(6,182,212,0.15)] transition-all font-bold"
            title="Open Global Command Console (⌘K)"
          >
            <Terminal size={13} className="text-cyan-400" />
            <span className="hidden sm:inline">CONSOLE</span>
            <span className="px-1 py-0.2 bg-black/60 border border-cyan-500/30 rounded text-[9px] text-cyan-400/80">⌘K</span>
          </button>

          {isSpeaking && <button onClick={()=>voice.stop()} className="px-3 py-2 text-xs text-cyan-300">Stop speech</button>}
        </div>
      </header>

      {/* VISUAL INDICATOR SYSTEM: FALLBACK ALERT BANNER WITH UNDO / MANUAL OVERRIDE */}
      <FallbackAlertBanner onOpenAutonomyRoom={() => handleNavigate('autonomy')} />

      {/* HOLOGRAPHIC CORE: the always-present avatar entity + glassmorphic
          orbit ring that drops you into any room. Sits above everything
          else; shrinks to a corner icon once a room is chosen, and can be
          reopened at any time by clicking the avatar again. */}
      <div className="fixed inset-0 z-[35] pointer-events-none">
        {orbitOpen && <OrbitRing
          onOpenSettings={()=>{setSettingsSection('general');setOrbitOpen(false);}}
          activeSubsystem={orbitOpen ? null : activeSubsystem}
          onSelect={(subsystem) => {
            handleNavigate(subsystem);
            setOrbitOpen(false);
          }}
        />}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <Avatar
              state={avatarState}
              isZoomed={!orbitOpen}
              onClick={() => setOrbitOpen(o => !o)}
              speechText={isSpeaking ? 'Synthesizing response...' : null}
            />
          </div>
        </div>
      </div>

      {/* MODERN OS NAVIGATION SPACE SELECTOR (Tabs / Pills) */}
      <nav aria-label="Main workspace navigation" className="w-full z-30 px-3 py-1.5 bg-black/60 border-b border-cyan-500/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {NAV_ITEMS.filter(item => ['workspace','sandbox'].includes(item.id)).map(item => {
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
        <button onClick={()=>setSettingsSection('missions')} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Manage missions</button>
        <span className="ml-auto hidden sm:block px-3 text-[10px] text-slate-500">{NAV_ITEMS.find(item=>item.id===activeSubsystem)?.label}</span>
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

        <button onClick={()=>{setSettingsSection('general');setOrbitOpen(false);}} className="text-xs text-cyan-300 shrink-0">Settings & access</button>
      </footer>

      {settingsSection && <SettingsWindow initialSection={settingsSection} onClose={()=>setSettingsSection(null)} onNavigate={handleNavigate} onReboot={onReboot}/>}
      {/* Global Command Console Overlay (⌘K / Ctrl+K) */}
      <GlobalCommandConsole
        isOpen={isCommandConsoleOpen}
        onClose={() => setIsCommandConsoleOpen(false)}
        onNavigate={handleNavigate}
        activeSubsystem={activeSubsystem}
      />

      {/* Persistent Floating Command Palette & Hands-Free Web Speech Voice (⌘J / Ctrl+J) */}
      <FloatingCommandPalette
        onNavigate={handleNavigate}
        activeSubsystem={activeSubsystem}
      />
    </div>
  );
}
