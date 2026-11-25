import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../lib/serverApi';
import { useLiveCommunication } from '../../lib/liveCommunication';

interface LiveStatusResponse {
  configured: boolean;
  models: { fast: string; extended: string };
  voices: string[];
  activeSessions: number;
}

interface ConnectorTemplate {
  templateId: string;
  name: string;
  category: string;
  transport: string;
  description: string;
  defaultBaseUrl: string;
  auth: { type: string; env?: string; header?: string };
  tools: Array<{ name: string; description?: string; method?: string; path: string; risk?: string }>;
}

interface InstalledConnectorSummary {
  id: string;
  name: string;
  transport: string;
  category: string;
  baseUrl: string;
  enabled: boolean;
  authType: string;
  credentialConfigured: boolean;
  tools: Array<{ name: string; description?: string; risk?: string }>;
}

export default function LiveCommunicationDrawer() {
  const {
    drawerOpen,
    drawerTab: tab,
    setDrawerOpen,
    setDrawerTab: setTab,
    connectionState,
    modelProfile,
    setModelProfile,
    voicePreset,
    setVoicePreset,
    micMuted,
    toggleMute,
    visionSource,
    turnState,
    fps,
    lastError,
    transcripts,
    toolActivities,
    videoStream,
    startLiveSession,
    stopLiveSession,
    startVision,
    stopVision,
    sendTextTurn,
    interrupt,
    toggleTranscriptExpand,
  } = useLiveCommunication();

  const [textTurn, setTextTurn] = useState('');
  const [serverStatus, setServerStatus] = useState<LiveStatusResponse | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Apps & MCP Connections state
  const [connectors, setConnectors] = useState<InstalledConnectorSummary[]>([]);
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('remote-mcp');
  const [connId, setConnId] = useState('');
  const [connName, setConnName] = useState('');
  const [connUrl, setConnUrl] = useState('https://mcp.example.com/mcp');
  const [connSecret, setConnSecret] = useState('');
  const [mcpDiscoveryMsg, setMcpDiscoveryMsg] = useState<string | null>(null);
  const [connBusy, setConnBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setDrawerOpen(!drawerOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, setDrawerOpen]);

  useEffect(() => {
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = videoStream;
    }
  }, [videoStream, drawerOpen, tab]);

  const loadDrawerData = async () => {
    try {
      const [statusRes, pluginsRes, templatesRes] = await Promise.all([
        api<LiveStatusResponse>('GET', '/realtime/live/status').catch(() => null),
        api<{ connectors: InstalledConnectorSummary[] }>('GET', '/plugins').catch(() => ({ connectors: [] })),
        api<{ templates: ConnectorTemplate[] }>('GET', '/plugins/templates').catch(() => ({ templates: [] })),
      ]);
      if (statusRes) setServerStatus(statusRes);
      setConnectors(pluginsRes.connectors ?? []);
      setTemplates(templatesRes.templates ?? []);
    } catch {
      // Unauthenticated or unreachable handled gracefully in UI
    }
  };

  useEffect(() => {
    if (drawerOpen) {
      void loadDrawerData();
    }
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  const selectedTemplate = templates.find((t) => t.templateId === selectedTemplateId);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t) => t.templateId === templateId);
    if (tpl) {
      setConnId(tpl.templateId);
      setConnName(tpl.name);
      setConnUrl(tpl.defaultBaseUrl);
      setMcpDiscoveryMsg(null);
    }
  };

  const handleDiscoverAndInstallMcp = async () => {
    if (!connUrl.trim()) return;
    setConnBusy(true);
    setMcpDiscoveryMsg(null);
    try {
      const res = await api<{ success: boolean; tools: Array<{ name: string }>; installed?: { id: string } }>(
        'POST',
        '/mcp/servers/discover',
        {
          baseUrl: connUrl.trim(),
          id: connId.trim() || undefined,
          name: connName.trim() || undefined,
          secret: connSecret.trim() || undefined,
          auth: connSecret.trim() ? { type: 'bearer' } : { type: 'none' },
          install: true,
          autoEnable: true,
        },
      );
      setMcpDiscoveryMsg(`Discovered and enabled ${res.tools.length} MCP tools.`);
      setConnSecret('');
      await loadDrawerData();
    } catch (err) {
      setMcpDiscoveryMsg(`Discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConnBusy(false);
    }
  };

  const handleInstallConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate && !connUrl.trim()) return;
    setConnBusy(true);
    setMcpDiscoveryMsg(null);
    try {
      const tpl = selectedTemplate;
      const id = (connId || tpl?.templateId || 'custom-app').toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
      await api('POST', '/plugins/install', {
        id,
        name: connName.trim() || tpl?.name || id,
        version: '1.0.0',
        transport: tpl?.transport || 'rest',
        category: tpl?.category || 'custom',
        baseUrl: connUrl.trim(),
        auth: connSecret.trim()
          ? { ...(tpl?.auth ?? { type: 'bearer' }), type: tpl?.auth.type === 'none' ? 'bearer' : (tpl?.auth.type ?? 'bearer') }
          : (tpl?.auth ?? { type: 'none' }),
        tools: tpl?.tools ?? [{ name: 'request', method: 'GET', path: '/', risk: 'read' }],
        secret: connSecret.trim() || undefined,
        autoEnable: true,
      });
      setMcpDiscoveryMsg(`Connected and enabled ${connName.trim() || id}.`);
      setConnSecret('');
      await loadDrawerData();
    } catch (err) {
      setMcpDiscoveryMsg(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConnBusy(false);
    }
  };

  const handleToggleConnector = async (id: string, enabled: boolean) => {
    try {
      await api('POST', `/plugins/${encodeURIComponent(id)}/enable`, { enabled });
      await loadDrawerData();
    } catch {
      // ignore
    }
  };

  const handleDeleteConnector = async (id: string) => {
    try {
      await api('DELETE', `/plugins/${encodeURIComponent(id)}`);
      await loadDrawerData();
    } catch {
      // ignore
    }
  };

  const isLive = connectionState === 'live';

  return (
    <div
      className="fixed inset-0 z-[85] flex justify-end bg-black/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Live Communication and Connections"
    >
      <div className="flex h-full w-full max-w-[460px] flex-col border-l border-cyan-500/25 bg-[#040d15] text-slate-100 shadow-2xl">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2 border-b border-cyan-500/20 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isLive ? 'bg-emerald-400' : connectionState === 'error' ? 'bg-rose-400' : 'bg-cyan-400/60'
              }`}
            />
            <h2 className="truncate text-sm font-semibold tracking-wide text-white">
              Live Comms &amp; App Bridge
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setTab('live')}
              className={`rounded border px-2.5 py-1 text-[11px] whitespace-nowrap ${
                tab === 'live'
                  ? 'border-cyan-400/50 bg-cyan-500/20 text-white'
                  : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              Voice &amp; Vision
            </button>
            <button
              type="button"
              onClick={() => setTab('connections')}
              className={`rounded border px-2.5 py-1 text-[11px] whitespace-nowrap ${
                tab === 'connections'
                  ? 'border-cyan-400/50 bg-cyan-500/20 text-white'
                  : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              Apps &amp; MCP ({connectors.length})
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close live communication drawer"
              className="rounded border border-white/15 p-1.5 text-slate-300 hover:bg-white/10"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        {tab === 'live' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Configuration & Stream Controls */}
            <div className="space-y-2.5 border-b border-white/10 px-4 py-3 text-xs">
              {serverStatus && !serverStatus.configured && (
                <div className="flex items-start gap-2 rounded border border-amber-400/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Server GEMINI_API_KEY is not configured. Live Gemini audio and vision require a server-side API key.
                  </span>
                </div>
              )}

              {lastError && (
                <div className="flex items-start gap-2 rounded border border-rose-400/40 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{lastError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Live Model</span>
                  <select
                    value={modelProfile}
                    disabled={isLive}
                    onChange={(e) => setModelProfile(e.target.value as 'fast' | 'extended')}
                    className="w-full rounded border border-white/15 bg-black/50 px-2 py-1.5 text-[11px] text-slate-100"
                  >
                    <option value="fast">Gemini 3.8 Live (Fast)</option>
                    <option value="extended">Gemini 3.8 Live Thinking</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Voice Preset</span>
                  <select
                    value={voicePreset}
                    disabled={isLive}
                    onChange={(e) => setVoicePreset(e.target.value)}
                    className="w-full rounded border border-white/15 bg-black/50 px-2 py-1.5 text-[11px] text-slate-100"
                  >
                    {(serverStatus?.voices ?? ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir']).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isLive ? (
                  <button
                    type="button"
                    onClick={() => void startLiveSession()}
                    className="inline-flex items-center gap-1.5 rounded border border-cyan-400/50 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500/30"
                  >
                    <Mic size={14} />
                    <span>Start Live Voice</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopLiveSession}
                    className="inline-flex items-center gap-1.5 rounded border border-rose-400/50 bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/30"
                  >
                    <Square size={12} />
                    <span>End Session</span>
                  </button>
                )}

                {isLive && (
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="inline-flex items-center gap-1 rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    {micMuted ? <MicOff size={13} /> : <Mic size={13} />}
                    <span>{micMuted ? 'Unmute' : 'Mute'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => (visionSource === 'camera' ? stopVision() : void startVision('camera'))}
                  className="inline-flex items-center gap-1 rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                >
                  {visionSource === 'camera' ? <CameraOff size={13} /> : <Camera size={13} />}
                  <span>{visionSource === 'camera' ? 'Stop Cam' : 'Camera'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => (visionSource === 'screen' ? stopVision() : void startVision('screen'))}
                  className="inline-flex items-center gap-1 rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                >
                  {visionSource === 'screen' ? <MonitorOff size={13} /> : <Monitor size={13} />}
                  <span>{visionSource === 'screen' ? 'Stop Screen' : 'Screen'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-slate-400">
                <span>16kHz IN · 24kHz OUT · {fps} FPS</span>
                <span className="text-cyan-300 uppercase">{turnState}</span>
              </div>
            </div>

            {/* Live Vision Preview */}
            <div className="border-b border-white/10 px-4 py-2.5">
              {videoStream ? (
                <div className="relative overflow-hidden rounded border border-emerald-400/40 bg-black">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-36 w-full object-cover"
                  />
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-emerald-300">
                    LIVE {visionSource.toUpperCase()} · {fps} FPS
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-slate-400">
                  <span>Vision stream standby (camera or screen).</span>
                  <button
                    type="button"
                    onClick={() => void startVision('camera')}
                    className="text-cyan-300 hover:underline whitespace-nowrap"
                  >
                    Enable Camera
                  </button>
                </div>
              )}
            </div>

            {/* Tool activity strip */}
            {toolActivities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-4 py-2">
                {toolActivities.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded border border-cyan-400/25 bg-cyan-950/40 px-2 py-0.5 font-mono text-[10px] text-cyan-200"
                  >
                    <Cpu size={10} />
                    <span>{t.name}</span>
                    <span className="text-slate-400">· {t.status}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Transcript & Adaptive Briefings Feed */}
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3 text-xs">
              {transcripts.length === 0 ? (
                <div className="rounded border border-white/10 bg-black/30 p-3 text-slate-400 leading-relaxed">
                  Start Live Voice to speak naturally with Microfyxd, share your camera or screen for visual diagnostics, or run commands to hear concise adaptive briefings with expandable details.
                </div>
              ) : (
                transcripts.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded border p-2.5 leading-relaxed ${
                      entry.role === 'user'
                        ? 'border-white/15 bg-white/5 text-slate-100'
                        : entry.role === 'alert'
                          ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                          : 'border-cyan-500/25 bg-cyan-950/25 text-cyan-50'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                      <span className="uppercase">{entry.role}</span>
                      <span>{entry.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-wrap select-text">{entry.text}</p>
                    {entry.expandableDetail && entry.expandableDetail !== entry.text && (
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => toggleTranscriptExpand(entry.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:underline"
                        >
                          {entry.expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          <span>{entry.expanded ? 'Hide full details' : 'Show full details'}</span>
                        </button>
                        {entry.expanded && (
                          <div className="mt-1.5 rounded border border-white/10 bg-black/45 p-2 text-[11px] text-slate-300 whitespace-pre-wrap select-text">
                            {entry.expandableDetail}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Bottom Text Turn Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!textTurn.trim()) return;
                sendTextTurn(textTurn);
                setTextTurn('');
              }}
              className="flex items-center gap-2 border-t border-white/10 px-4 py-3"
            >
              <input
                type="text"
                value={textTurn}
                onChange={(e) => setTextTurn(e.target.value)}
                disabled={!isLive}
                placeholder={isLive ? 'Type or say "expand" in live chat...' : 'Start Live Voice to send live turns'}
                className="flex-1 rounded border border-white/15 bg-black/50 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none disabled:opacity-50"
              />
              {turnState === 'speaking' && (
                <button
                  type="button"
                  onClick={interrupt}
                  className="rounded border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-200"
                >
                  Stop
                </button>
              )}
              <button
                type="submit"
                disabled={!isLive || !textTurn.trim()}
                className="rounded border border-cyan-400/40 bg-cyan-500/20 p-2 text-cyan-100 disabled:opacity-40"
                aria-label="Send live text turn"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        ) : (
          /* Apps & MCP Connections Tab */
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Universal App &amp; MCP Connections</h3>
                <p className="text-[11px] text-slate-400">
                  Connect REST APIs, GraphQL, Webhooks, or auto-discover remote HTTPS MCP servers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadDrawerData()}
                className="rounded border border-white/15 p-1.5 text-slate-300 hover:bg-white/10"
                aria-label="Refresh connectors"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {mcpDiscoveryMsg && (
              <div className="rounded border border-cyan-400/35 bg-cyan-500/10 p-2 text-[11px] text-cyan-100">
                {mcpDiscoveryMsg}
              </div>
            )}

            <form onSubmit={handleInstallConnector} className="space-y-2.5 rounded border border-white/15 bg-black/35 p-3">
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Connection Type / App Preset</span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white"
                >
                  {templates.map((t) => (
                    <option key={t.templateId} value={t.templateId}>
                      {t.name} ({t.transport})
                    </option>
                  ))}
                </select>
              </label>

              {selectedTemplate && (
                <p className="text-[11px] text-slate-400">{selectedTemplate.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={connId}
                  onChange={(e) => setConnId(e.target.value)}
                  placeholder="ID (e.g. my-crm)"
                  className="rounded border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
                />
                <input
                  type="text"
                  value={connName}
                  onChange={(e) => setConnName(e.target.value)}
                  placeholder="Display Name"
                  className="rounded border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
                />
              </div>

              <input
                type="url"
                required
                value={connUrl}
                onChange={(e) => setConnUrl(e.target.value)}
                placeholder="https://api.service.com"
                className="w-full rounded border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
              />

              <input
                type="password"
                value={connSecret}
                onChange={(e) => setConnSecret(e.target.value)}
                placeholder="Bearer token / API key (stored server-side only, optional if env var set)"
                className="w-full rounded border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={connBusy}
                  className="inline-flex items-center gap-1.5 rounded border border-cyan-400/50 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500/30 disabled:opacity-50"
                >
                  <Plus size={13} />
                  <span>Install &amp; Enable</span>
                </button>

                {selectedTemplate?.transport === 'mcp-http' && (
                  <button
                    type="button"
                    disabled={connBusy}
                    onClick={() => void handleDiscoverAndInstallMcp()}
                    className="inline-flex items-center gap-1.5 rounded border border-emerald-400/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <Globe size={13} />
                    <span>Auto-Discover MCP</span>
                  </button>
                )}
              </div>
            </form>

            {/* Installed Connectors List */}
            <div className="space-y-2">
              <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Active Connectors ({connectors.length})
              </h4>
              {connectors.length === 0 ? (
                <div className="rounded border border-white/10 bg-black/25 p-3 text-slate-400">
                  No external connectors installed yet. Choose a preset above or enter any HTTPS MCP/API URL.
                </div>
              ) : (
                connectors.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-2 rounded border border-white/15 bg-black/35 p-2.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Plug size={12} className="text-cyan-300 shrink-0" />
                        <span className="truncate font-semibold text-white">{c.name}</span>
                        <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                          {c.transport}
                        </span>
                      </div>
                      <div className="truncate font-mono text-[10px] text-slate-400">{c.baseUrl}</div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className={c.credentialConfigured ? 'text-emerald-300' : 'text-amber-300'}>
                          {c.credentialConfigured ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 size={10} /> Credentials ready
                            </span>
                          ) : (
                            'Needs server credential'
                          )}
                        </span>
                        <span className="text-slate-500">· {c.tools.length} tools</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleConnector(c.id, !c.enabled)}
                        className={`rounded border px-2 py-1 text-[10px] ${
                          c.enabled
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                            : 'border-white/15 bg-black/40 text-slate-400'
                        }`}
                      >
                        {c.enabled ? 'On' : 'Off'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteConnector(c.id)}
                        aria-label={`Remove ${c.name}`}
                        className="rounded border border-rose-400/30 p-1 text-rose-300 hover:bg-rose-500/20"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
