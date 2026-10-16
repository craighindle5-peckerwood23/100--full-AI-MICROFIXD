import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Send, Settings2 } from 'lucide-react';
import type { Subsystem } from '../../types';
import { api, AuthenticationRequiredError } from '../../lib/serverApi';
import { requestOperatorAccess } from '../../lib/operatorAccess';
import { saveUIState } from '../../lib/supabase';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import HIOCockpit from './HIOCockpit';
import SettingsWindow from './SettingsWindow';
import type { SettingsSection } from '../rooms/SettingsRoom';

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
import PlaywrightRoom from '../rooms/PlaywrightRoom';

interface Props {
  onReboot?: () => void;
}

type CommandState = 'READY' | 'PROCESSING' | 'COMPLETE' | 'ERROR';

const ROOM_LABELS: Record<Subsystem, string> = {
  mission_control: 'Mission Control',
  ai_core: 'AI Core',
  agents: 'Agents',
  sandbox: 'Sandbox',
  workspace: 'Workspace',
  infra: 'Infrastructure',
  telemetry: 'Telemetry',
  memory: 'Memory',
  learning: 'Learning',
  automation: 'Automation',
  autonomy: 'Autonomy',
  supabase: 'Supabase',
  governance: 'Governance',
  federation: 'Federation',
  world_thinking: 'World Thinking',
  bible: 'System Reference',
  playwright: 'Browser Automation',
};

export default function HolographicOS({ onReboot }: Props) {
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const [activeTool, setActiveTool] = useState<Subsystem | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [commandState, setCommandState] = useState<CommandState>('READY');
  const [lastOutput, setLastOutput] = useState('System ready.');
  const [lastCommand, setLastCommand] = useState('');

  useEffect(() => {
    const openAccess = () => setSettingsSection('general');
    const openSettings = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        setSettingsSection('general');
      }
      if (event.key === 'Escape' && activeTool) {
        event.preventDefault();
        setActiveTool(null);
      }
    };

    window.addEventListener('microfixd:auth-required', openAccess);
    window.addEventListener('keydown', openSettings);
    return () => {
      window.removeEventListener('microfixd:auth-required', openAccess);
      window.removeEventListener('keydown', openSettings);
    };
  }, [activeTool]);

  const openSettings = (section: SettingsSection = 'general') => {
    setSettingsSection(section);
  };

  const openTool = (tool: Subsystem) => {
    setActiveTool(tool);
    setSettingsSection(null);
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'mission_control': return <MissionControlRoom />;
      case 'ai_core': return <AICoreRoom />;
      case 'agents': return <AgentsRoom />;
      case 'sandbox': return <SandboxRoom />;
      case 'workspace': return <WorkspaceRoom />;
      case 'infra': return <InfraRoom />;
      case 'telemetry': return <TelemetryPanel />;
      case 'memory': return <MemoryRoom />;
      case 'learning': return <LearningRoom />;
      case 'automation': return <AutomationRoom />;
      case 'autonomy': return <AutonomyRoom />;
      case 'supabase': return <SupabaseRoom />;
      case 'governance': return <ConstitutionalRoom />;
      case 'federation': return <FederationRoom />;
      case 'world_thinking': return <WorldThinkingOversightRoom />;
      case 'bible': return <BibleRoom />;
      case 'playwright': return <PlaywrightRoom />;
      default: return null;
    }
  };

  const handleCommandSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const task = commandInput.trim();
    if (!task || commandState === 'PROCESSING') return;

    setLastCommand(task);
    setLastOutput('Processing request…');
    setCommandState('PROCESSING');
    setCommandInput('');
    sound.playCognitivePulse();

    try {
      const run = () => api<any>('POST', '/command/run', {
        task,
        source: 'os-shell',
        priority: 'normal',
        context: { surface: 'holographic-os' },
      });

      let result;
      try {
        result = await run();
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) {
          await requestOperatorAccess();
          result = await run();
        } else {
          throw error;
        }
      }

      const output = String(
        result?.output ||
        result?.message ||
        result?.result ||
        'Command completed.',
      );

      setLastOutput(output);
      setCommandState(result?.success === false ? 'ERROR' : 'COMPLETE');

      if (output && voice.isEnabled()) {
        void voice.speak(output).catch(() => {});
      }

      saveUIState({
        last_command: task,
        state_data: {
          lastAnswer: output,
          commandId: result?.cmdId,
          success: result?.success !== false,
          organsUsed: result?.organs_used || result?.organsUsed || [],
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastOutput(message || 'Command execution failed.');
      setCommandState('ERROR');
    }
  };

  return (
    <>
      <HIOCockpit onOpenTool={openTool} onSettings={()=>openSettings('general')} onReboot={onReboot} commandState={commandState}>
        <section aria-live="polite" className="hio-output">
          <div className="hio-output-header"><span>{commandState}</span><span>{lastCommand||'MICROFIXD // AT YOUR SERVICE'}</span></div>
          <div className="hio-answer">{lastOutput}</div>
        </section>
        <form onSubmit={handleCommandSubmit} className="hio-form">
          <input value={commandInput} onChange={event=>setCommandInput(event.target.value)} placeholder="What would you like me to accomplish?" aria-label="Microfixd command"/>
          <button type="submit" disabled={!commandInput.trim()||commandState==='PROCESSING'} aria-label="Send command">{commandState==='PROCESSING'?<Loader2 size={17} className="animate-spin"/>:<Send size={17}/>}</button>
        </form>
      </HIOCockpit>

      {settingsSection && (
        <SettingsWindow
          initialSection={settingsSection}
          onClose={() => {
            setSettingsSection(null);
            window.dispatchEvent(new Event('microfixd:auth-cancelled'));
          }}
          onNavigate={openTool}
          onReboot={onReboot}
        />
      )}

      {activeTool && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[#02060b] text-cyan-100">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-cyan-300/15 bg-black/70 px-3 sm:px-5 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
              >
                <ArrowLeft size={15} />
                Hologram
              </button>
              <span className="truncate text-xs font-semibold tracking-[0.12em] text-cyan-200">
                {ROOM_LABELS[activeTool]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openSettings('general')}
              className="rounded-lg border border-cyan-300/20 p-2 text-cyan-200 hover:bg-cyan-400/10"
              aria-label="Open settings"
            >
              <Settings2 size={16} />
            </button>
          </header>
          <main className="min-h-0 flex-1 overflow-hidden">
            {renderTool()}
          </main>
        </div>
      )}
    </>
  );
}
