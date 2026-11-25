import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Box,
  Brain,
  Cpu,
  Hexagon,
  Layers,
  Mic,
  Network,
  Plug,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  Volume2,
  VolumeX,
  Workflow,
  Zap,
} from 'lucide-react';
import type { Subsystem } from '../../types';
import type { HIOStatus, Profile } from '../../../cognitive-shell/src/hio';
import type { TelemetryEvent } from '../../../cognitive-shell/src/integration/ShellAPI';
import { api } from '../../lib/serverApi';
import { voice } from '../../utils/voice';
import { useLiveCommunication } from '../../lib/liveCommunication';
import CognitiveShellBridge from './CognitiveShellBridge';
import DetectionRing from './DetectionRing';
import './hio-cockpit.css';

const NAV = [
  ['mission_control', 'MISSION', 'Control center', Hexagon],
  ['ai_core', 'AI', 'Intelligence core', Brain],
  ['agents', 'AGENTS', 'Autonomous systems', Network],
  ['workspace', 'WORKSPACE', 'Sandbox & tools', Box],
  ['infra', 'SYSTEM', 'Infrastructure', Cpu],
] as const;

const QUICK_GOALS = [
  { id: 'status', label: 'Daily Brief', sub: 'System status', prompt: 'Give me a brief summary of active work, connected apps, and any pending decisions.', Icon: Activity },
  { id: 'apps', label: 'Apps & MCP', sub: 'Check tools', action: 'apps' as const, Icon: Plug },
  { id: 'voice', label: 'Live Voice', sub: 'Talk & see', action: 'voice' as const, Icon: Mic },
  { id: 'automate', label: 'Automate', sub: 'Workflows', tool: 'automation' as Subsystem, Icon: Workflow },
  { id: 'governance', label: 'Review', sub: 'Approvals', tool: 'governance' as Subsystem, Icon: ShieldCheck },
  { id: 'research', label: 'Explore', sub: 'Capabilities', prompt: 'List available system capabilities and connected MCP tools.', Icon: Search },
] as const;

interface MissionRow {
  mission_id: string;
  objective: string;
  status: string;
}

