import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Send, Settings2 } from 'lucide-react';
import type { Mission, Artifact, Task } from '../../../server/planner/executionSpine';
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
  const catalogInitialized = useRef(false);
  const submission = useRef<{signature:string;key:string}|null>(null);
  const [missionId, setMissionId] = useState('');
  const [mode, setMode] = useState<'mission' | 'chat'>('mission');
  const [tools, setTools] = useState<{name:string;description:string}[]>([]);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [origins, setOrigins] = useState('');
  const [missionStatus, setMissionStatus] = useState('');
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
      case 'mission_control': return <MissionControlRoom initialMissionId={missionId} />;
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

  useEffect(() => {
    let stopped = false;
    const refreshCatalog = () => void api<{tools:{name:string;description:string}[]}>('GET', '/planner/tools').then(result => {
      if (!stopped) { setTools(result.tools); if (!catalogInitialized.current) { setAllowedTools(result.tools.map(t=>t.name)); catalogInitialized.current=true; } }
    }).catch(error => { if (!stopped) setLastOutput(`Tool catalog unavailable: ${error.message}`); });
    refreshCatalog();
    window.addEventListener('microfixd:auth-changed',refreshCatalog);
    return () => { stopped = true; window.removeEventListener('microfixd:auth-changed',refreshCatalog); };
  }, []);

  useEffect(() => {
    if (!missionId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const detail = await api<{mission:Mission;tasks:Task[];artifacts:Artifact[];approvals:{status:string}[];errors:{code:string}[]}>('GET', `/planner/missions/${missionId}`);
        if (stopped) return;
        const status = detail.mission.status;
        setMissionStatus(status);
        const final = detail.artifacts.find(a => a.artifact_id === detail.mission.result_artifact_id);
        const output = final ? (typeof final.content === 'string' ? final.content : JSON.stringify(final.content))
          : detail.approvals.some(a => a.status === 'pending') ? 'Waiting for approval. Open this mission to review the exact action.'
          : status === 'waiting' ? `Mission paused: ${detail.errors.map(e=>e.code).join(', ') || 'see mission details'}. Open this mission for recovery details.`
          : status === 'failed' ? `Mission failed: ${detail.errors.map(e=>e.code).join(', ') || 'see mission details'}. Open this mission for persisted results and recovery details.`
          : `${status}: ${detail.tasks.filter(t => t.status === 'succeeded').length}/${detail.tasks.length} tasks completed.`;
        setLastOutput(output);
        if (status === 'succeeded' || status === 'failed') {
          setCommandState(status === 'succeeded' ? 'COMPLETE' : 'ERROR');
          if (voice.isEnabled()) void voice.speak(output).catch(() => {});
          return;
        }
        timer = setTimeout(() => void refresh(), 3000);
      } catch (error) {
        if (!stopped) {
          setLastOutput(`Mission status unavailable: ${error instanceof Error ? error.message : String(error)}. Open this mission to retry; it has not been resubmitted.`);
          timer = setTimeout(() => void refresh(), 5000);
        }
      }
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, [missionId]);

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
      const signature = JSON.stringify({task,allowedTools,origins});
      if (submission.current?.signature !== signature) submission.current = {signature,key:crypto.randomUUID()};
      const key = submission.current.key;
      const run = () => mode === 'mission'
        ? api<Mission>('POST', '/planner/missions', {objective:task,tool_permissions:allowedTools,browser_origins:origins.split(',').map(v=>v.trim()).filter(Boolean)}, {'Idempotency-Key':key})
        : api<any>('POST', '/command/run', {
        mode:'chat',
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

      if (mode === 'mission') {
        submission.current = null;
        setMissionId(result.mission_id);
        setMissionStatus(result.status);
        setLastOutput('Mission saved. Waiting for the durable worker.');
        return;
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
      setCommandInput(task);
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
          {missionId && <button type="button" onClick={()=>openTool('mission_control')}>Open mission • {missionStatus}</button>}
        </section>
        <div className="text-xs">
          <label>Command mode <select aria-label="Command mode" value={mode} disabled={commandState==='PROCESSING'} onChange={e=>setMode(e.target.value as 'mission'|'chat')}><option value="mission">Do a task (durable mission)</option><option value="chat">Ask a question</option></select></label>
          {mode==='mission' && <details><summary>Authorized tool scope ({allowedTools.length} tools)</summary>
            <p>All tools are selected by default. Owner missions use standing authorization; other accounts retain manual approval.</p>
            {tools.map(tool=><label key={tool.name} className="block" title={tool.description}><input type="checkbox" disabled={commandState==='PROCESSING'} checked={allowedTools.includes(tool.name)} onChange={e=>setAllowedTools(prev=>e.target.checked?[...prev,tool.name]:prev.filter(n=>n!==tool.name))}/>{tool.name}</label>)}
            <label>Allowed HTTPS origins<input aria-label="Allowed HTTPS origins" disabled={commandState==='PROCESSING'} value={origins} onChange={e=>setOrigins(e.target.value)} placeholder="https://example.com"/></label>
          </details>}
        </div>
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
