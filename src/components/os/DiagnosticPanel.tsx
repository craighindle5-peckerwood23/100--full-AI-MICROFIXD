import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { api } from '../../lib/serverApi';
import type { LiveCapabilitySnapshot } from '../../types';
import {
  type ApiHealthOverall,
  type ApiHealthSnapshot,
  buildWsUrl,
  computeReconnectDelayMs,
  createInitialApiHealthSnapshot,
  createInitialWsSnapshot,
  describeWsReadyState,
  getAuthToken,
  probeAllApiHealth,
  WS_MAX_RETRIES,
  type WsConnectionState,
  type WsDiagnosticSnapshot,
} from '../../lib/diagnosticsMonitor';

const POLL_INTERVAL_MS = 15000;

function formatClock(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function apiTone(overall: ApiHealthOverall): string {
  switch (overall) {
    case 'healthy':
      return 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10';
    case 'degraded':
      return 'text-amber-300 border-amber-400/40 bg-amber-500/10';
    case 'unreachable':
      return 'text-rose-300 border-rose-400/40 bg-rose-500/10';
    default:
      return 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10';
  }
}

function wsTone(state: WsConnectionState): string {
  switch (state) {
    case 'connected':
      return 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10';
    case 'connecting':
    case 'authenticating':
      return 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10';
    case 'auth_required':
    case 'reconnecting':
      return 'text-amber-300 border-amber-400/40 bg-amber-500/10';
    default:
      return 'text-rose-300 border-rose-400/40 bg-rose-500/10';
  }
}

function wsLabel(state: WsConnectionState): string {
  switch (state) {
    case 'auth_required':
      return 'AUTH REQ';
    case 'connecting':
      return 'CONNECTING';
    case 'authenticating':
      return 'AUTH';
    case 'connected':
      return 'CONNECTED';
    case 'reconnecting':
      return 'RETRYING';
    case 'error':
      return 'ERROR';
    default:
      return 'OFFLINE';
  }
}

export default function DiagnosticPanel() {
  const [expanded, setExpanded] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true,
  );
  const [apiHealth, setApiHealth] = useState<ApiHealthSnapshot>(createInitialApiHealthSnapshot);
  const [wsState, setWsState] = useState<WsDiagnosticSnapshot>(() =>
    createInitialWsSnapshot(
      typeof window !== 'undefined' ? buildWsUrl(window.location) : '',
    ),
  );

  const [capSnapshot, setCapSnapshot] = useState<LiveCapabilitySnapshot | null>(null);
  const [probingCaps, setProbingCaps] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingSentAtRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const unmountedRef = useRef(false);
  const healthAbortRef = useRef<AbortController | null>(null);

  const fetchLiveCapabilities = useCallback(async () => {
    try {
      const snap = await api<LiveCapabilitySnapshot>('GET', '/organs/capabilities/live?run_if_empty=1');
      if (!unmountedRef.current && snap && Array.isArray(snap.records)) {
        setCapSnapshot(snap);
      }
    } catch {
      // Leave null when unauthenticated or unreachable
    }
  }, []);

  const triggerQuickCapabilityProbe = useCallback(async () => {
    setProbingCaps(true);
    try {
      const res = await api<{ success: boolean; snapshot: LiveCapabilitySnapshot }>(
        'POST',
        '/organs/capabilities/probe',
        { mode: 'quick' },
      );
      if (!unmountedRef.current && res.snapshot) {
        setCapSnapshot(res.snapshot);
        window.dispatchEvent(new CustomEvent('microfixd:capabilities-updated', { detail: res.snapshot }));
      }
    } catch {
      // Ignored cleanly
    } finally {
      if (!unmountedRef.current) setProbingCaps(false);
    }
  }, []);

  const runHealthCheck = useCallback(async () => {
    healthAbortRef.current?.abort();
    const controller = new AbortController();
    healthAbortRef.current = controller;
    setApiHealth((prev) => ({ ...prev, checking: true }));
    const snapshot = await probeAllApiHealth(window.fetch.bind(window), controller.signal);
    if (!unmountedRef.current && !controller.signal.aborted) {
      setApiHealth(snapshot);
    }
    void fetchLiveCapabilities();
  }, [fetchLiveCapabilities]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeCurrentSocket = useCallback(() => {
    clearReconnectTimer();
    const socket = wsRef.current;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {}
      wsRef.current = null;
    }
  }, [clearReconnectTimer]);

  const sendPing = useCallback(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    pingSentAtRef.current = performance.now();
    try {
      socket.send(JSON.stringify({ type: 'ping' }));
    } catch {}
  }, []);

  const connectWs = useCallback(
    (forceAttempt = false) => {
      if (unmountedRef.current || typeof window === 'undefined') return;
      closeCurrentSocket();

      const wsUrl = buildWsUrl(window.location);
      const token = getAuthToken();
      if (!token && !forceAttempt) {
        retryCountRef.current = 0;
        setWsState((prev) => ({
          ...prev,
          state: 'auth_required',
          url: wsUrl,
          readyState: null,
          authenticated: false,
          reconnectAttempts: 0,
          lastError: 'Operator or session token required',
        }));
        return;
      }

      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (error) {
        setWsState((prev) => ({
          ...prev,
          state: 'error',
          url: wsUrl,
          readyState: null,
          authenticated: false,
          lastError: error instanceof Error ? error.message : String(error),
        }));
        return;
      }

      wsRef.current = socket;
      setWsState((prev) => ({
        ...prev,
        state: 'connecting',
        url: wsUrl,
        readyState: socket.readyState,
        authenticated: false,
        lastError: null,
        closeCode: null,
        closeReason: null,
      }));

      socket.onopen = () => {
        if (unmountedRef.current || wsRef.current !== socket) return;
        setWsState((prev) => ({
          ...prev,
          state: 'authenticating',
          readyState: socket.readyState,
          lastEventType: 'socket.open',
          lastEventAt: Date.now(),
        }));
        try {
          socket.send(
            JSON.stringify({
              type: 'authenticate',
              payload: { token: token ?? '' },
            }),
          );
        } catch {}
      };

      socket.onmessage = (event) => {
        if (unmountedRef.current || wsRef.current !== socket) return;
        let parsed: { type?: string } | null = null;
        try {
          parsed = JSON.parse(String(event.data)) as { type?: string };
        } catch {
          return;
        }
        const eventType = String(parsed?.type || 'message');
        const now = Date.now();

        if (eventType === 'authenticated') {
          retryCountRef.current = 0;
          setWsState((prev) => ({
            ...prev,
            state: 'connected',
            readyState: socket.readyState,
            authenticated: true,
            reconnectAttempts: 0,
            lastEventType: eventType,
            lastEventAt: now,
            lastError: null,
          }));
          pingSentAtRef.current = performance.now();
          try {
            socket.send(JSON.stringify({ type: 'ping' }));
          } catch {}
          return;
        }

        if (eventType === 'pong' && pingSentAtRef.current !== null) {
          const rtt = Math.max(0, Math.round(performance.now() - pingSentAtRef.current));
          pingSentAtRef.current = null;
          setWsState((prev) => ({
            ...prev,
            readyState: socket.readyState,
            latencyMs: rtt,
            lastEventType: eventType,
            lastEventAt: now,
          }));
          return;
        }

        if (eventType === 'capabilities:updated') {
          const payload = (parsed as { payload?: LiveCapabilitySnapshot })?.payload;
          if (payload && Array.isArray(payload.records)) {
            setCapSnapshot(payload);
            window.dispatchEvent(new CustomEvent('microfixd:capabilities-updated', { detail: payload }));
          }
        }

        setWsState((prev) => ({
          ...prev,
          readyState: socket.readyState,
          lastEventType: eventType,
          lastEventAt: now,
        }));
      };

      socket.onerror = () => {
        if (unmountedRef.current || wsRef.current !== socket) return;
        setWsState((prev) => ({
          ...prev,
          state: 'error',
          readyState: socket.readyState,
          lastError: 'WebSocket transport error',
        }));
      };

      socket.onclose = (closeEvent) => {
        if (unmountedRef.current || wsRef.current !== socket) return;
        wsRef.current = null;
        const authRejected = closeEvent.code === 1008;
        const currentToken = getAuthToken();

        if (authRejected || !currentToken) {
          retryCountRef.current = 0;
          setWsState((prev) => ({
            ...prev,
            state: authRejected && currentToken ? 'disconnected' : 'auth_required',
            readyState: WebSocket.CLOSED,
            authenticated: false,
            closeCode: closeEvent.code,
            closeReason: closeEvent.reason || null,
            lastError: closeEvent.reason || (authRejected ? 'Authentication rejected (1008)' : 'Operator token required'),
          }));
          return;
        }

        if (retryCountRef.current >= WS_MAX_RETRIES) {
          setWsState((prev) => ({
            ...prev,
            state: 'disconnected',
            readyState: WebSocket.CLOSED,
            authenticated: false,
            closeCode: closeEvent.code,
            closeReason: closeEvent.reason || null,
            lastError: `Disconnected after ${WS_MAX_RETRIES} reconnect attempts`,
          }));
          return;
        }

        const attempt = retryCountRef.current;
        retryCountRef.current += 1;
        const delayMs = computeReconnectDelayMs(attempt);

        setWsState((prev) => ({
          ...prev,
          state: 'reconnecting',
          readyState: WebSocket.CLOSED,
          authenticated: false,
          reconnectAttempts: retryCountRef.current,
          closeCode: closeEvent.code,
          closeReason: closeEvent.reason || null,
          lastError: `Closed (${closeEvent.code}); retrying in ${Math.round(delayMs / 1000)}s`,
        }));

        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          connectWs(false);
        }, delayMs);
      };
    },
    [clearReconnectTimer, closeCurrentSocket],
  );

  useEffect(() => {
    unmountedRef.current = false;
    void runHealthCheck();
    const healthTimer = window.setInterval(() => void runHealthCheck(), POLL_INTERVAL_MS);

    connectWs(false);

    const onAuthChanged = () => {
      retryCountRef.current = 0;
      connectWs(false);
      void runHealthCheck();
    };

    const onShellTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; message?: string; timestamp?: number }>).detail;
      if (!detail?.type) return;
      if (detail.type === 'system.readiness' || detail.type === 'system.deep-health') {
        setWsState((prev) => ({
          ...prev,
          lastEventType: prev.lastEventType ?? detail.type ?? null,
          lastEventAt: prev.lastEventAt ?? detail.timestamp ?? Date.now(),
        }));
      }
    };

    window.addEventListener('microfixd:auth-changed', onAuthChanged);
    window.addEventListener('microfixd:telemetry', onShellTelemetry);

    return () => {
      unmountedRef.current = true;
      window.clearInterval(healthTimer);
      healthAbortRef.current?.abort();
      window.removeEventListener('microfixd:auth-changed', onAuthChanged);
      window.removeEventListener('microfixd:telemetry', onShellTelemetry);
      closeCurrentSocket();
    };
  }, [closeCurrentSocket, connectWs, runHealthCheck]);

  const handleManualReconnect = () => {
    retryCountRef.current = 0;
    connectWs(true);
  };

  return (
    <aside
      role="region"
      aria-label="System Diagnostics"
      className="fixed bottom-3 right-3 z-40 w-[316px] max-w-[calc(100vw-1.5rem)] rounded-lg border border-cyan-400/25 bg-[#020a12]/92 text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.65)] backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-cyan-400/15">
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={13} className="text-cyan-300 shrink-0" />
          <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-cyan-200 truncate">
            DIAGNOSTICS
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            data-testid="diag-ws-badge"
            className={`px-1.5 py-0.5 rounded border font-mono text-[9px] tracking-wider ${wsTone(wsState.state)}`}
          >
            WS:{wsLabel(wsState.state)}
          </span>
          <span
            data-testid="diag-api-badge"
            className={`px-1.5 py-0.5 rounded border font-mono text-[9px] tracking-wider ${apiTone(apiHealth.overall)}`}
          >
            API:{apiHealth.overall.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={() => void runHealthCheck()}
            aria-label="Refresh diagnostics"
            title="Refresh diagnostics"
            className="p-1 rounded border border-cyan-400/20 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-500/20 transition-colors"
          >
            <RefreshCw size={11} className={apiHealth.checking ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse diagnostics' : 'Expand diagnostics'}
            title={expanded ? 'Collapse diagnostics' : 'Expand diagnostics'}
            className="p-1 rounded border border-cyan-400/20 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-500/20 transition-colors"
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-3 text-[11px] font-mono">
          {/* WebSocket section */}
          <section aria-label="WebSocket connection monitor" className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-cyan-200 font-semibold text-[10px] tracking-wider">
                {wsState.state === 'connected' ? (
                  <Wifi size={12} className="text-emerald-300" />
                ) : (
                  <WifiOff size={12} className="text-amber-300" />
                )}
                <span>WEBSOCKET (/ws)</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={sendPing}
                  disabled={wsState.state !== 'connected'}
                  className="px-1.5 py-0.5 rounded border border-cyan-400/25 bg-cyan-950/40 text-[9px] text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ping
                </button>
                <button
                  type="button"
                  onClick={handleManualReconnect}
                  className="px-1.5 py-0.5 rounded border border-cyan-400/25 bg-cyan-950/40 text-[9px] text-cyan-200 hover:bg-cyan-500/20"
                >
                  Reconnect
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 rounded border border-white/10 bg-black/35 p-2 text-[10px]">
              <span className="text-slate-400">ReadyState</span>
              <span className="text-right text-slate-200">{describeWsReadyState(wsState.readyState)}</span>
              <span className="text-slate-400">Ping RTT</span>
              <span className="text-right text-slate-200">
                {wsState.latencyMs !== null ? `${wsState.latencyMs} ms` : '—'}
              </span>
              <span className="text-slate-400">Last Frame</span>
              <span className="text-right text-slate-200 truncate" title={wsState.lastEventType ?? undefined}>
                {wsState.lastEventType ? `${wsState.lastEventType} (${formatClock(wsState.lastEventAt)})` : 'None'}
              </span>
              {wsState.reconnectAttempts > 0 && (
                <>
                  <span className="text-slate-400">Retries</span>
                  <span className="text-right text-amber-300">
                    {wsState.reconnectAttempts}/{WS_MAX_RETRIES}
                  </span>
                </>
              )}
            </div>
            {wsState.lastError && (
              <div className="flex items-start gap-1.5 text-[10px] text-amber-300/90">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                <span className="break-words">{wsState.lastError}</span>
              </div>
            )}
          </section>

          {/* API Health section */}
          <section aria-label="API health monitor" className="space-y-1.5 pt-2 border-t border-cyan-400/15">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-cyan-200 font-semibold text-[10px] tracking-wider">
                <Server size={12} className="text-cyan-300" />
                <span>API HEALTH</span>
              </div>
              <span className="text-[9px] text-slate-400">
                Checked {formatClock(apiHealth.lastCheckedAt)}
              </span>
            </div>

            <div className="space-y-1 rounded border border-white/10 bg-black/35 p-2 text-[10px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 flex items-center gap-1">
                  {apiHealth.liveness.ok ? (
                    <CheckCircle2 size={10} className="text-emerald-300" />
                  ) : (
                    <AlertTriangle size={10} className="text-rose-300" />
                  )}
                  /api/health
                </span>
                <span className={apiHealth.liveness.ok ? 'text-emerald-300' : 'text-rose-300'}>
                  {apiHealth.liveness.httpStatus ?? 'ERR'}{' '}
                  {apiHealth.liveness.latencyMs !== null ? `· ${apiHealth.liveness.latencyMs}ms` : ''}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 flex items-center gap-1">
                  {apiHealth.readiness.ok && apiHealth.readiness.data?.storage?.durable !== false ? (
                    <CheckCircle2 size={10} className="text-emerald-300" />
                  ) : (
                    <AlertTriangle size={10} className="text-amber-300" />
                  )}
                  /readyz
                </span>
                <span className={apiHealth.readiness.ok ? 'text-slate-200' : 'text-amber-300'}>
                  {apiHealth.readiness.data?.status ?? apiHealth.readiness.httpStatus ?? 'ERR'}
                  {apiHealth.readiness.data?.storage?.durable !== undefined
                    ? ` · DB:${apiHealth.readiness.data.storage.durable ? 'durable' : 'off'}`
                    : ''}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 flex items-center gap-1">
                  {apiHealth.deep.ok && apiHealth.deep.data?.ready !== false ? (
                    <CheckCircle2 size={10} className="text-emerald-300" />
                  ) : (
                    <AlertTriangle size={10} className="text-amber-300" />
                  )}
                  /api/health/deep
                </span>
                <span className={apiHealth.deep.ok ? 'text-slate-200' : 'text-amber-300'}>
                  {apiHealth.deep.ok
                    ? `${apiHealth.deep.data?.runtime?.registeredOrgans ?? '—'} organs`
                    : apiHealth.deep.httpStatus ?? 'UNAVAIL'}
                </span>
              </div>
            </div>
          </section>

          {/* Compact Live Capabilities section */}
          <section aria-label="Live capabilities summary" className="space-y-1.5 pt-2 border-t border-cyan-400/15">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-cyan-200 font-semibold text-[10px] tracking-wider">
                <Cpu size={12} className="text-cyan-300" />
                <span>LIVE CAPABILITIES</span>
              </div>
              <button
                type="button"
                onClick={() => void triggerQuickCapabilityProbe()}
                disabled={probingCaps}
                className="px-1.5 py-0.5 rounded border border-cyan-400/25 bg-cyan-950/40 text-[9px] text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
              >
                {probingCaps ? 'Probing...' : 'Probe'}
              </button>
            </div>

            <div className="rounded border border-white/10 bg-black/35 p-2 text-[10px] tabular-nums">
              {capSnapshot ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-300">
                    {capSnapshot.counts.verified}/{capSnapshot.counts.total} verified
                  </span>
                  <span className={capSnapshot.counts.degraded > 0 || capSnapshot.counts.unavailable > 0 ? 'text-amber-300' : 'text-slate-400'}>
                    {capSnapshot.counts.degraded}deg · {capSnapshot.counts.unavailable}down · {capSnapshot.stale ? 'STALE' : 'FRESH'}
                  </span>
                </div>
              ) : (
                <div className="text-slate-400">Sign in / supply token for live posture</div>
              )}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
