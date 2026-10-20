import {createHash, timingSafeEqual} from 'node:crypto';

export type ToolEnvelope = Readonly<{
  missionId: string;
  subtaskId: string;
  tool: string;
  arguments: Record<string, unknown>;
  idempotencyKey: string;
}>;

export type ToolOutcome = Readonly<{
  status: 'succeeded' | 'failed';
  result?: unknown;
  error?: string;
  evidenceHash: string;
}>;

export interface ToolAdapter {
  readonly name: string;
  execute(arguments_: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
}

export class ToolExecutionError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ToolExecutionError('INVALID_ARGUMENT', field + ' must be a nonempty string');
  }
  return value;
}

export function webhookSignatureValid(payload: Buffer, suppliedHex: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex) || !secret) return false;
  const expected = createHash('sha256').update(secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(suppliedHex, 'hex'));
}

export function createHttpJsonAdapter(config: {
  name: string;
  baseUrl: string;
  token: () => string | undefined;
  allowedPaths: readonly string[];
  timeoutMs?: number;
}): ToolAdapter {
  const base = new URL(config.baseUrl);
  if (base.pathname !== '/' || base.port) throw new ToolExecutionError('INVALID_CONFIGURATION', 'Root HTTPS origin without custom port required');
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new ToolExecutionError('INVALID_CONFIGURATION', 'HTTPS base URL required');
  }
  const allowed = new Set(config.allowedPaths);
  if (!allowed.size || [...allowed].some(p => !/^\/[a-zA-Z0-9/_-]+$/.test(p))) {
    throw new ToolExecutionError('INVALID_CONFIGURATION', 'Explicit endpoint allowlist required');
  }
  return {
    name: config.name,
    async execute(args, parentSignal) {
      if (parentSignal.aborted) throw new ToolExecutionError('ABORTED', 'Execution aborted');
      const path = requiredString(args.path, 'path');
      if (!allowed.has(path)) throw new ToolExecutionError('PATH_DENIED', 'Endpoint not allowlisted');
      const method = args.method === 'GET' ? 'GET' : args.method === 'POST' ? 'POST' : null;
      if (!method) throw new ToolExecutionError('INVALID_ARGUMENT', 'method must be GET or POST');
      if (method === 'GET' && args.body !== undefined) throw new ToolExecutionError('INVALID_ARGUMENT', 'GET body forbidden');
      const token = config.token();
      if (!token) throw new ToolExecutionError('CREDENTIALS_MISSING', config.name + ' token unavailable');
      const url = new URL(path, base);
      if (url.origin !== base.origin) throw new ToolExecutionError('PATH_DENIED', 'Origin mismatch');
      const timeout = AbortSignal.timeout(config.timeoutMs ?? 15000);
      const signal = AbortSignal.any([parentSignal, timeout]);
      let response: Response;
      try {
        response = await fetch(url, {
          method, signal, redirect: 'error',
          headers: {Authorization: 'Bearer ' + token, Accept: 'application/json', ...(method === 'POST' ? {'Content-Type': 'application/json'} : {})},
          ...(method === 'POST' ? {body: JSON.stringify(args.body ?? {})} : {})
        });
      } catch (error) {
        throw new ToolExecutionError('NETWORK_FAILURE', error instanceof Error ? error.message : 'Request failed');
      }
      const text = await response.text();
      if (!response.ok) throw new ToolExecutionError('REMOTE_ERROR', 'HTTP ' + response.status + ': ' + text.slice(0, 300));
      try { return text ? JSON.parse(text) : {}; }
      catch { throw new ToolExecutionError('INVALID_RESPONSE', 'Expected JSON response'); }
    }
  };
}

export class GovernedAdapterRuntime {
  private readonly adapters = new Map<string, ToolAdapter>();
  constructor(private readonly authorized: (envelope: ToolEnvelope) => Promise<boolean>,
              private readonly persist: (envelope: ToolEnvelope, outcome: ToolOutcome) => Promise<void>) {}
  register(adapter: ToolAdapter): void {
    if (this.adapters.has(adapter.name)) throw new ToolExecutionError('DUPLICATE_TOOL', adapter.name);
    this.adapters.set(adapter.name, adapter);
  }
  async execute(envelope: ToolEnvelope, signal: AbortSignal = AbortSignal.timeout(30000)): Promise<ToolOutcome> {
    requiredString(envelope.missionId, 'missionId');
    requiredString(envelope.subtaskId, 'subtaskId');
    requiredString(envelope.idempotencyKey, 'idempotencyKey');
    const adapter = this.adapters.get(envelope.tool);
    if (!adapter) throw new ToolExecutionError('UNKNOWN_TOOL', envelope.tool);
    if (!(await this.authorized(envelope))) throw new ToolExecutionError('NOT_AUTHORIZED', envelope.tool);
    let outcome: ToolOutcome;
    try {
      const result = await adapter.execute(envelope.arguments, signal);
      outcome = {status: 'succeeded', result, evidenceHash: createHash('sha256').update(JSON.stringify(result)).digest('hex')};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcome = {status: 'failed', error: message, evidenceHash: createHash('sha256').update(message).digest('hex')};
    }
    await this.persist(envelope, outcome);
    return outcome;
  }
}
