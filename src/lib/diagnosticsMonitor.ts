export type ApiHealthOverall = 'checking' | 'healthy' | 'degraded' | 'unreachable';

export type WsConnectionState =
  | 'auth_required'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface EndpointCheckResult<T = Record<string, unknown>> {
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  checkedAt: number | null;
  error: string | null;
  data: T | null;
}

export interface LivenessPayload {
  status?: string;
  version?: string;
  phase?: string;
  commit?: string;
  services?: string[];
  ts?: string;
}

export interface ReadinessPayload {
  status?: string;
  systemHealth?: string;
  storage?: { durable?: boolean; engine?: string };
  configured?: { admin?: boolean; supabase?: boolean; llm?: boolean };
  ts?: string;
}

export interface DeepHealthPayload {
  status?: string;
  ready?: boolean;
  runtime?: {
    organsInitialized?: boolean;
    registeredOrgans?: number;
    failedOrgans?: string[];
    pendingHumanApprovals?: number;
  };
  configured?: { admin?: boolean; supabase?: boolean; llm?: boolean };
  memory?: { durable?: boolean; status?: string };
  ts?: string;
}

export interface ApiHealthSnapshot {
  overall: ApiHealthOverall;
  checking: boolean;
  lastCheckedAt: number | null;
  liveness: EndpointCheckResult<LivenessPayload>;
  readiness: EndpointCheckResult<ReadinessPayload>;
  deep: EndpointCheckResult<DeepHealthPayload>;
}

export interface WsDiagnosticSnapshot {
  state: WsConnectionState;
  url: string;
  readyState: number | null;
  authenticated: boolean;
  latencyMs: number | null;
  reconnectAttempts: number;
  lastEventType: string | null;
  lastEventAt: number | null;
  lastError: string | null;
  closeCode: number | null;
  closeReason: string | null;
}

export const WS_MAX_RETRIES = 5;

const EMPTY_CHECK = <T,>(): EndpointCheckResult<T> => ({
  ok: false,
  httpStatus: null,
  latencyMs: null,
  checkedAt: null,
  error: null,
  data: null,
});

export function createInitialApiHealthSnapshot(): ApiHealthSnapshot {
  return {
    overall: 'checking',
    checking: false,
    lastCheckedAt: null,
    liveness: EMPTY_CHECK<LivenessPayload>(),
    readiness: EMPTY_CHECK<ReadinessPayload>(),
    deep: EMPTY_CHECK<DeepHealthPayload>(),
  };
}

export function createInitialWsSnapshot(url = ''): WsDiagnosticSnapshot {
  return {
    state: 'disconnected',
    url,
    readyState: null,
    authenticated: false,
    latencyMs: null,
    reconnectAttempts: 0,
    lastEventType: null,
    lastEventAt: null,
    lastError: null,
    closeCode: null,
    closeReason: null,
  };
}

export function buildWsUrl(locationLike: { protocol: string; host: string }): string {
  const wsProto = locationLike.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${locationLike.host}/ws`;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.sessionStorage.getItem('microfixd_operator_token') ||
    window.sessionStorage.getItem('microfixd_supabase_access_token')
  );
}

export function computeOverallApiHealth(
  liveness: EndpointCheckResult<LivenessPayload>,
  readiness: EndpointCheckResult<ReadinessPayload>,
  deep: EndpointCheckResult<DeepHealthPayload>,
): ApiHealthOverall {
  if (!liveness.ok || liveness.data?.status !== 'ok') {
    return liveness.httpStatus === null || liveness.httpStatus >= 500
      ? 'unreachable'
      : 'degraded';
  }
  const readinessDegraded =
    !readiness.ok ||
    readiness.data?.status === 'degraded' ||
    readiness.data?.systemHealth === 'critical' ||
    readiness.data?.storage?.durable === false;
  const deepDegraded =
    !deep.ok ||
    deep.data?.ready === false ||
    deep.data?.status === 'degraded' ||
    (Array.isArray(deep.data?.runtime?.failedOrgans) && deep.data.runtime.failedOrgans.length > 0);

  if (readinessDegraded || deepDegraded) {
    return 'degraded';
  }
  return 'healthy';
}

export async function probeJsonEndpoint<T>(
  path: string,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<EndpointCheckResult<T>> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const response = await fetcher(path, { cache: 'no-store', signal });
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const latencyMs = Math.max(0, Math.round(end - start));
    const data = (await response.json().catch(() => null)) as T | null;
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        httpStatus: response.status,
        latencyMs,
        checkedAt: Date.now(),
        error: `Non-JSON response (HTTP ${response.status})`,
        data: null,
      };
    }
    return {
      ok: response.ok,
      httpStatus: response.status,
      latencyMs,
      checkedAt: Date.now(),
      error: response.ok ? null : String((data as Record<string, unknown>).error ?? `HTTP ${response.status}`),
      data,
    };
  } catch (error) {
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      ok: false,
      httpStatus: null,
      latencyMs: Math.max(0, Math.round(end - start)),
      checkedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error),
      data: null,
    };
  }
}

export async function probeAllApiHealth(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ApiHealthSnapshot> {
  const [liveness, readiness, deep] = await Promise.all([
    probeJsonEndpoint<LivenessPayload>('/api/health', fetcher, signal),
    probeJsonEndpoint<ReadinessPayload>('/readyz', fetcher, signal),
    probeJsonEndpoint<DeepHealthPayload>('/api/health/deep', fetcher, signal),
  ]);
  return {
    overall: computeOverallApiHealth(liveness, readiness, deep),
    checking: false,
    lastCheckedAt: Date.now(),
    liveness,
    readiness,
    deep,
  };
}

export function computeReconnectDelayMs(attempt: number): number {
  return Math.min(30000, 2000 * Math.pow(2, Math.max(0, attempt)));
}

export function describeWsReadyState(readyState: number | null): string {
  switch (readyState) {
    case 0:
      return 'CONNECTING (0)';
    case 1:
      return 'OPEN (1)';
    case 2:
      return 'CLOSING (2)';
    case 3:
      return 'CLOSED (3)';
    default:
      return 'IDLE';
  }
}