interface HIOCockpitProps {
  children: (missions: MissionRow[], registry: string) => React.ReactNode;
  onOpenTool: (id: Subsystem) => void;
  onSettings: () => void;
  onReboot?: () => void;
  onQuickGoal?: (goalText: string) => void;
  pendingDecisionCount?: number;
  commandState: string;
}

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={'hio-panel ' + className}>
      <h2>
        {title}
        <span>⌁</span>
      </h2>
      {children}
    </section>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="hio-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function HIOCockpit({
  children,
  onOpenTool,
  onSettings,
  onReboot,
  onQuickGoal,
  pendingDecisionCount = 0,
  commandState,
}: HIOCockpitProps) {
  const preferredProfile = useRef<Profile | 'auto'>('auto');
  const [avatarEnabled, setAvatarEnabled] = useState(true);
  const [status, setStatus] = useState<HIOStatus | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [runtime, setRuntime] = useState(() =>
    sessionStorage.getItem('microfixd_operator_token') || sessionStorage.getItem('microfixd_supabase_access_token')
      ? 'AUTONOMOUS STANDBY'
      : 'SIGN IN TO CONNECT',
  );
  const [profile, setProfile] = useState<Profile | 'auto'>('auto');
  const [voiceEnabled, setVoiceEnabled] = useState(voice.isEnabled());
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [missionState, setMissionState] = useState('Operator access required');
  const [connectorCount, setConnectorCount] = useState<number>(0);
  const [now, setNow] = useState(() => new Date());

  const { connectionState, setDrawerOpen } = useLiveCommunication();

  useEffect(() => {
    const hio = (e: Event) => {
      setStatus((e as CustomEvent<HIOStatus>).detail);
      window.dispatchEvent(new CustomEvent('microfixd:hio-profile', { detail: preferredProfile.current }));
    };
    const telemetry = (e: Event) => {
      const event = (e as CustomEvent<TelemetryEvent>).detail;
      if (event.type === 'system.readiness' || event.type === 'system.deep-health' || event.type.startsWith('connection.') || event.type === 'auth.required') {
        setRuntime(event.state || event.type);
      }
      setEvents((prev) => [event, ...prev].slice(0, 6));
    };
    window.addEventListener('microfixd:hio-status', hio);
    window.addEventListener('microfixd:telemetry', telemetry);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.removeEventListener('microfixd:hio-status', hio);
      window.removeEventListener('microfixd:telemetry', telemetry);
      clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    let dead = false;
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      if (!sessionStorage.getItem('microfixd_operator_token') && !sessionStorage.getItem('microfixd_supabase_access_token')) {
        setMissions([]);
        setMissionState('Operator access required');
        setConnectorCount(0);
        return;
      }
      try {
        const [result, pluginsRes] = await Promise.all([
          api<{ missions: MissionRow[] }>('GET', '/planner/missions'),
          api<{ connectors: unknown[] }>('GET', '/plugins').catch(() => ({ connectors: [] })),
        ]);
        if (!dead && request === generation) {
          setMissions(Array.isArray(result.missions) ? result.missions : []);
          setMissionState('Durable mission registry');
          setConnectorCount(Array.isArray(pluginsRes.connectors) ? pluginsRes.connectors.length : 0);
        }
      } catch {
        if (!dead && request === generation) {
          setMissions([]);
          setMissionState('Mission registry unavailable');
        }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    window.addEventListener('microfixd:mission-created', load);
    window.addEventListener('microfixd:auth-changed', load);
    return () => {
      dead = true;
      generation++;
      clearInterval(timer);
      window.removeEventListener('microfixd:mission-created', load);
      window.removeEventListener('microfixd:auth-changed', load);
    };
  }, []);

  const active = missions.filter((m) => ['queued', 'running', 'waiting'].includes(m.status)).length;
  const completed = missions.filter((m) => m.status === 'succeeded').length;
  const setVisual = (p: Profile | 'auto') => {
    preferredProfile.current = p;
    setProfile(p);
    window.dispatchEvent(new CustomEvent('microfixd:hio-profile', { detail: p }));
  };

  const handleQuickGoalClick = (item: (typeof QUICK_GOALS)[number]) => {
    if ('action' in item && item.action === 'apps') {
      setDrawerOpen(true, 'connections');
      return;
    }
    if ('action' in item && item.action === 'voice') {
      setDrawerOpen(true, 'live');
      return;
    }
    if ('tool' in item && item.tool) {
      onOpenTool(item.tool);
      return;
    }
    if ('prompt' in item && item.prompt && onQuickGoal) {
      onQuickGoal(item.prompt);
    }
  };

  return (
    <div className="hio-cockpit">
      <header className="hio-top">
        <div className="hio-brand">
          <Hexagon />
          <div>
            <b>MICROFIXD</b>
            <small>AUTONOMOUS COGNITIVE OS</small>
          </div>
        </div>

        <div className="hio-top-meta">
          <span>
            <i />
            HIO <b>{!avatarEnabled ? 'PAUSED' : status?.model === 'ready' ? 'ONLINE' : status?.model === 'failed' ? 'UNAVAILABLE' : 'INITIALIZING'}</b>
          </span>
          <span className="hio-clock">
            TIME <b>{now.toLocaleTimeString('en-GB')}</b>
          </span>
          <a
            href="/automotive"
            className="hidden md:inline-block rounded-lg border border-cyan-300/30 bg-black/80 px-2.5 py-1.5 text-[10px] text-cyan-100 whitespace-nowrap hover:bg-cyan-500/15"
          >
            Vector Automotive
          </a>
          <button
            type="button"
            onClick={() => setDrawerOpen(true, 'live')}
            aria-label="Open Live Voice and Vision"
          >
            <Mic size={14} />
            <span>{connectionState === 'live' ? 'LIVE ON' : 'Live Comms'}</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true, 'connections')}
            aria-label="Open Apps and MCP Connections"
          >
            <Plug size={14} />
            <span>Apps &amp; MCP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setVoiceEnabled(voice.toggleVoice());
            }}
            aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
          >
            {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>VOICE {voiceEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <button type="button" onClick={onSettings} aria-label="Open Microfixd settings" title="Open Microfixd settings">
            <Settings2 size={16} />
            <span>Open Microfixd settings</span>
          </button>
          <button type="button" className="hidden sm:flex" onClick={onSettings} aria-label="Settings" title="Settings">
            <Settings2 size={16} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <nav className="hio-nav" aria-label="Main workspace navigation">
        {NAV.map(([id, label, sub, Icon]) => (
          <button key={id} type="button" onClick={() => onOpenTool(id)}>
            <Icon />
            <div>
              <b>{label}</b>
              <small>{sub}</small>
            </div>
            <ArrowUpRight size={12} />
          </button>
        ))}
        <div className="hio-nav-bottom">
          <i />
          RUNTIME <strong>{runtime}</strong>
          <button type="button" onClick={onReboot} aria-label="Replay boot sequence">
            <RotateCcw size={14} />
            Replay boot
          </button>
        </div>
      </nav>

      <div className="hio-left">
        <Panel title="AUTONOMOUS STATUS">
          <Value label="Needs your input" value={pendingDecisionCount > 0 ? `${pendingDecisionCount} waiting` : 'All clear'} />
          <Value label="Active tasks" value={missions.length ? String(active) : '—'} />
          <Value label="Connected apps" value={String(connectorCount)} />
          <Value label="Command status" value={commandState} />
          <button type="button" className="hio-text-button" onClick={() => onOpenTool('mission_control')}>
            Open mission control <ArrowUpRight size={12} />
          </button>
        </Panel>

        <Panel title="COGNITIVE STATE">
          <Value label="Expression" value={status?.state.expression || '—'} />
          <Value label="Speech sync" value={status?.state.sync || 'idle'} />
          <Value label="Routing" value="Auto-run safe work" />
          <p className="hio-note">Routine questions and tasks run automatically; approvals or missing details pause cleanly for you.</p>
        </Panel>
      </div>

      <main className="hio-center">
        <div className="hio-presence-label">
          <span>HOLOGRAPHIC INTERFACE ORGAN</span>
          <b>{status?.state.mode.toUpperCase() || 'INITIALIZING'}</b>
        </div>
        <div className="hio-avatar">
          <DetectionRing commandState={commandState} />
          {avatarEnabled ? (
            <CognitiveShellBridge />
          ) : (
            <div className="hio-avatar-off">
              Holographic presence paused
              <button type="button" onClick={() => setAvatarEnabled(true)}>
                Enable avatar
              </button>
            </div>
          )}
        </div>
        <div className="hio-command-surface">{children(missions,missionState)}</div>
      </main>

      <div className="hio-right">
        <Panel title="HIO PRESENCE">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#678b9a]">Visual profile</span>
            <button type="button" className="hio-text-button !pt-0" onClick={() => setAvatarEnabled((v) => !v)}>
              {avatarEnabled ? 'Pause avatar' : 'Enable avatar'}
            </button>
          </div>
          <div className="hio-profiles" aria-label="Hologram profile">
            {(['auto', 'minimal', 'full', 'diagnostic'] as const).map((p) => (
              <button key={p} type="button" aria-pressed={profile === p} onClick={() => setVisual(p)}>
                {p}
              </button>
            ))}
          </div>
          <details className="hio-telemetry-details">
            <summary>System telemetry</summary>
            <div className="pt-2">
              <Value label="Render rate" value={status?.fps ? `${status.fps} FPS` : 'Measuring'} />
              <div className="hio-meter">
                <span style={{ width: `${Math.min(100, ((status?.fps || 0) / 60) * 100)}%` }} />
              </div>
              <Value label="CPU frame time" value={status ? `${status.frameMs.toFixed(1)} ms` : '—'} />
              <Value label="Head asset" value={status?.model || 'loading'} />
            </div>
          </details>
        </Panel>

        <Panel title="QUICK GOALS">
          <div className="hio-actions">
            {QUICK_GOALS.map((item) => {
              const Icon = item.Icon;
              return (
                <button key={item.id} type="button" onClick={() => handleQuickGoalClick(item)}>
                  <span>
                    <Icon />
                  </span>
                  <b>{item.label}</b>
                  <small>{item.sub}</small>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <footer className="hio-lower">
        <Panel title="ACTIVE WORK">
          <div className="hio-mission-heading">
            <strong>{missions.length || '—'}</strong>
            <span>
              {missionState}
              <small>{missions.length ? `${active} active · ${completed} completed` : 'Connect to view your missions'}</small>
            </span>
          </div>
          {missions.slice(0, 2).map((m) => (
            <div className="hio-mission" key={m.mission_id}>
              <span>{m.objective}</span>
              <b>{m.status}</b>
            </div>
          ))}
          <button type="button" className="hio-text-button" onClick={() => onOpenTool('mission_control')}>
            View missions <ArrowUpRight size={12} />
          </button>
        </Panel>

        <Panel title="APPS &amp; LIVE BRIDGE">
          <div className="hio-core">
            <Zap />
            <div className="space-y-1">
              <b>{connectorCount} app connectors</b>
              <small>REST · GraphQL · Webhooks · Remote MCP · Gemini Live</small>
              <div className="flex flex-wrap gap-3 pt-1">
                <button type="button" className="hio-text-button !pt-0" onClick={() => setDrawerOpen(true, 'connections')}>
                  Connect apps <ArrowUpRight size={12} />
                </button>
                <button type="button" className="hio-text-button !pt-0" onClick={() => onOpenTool('ai_core')}>
                  AI core <ArrowUpRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="RECENT ACTIVITY &amp; TOOLS">
          <div className="hio-event-list">
            {events.length ? (
              events.slice(0, 2).map((e, i) => (
                <div key={`${e.type}-${i}`}>
                  <time>{e.timestamp ? new Date(e.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</time>
                  <span>{e.message || e.type}</span>
                </div>
              ))
            ) : (
              <p className="hio-note !mt-0">System calm — ready for voice, vision, or plain-English goals.</p>
            )}
          </div>
          <div className="hio-workspace-inline">
            {[
              ['workspace', 'Workspace', Terminal],
              ['sandbox', 'Sandbox', Layers],
              ['governance', 'Governance', ShieldCheck],
            ].map(([id, label, Icon]) => {
              const Glyph = Icon as typeof Terminal;
              return (
                <button key={String(id)} type="button" onClick={() => onOpenTool(id as Subsystem)}>
                  <Glyph size={13} />
                  <span>{String(label)}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      </footer>

      <div className="hio-credit">3D head: Lee Perry-Smith / Infinite Realities · CC BY 3.0 · hologram and facial deformation adapted for Microfixd</div>
    </div>
  );
}
