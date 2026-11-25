import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWsUrl,
  computeOverallApiHealth,
  computeReconnectDelayMs,
  describeWsReadyState,
  probeAllApiHealth,
  probeJsonEndpoint,
  WS_MAX_RETRIES,
} from '../src/lib/diagnosticsMonitor';

test('buildWsUrl maps http/https cleanly to ws/wss', () => {
  assert.equal(buildWsUrl({ protocol: 'https:', host: 'microfixd.example.com' }), 'wss://microfixd.example.com/ws');
  assert.equal(buildWsUrl({ protocol: 'http:', host: '127.0.0.1:3000' }), 'ws://127.0.0.1:3000/ws');
});

test('computeOverallApiHealth reports healthy, degraded, and unreachable states accurately', () => {
  const okLive = { ok: true, httpStatus: 200, latencyMs: 5, checkedAt: 1, error: null, data: { status: 'ok' } };
  const okReady = { ok: true, httpStatus: 200, latencyMs: 6, checkedAt: 1, error: null, data: { status: 'ok', systemHealth: 'nominal', storage: { durable: true } } };
  const okDeep = { ok: true, httpStatus: 200, latencyMs: 8, checkedAt: 1, error: null, data: { status: 'nominal', ready: true, runtime: { failedOrgans: [] } } };

  assert.equal(computeOverallApiHealth(okLive, okReady, okDeep), 'healthy');

  const degradedReady = { ...okReady, ok: false, httpStatus: 503, data: { status: 'degraded', storage: { durable: false } } };
  assert.equal(computeOverallApiHealth(okLive, degradedReady, okDeep), 'degraded');

  const failedOrganDeep = { ...okDeep, data: { status: 'nominal', ready: true, runtime: { failedOrgans: ['memory'] } } };
  assert.equal(computeOverallApiHealth(okLive, okReady, failedOrganDeep), 'degraded');

  const downLive = { ok: false, httpStatus: null, latencyMs: 12, checkedAt: 1, error: 'Failed to fetch', data: null };
  assert.equal(computeOverallApiHealth(downLive, okReady, okDeep), 'unreachable');
});

test('probeJsonEndpoint and probeAllApiHealth handle valid, 503, non-JSON, and network errors safely', async () => {
  const mockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '1.1.1', services: ['command', 'organs'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/readyz') {
      return new Response(JSON.stringify({ status: 'ok', systemHealth: 'nominal', storage: { durable: true, engine: 'supabase-postgres' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === '/api/health/deep') {
      return new Response(JSON.stringify({ status: 'degraded', ready: false, runtime: { registeredOrgans: 12, failedOrgans: [] } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('<html>Not Found</html>', { status: 404 });
  }) as typeof fetch;

  const snapshot = await probeAllApiHealth(mockFetch);
  assert.equal(snapshot.overall, 'degraded');
  assert.equal(snapshot.liveness.ok, true);
  assert.equal(snapshot.liveness.data?.version, '1.1.1');
  assert.equal(snapshot.readiness.ok, true);
  assert.equal(snapshot.readiness.data?.storage?.durable, true);
  assert.equal(snapshot.deep.ok, false);
  assert.equal(snapshot.deep.httpStatus, 503);
  assert.equal(snapshot.deep.data?.runtime?.registeredOrgans, 12);

  const htmlCheck = await probeJsonEndpoint('/missing', mockFetch);
  assert.equal(htmlCheck.ok, false);
  assert.equal(htmlCheck.httpStatus, 404);
  assert.match(htmlCheck.error ?? '', /Non-JSON response/);
});

test('WebSocket reconnect delay is bounded and readyState labels are explicit', () => {
  assert.equal(WS_MAX_RETRIES, 5);
  assert.equal(computeReconnectDelayMs(0), 2000);
  assert.equal(computeReconnectDelayMs(1), 4000);
  assert.equal(computeReconnectDelayMs(10), 30000);
  assert.equal(describeWsReadyState(0), 'CONNECTING (0)');
  assert.equal(describeWsReadyState(1), 'OPEN (1)');
  assert.equal(describeWsReadyState(2), 'CLOSING (2)');
  assert.equal(describeWsReadyState(3), 'CLOSED (3)');
  assert.equal(describeWsReadyState(null), 'IDLE');
});
