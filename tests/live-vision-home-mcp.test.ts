import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';
import {
  classifyServerEventForSpeech,
  matchesExpandIntent,
  sanitizeForSpeech,
  shapeIntelligentSpeech,
} from '../src/voice/speechFeedbackCoordinator';
import {
  attachLiveVisionVoiceBridge,
  type LiveConnectFn,
} from '../server/realtime/liveVisionVoiceBridge';
import {
  autonomousHomeRouter,
  classifyAutoGoal,
} from '../server/orchestration/autonomousHomeRouter';
import { mcpRouter } from '../server/mcp/mcpRouter';
import { pluginRouter } from '../server/plugins/pluginRouter';
import { safeConnectorUrl } from '../server/plugins/connectorExecutor';
import {
  CONNECTOR_TEMPLATES,
  hasConnectorSecret,
  installConnector,
  listConnectors,
  removeConnector,
} from '../server/plugins/pluginRegistry';
import { rbacMiddleware } from '../server/security/rbac';
import { trigger as triggerHitl, getPending as getPendingHitl } from '../server/hitl/hitlManager';

test('speechFeedbackCoordinator condenses verbose outputs and filters proactive alerts', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const raw = [
    `## Diagnostic Report (${uuid})`,
    '```json\n{"raw": true}\n```',
    'Primary check succeeded with 9/10 verified organs across the runtime.',
    'Average latency measured at 42 ms across core cognitive endpoints and memory stores.',
    'Remaining background queues are nominal with zero stalled missions, zero deadlocks, and zero unauthorized boundary crossings during this sweep window.',
  ].join(' ');

  const cleaned = sanitizeForSpeech(raw);
  assert.ok(!cleaned.includes(uuid));
  assert.ok(!cleaned.includes('```'));

  const shaped = shapeIntelligentSpeech({ text: raw, maxSummaryChars: 240 });
  assert.equal(shaped.hasMore, true);
  assert.equal(shaped.condensed, true);
  assert.ok(shaped.summary.length <= 240);
  assert.ok(shaped.expandableDetail.length > shaped.summary.length);
  assert.ok(shaped.metricsExtracted.some((m) => m.includes('9/10') || m.includes('42 ms')));

  assert.equal(matchesExpandIntent('Can you expand on that?'), true);
  assert.equal(matchesExpandIntent('Tell me more details'), true);
  assert.equal(matchesExpandIntent('Run a quick scan'), false);

  // Silent when voice & live session are both off
  const silentDecision = classifyServerEventForSpeech(
    { type: 'hitl:review_required', payload: { hitl_id: 'h1', artifact: { name: 'Write file' } } },
    { voiceActive: false, liveSessionActive: false },
  );
  assert.equal(silentDecision.shouldSpeak, false);

  // Silent for routine non-critical telemetry even when voice is on
  const routineDecision = classifyServerEventForSpeech(
    { type: 'heartbeat', payload: { ok: true } },
    { voiceActive: true, liveSessionActive: true },
  );
  assert.equal(routineDecision.shouldSpeak, false);

  // Speaks concise critical alert for HITL approval when voice active
  const hitlDecision = classifyServerEventForSpeech(
    { type: 'hitl:review_required', payload: { hitl_id: 'h1', artifact: { name: 'Deploy Patch' } } },
    { voiceActive: true, liveSessionActive: false },
  );
  assert.equal(hitlDecision.shouldSpeak, true);
  assert.equal(hitlDecision.urgency, 'critical');
  assert.ok(hitlDecision.spokenBrief.includes('Deploy Patch'));
});

test('liveVisionVoiceBridge enforces RBAC auth, fails closed without API key, and relays live voice/vision/tools', async () => {
  const prevAdmin = process.env.ADMIN_TOKEN;
  const prevOp = process.env.OPERATOR_TOKEN;
  const prevGemini = process.env.GEMINI_API_KEY;
  process.env.ADMIN_TOKEN = 'live-test-admin';
  process.env.OPERATOR_TOKEN = 'live-test-operator';
  delete process.env.GEMINI_API_KEY;

  // 1. Fail-closed check when GEMINI_API_KEY missing and no test hook
  const server1 = http.createServer();
  attachLiveVisionVoiceBridge(server1);
  await new Promise<void>((resolve) => server1.listen(0, '127.0.0.1', resolve));
  const addr1 = server1.address() as { port: number };
  const baseWs1 = `ws://127.0.0.1:${addr1.port}/ws/live`;

  try {
    // Unauthenticated token rejected with 1008
    const wsBad = new WebSocket(baseWs1);
    await new Promise<void>((resolve) => wsBad.once('open', resolve));
    wsBad.send(JSON.stringify({ type: 'authenticate', payload: { token: 'invalid-token' } }));
    const closeInfo = await new Promise<{ code: number }>((resolve) =>
      wsBad.once('close', (code) => resolve({ code })),
    );
    assert.equal(closeInfo.code, 1008);

    // Valid operator receives GEMINI_API_KEY_NOT_CONFIGURED on session.start
    const wsOp = new WebSocket(baseWs1);
    await new Promise<void>((resolve) => wsOp.once('open', resolve));
    wsOp.send(JSON.stringify({ type: 'authenticate', payload: { token: 'live-test-operator' } }));
    const authMsg = await new Promise<any>((resolve) =>
      wsOp.once('message', (d) => resolve(JSON.parse(d.toString()))),
    );
    assert.equal(authMsg.type, 'authenticated');

    wsOp.send(JSON.stringify({ type: 'session.start', model: 'gemini-3.8-live', voiceName: 'Zephyr' }));
    const errMsg = await new Promise<any>((resolve) =>
      wsOp.once('message', (d) => resolve(JSON.parse(d.toString()))),
    );
    assert.equal(errMsg.type, 'error');
    assert.equal(errMsg.code, 'GEMINI_API_KEY_NOT_CONFIGURED');
    wsOp.close();
  } finally {
    await new Promise<void>((resolve) => server1.close(() => resolve()));
  }

  // 2. Full-duplex audio/video/tool relay with injected liveConnect
  const sentInputs: any[] = [];
  const toolResponses: any[] = [];
  let sessionClosed = false;
  let capturedCallbacks: any = null;

  const fakeConnect: LiveConnectFn = async ({ callbacks }) => {
    capturedCallbacks = callbacks;
    return {
      sendRealtimeInput: (input) => {
        sentInputs.push(input);
      },
      sendToolResponse: (payload) => {
        toolResponses.push(payload);
      },
      close: () => {
        sessionClosed = true;
      },
    };
  };

  const server2 = http.createServer();
  attachLiveVisionVoiceBridge(server2, { liveConnect: fakeConnect });
  await new Promise<void>((resolve) => server2.listen(0, '127.0.0.1', resolve));
  const addr2 = server2.address() as { port: number };
  const baseWs2 = `ws://127.0.0.1:${addr2.port}/ws/live`;

  try {
    const ws = new WebSocket(baseWs2);
    const messages: any[] = [];
    ws.on('message', (d) => messages.push(JSON.parse(d.toString())));
    await new Promise<void>((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({ type: 'authenticate', payload: { token: 'live-test-admin' } }));
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(messages.some((m) => m.type === 'authenticated'), true);

    ws.send(JSON.stringify({ type: 'session.start', model: 'gemini-3.8-live-extended-thinking', voiceName: 'Kore' }));
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(messages.some((m) => m.type === 'live.ready' && m.voiceName === 'Kore'), true);

    // Send 16kHz PCM audio & 1 FPS video frame (second burst frame throttled)
    ws.send(JSON.stringify({ type: 'audio.chunk', data: Buffer.from([1, 2, 3, 4]).toString('base64') }));
    ws.send(JSON.stringify({ type: 'video.frame', data: Buffer.from('jpeg-frame-1').toString('base64') }));
    ws.send(JSON.stringify({ type: 'video.frame', data: Buffer.from('jpeg-frame-2-dropped').toString('base64') }));
    ws.send(JSON.stringify({ type: 'text.turn', text: 'Summarize active health.' }));
    await new Promise((r) => setTimeout(r, 40));

    assert.equal(sentInputs.filter((i) => i.audio?.mimeType === 'audio/pcm;rate=16000').length, 1);
    assert.equal(sentInputs.filter((i) => i.video?.mimeType === 'image/jpeg').length, 1);
    assert.equal(sentInputs.filter((i) => i.text === 'Summarize active health.').length, 1);

    // Upstream audio, transcription, interruption, and non-blocking tool call
    capturedCallbacks.onmessage({
      serverContent: {
        outputTranscription: { text: 'System health looks nominal.' },
        modelTurn: { parts: [{ inlineData: { data: 'AQID', mimeType: 'audio/pcm;rate=24000' } }] },
        interrupted: true,
      },
      toolCall: {
        functionCalls: [{ id: 'call-1', name: 'get_system_status', args: {} }],
      },
    });
    await new Promise((r) => setTimeout(r, 60));

    assert.equal(messages.some((m) => m.type === 'transcript.output' && m.text.includes('nominal')), true);
    assert.equal(messages.some((m) => m.type === 'audio.chunk' && m.data === 'AQID'), true);
    assert.equal(messages.some((m) => m.type === 'interrupted'), true);
    assert.equal(messages.some((m) => m.type === 'tool.result' && m.name === 'get_system_status' && m.ok === true), true);
    assert.equal(toolResponses.length, 1);
    assert.equal(toolResponses[0].functionResponses[0].name, 'get_system_status');

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(sessionClosed, true);
  } finally {
    await new Promise<void>((resolve) => server2.close(() => resolve()));
    if (prevAdmin === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = prevAdmin;
    if (prevOp === undefined) delete process.env.OPERATOR_TOKEN; else process.env.OPERATOR_TOKEN = prevOp;
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prevGemini;
  }
});

test('autonomousHomeRouter classifies auto goals, collects pending HITL, and enforces admin role on approvals', async () => {
  const prevAdmin = process.env.ADMIN_TOKEN;
  const prevOp = process.env.OPERATOR_TOKEN;
  process.env.ADMIN_TOKEN = 'home-test-admin';
  process.env.OPERATOR_TOKEN = 'home-test-operator';

  const info = classifyAutoGoal('What is the current health status of the runtime?');
  assert.equal(info.strategy, 'chat');

  const mission = classifyAutoGoal('Inspect https://example.com/docs and summarize API endpoints');
  assert.equal(mission.strategy, 'mission');
  assert.deepEqual(mission.derivedOrigins, ['https://example.com']);

  const missing = classifyAutoGoal('Browse the website and check status');
  assert.equal(missing.strategy, 'needs_input');
  assert.ok(missing.missingFields?.includes('target_url'));

  const app = express();
  app.use(express.json());
  app.use(rbacMiddleware);
  app.use('/api/command', autonomousHomeRouter);
  app.use('/api', autonomousHomeRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const hitlRecord = triggerHitl('default:home-test', { name: 'Approve Critical Change', type: 'patch' }, 'test_decision');

  try {
    // 1. /api/command/auto detects missing critical URL cleanly without creating blind failure
    const autoRes = await fetch(`${baseUrl}/api/command/auto`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer home-test-operator',
      },
      body: JSON.stringify({ task: 'Open the webpage and summarize it' }),
    });
    assert.equal(autoRes.status, 200);
    const autoData = (await autoRes.json()) as any;
    assert.equal(autoData.needsInput, true);
    assert.equal(autoData.decision.kind, 'missing_info');

    // 2. /api/decisions/pending lists the triggered HITL item
    const pendRes = await fetch(`${baseUrl}/api/decisions/pending`, {
      headers: { authorization: 'Bearer home-test-operator' },
    });
    assert.equal(pendRes.status, 200);
    const pendData = (await pendRes.json()) as any;
    assert.ok(pendData.decisions.some((d: any) => d.hitlId === hitlRecord.hitl_id));

    // 3. Operator cannot approve HITL decisions (admin enforced)
    const opResolve = await fetch(`${baseUrl}/api/decisions/resolve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer home-test-operator',
      },
      body: JSON.stringify({ kind: 'hitl_review', hitlId: hitlRecord.hitl_id, decision: 'approved' }),
    });
    assert.equal(opResolve.status, 403);

    // 4. Admin can approve HITL decision
    const adminResolve = await fetch(`${baseUrl}/api/decisions/resolve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer home-test-admin',
      },
      body: JSON.stringify({ kind: 'hitl_review', hitlId: hitlRecord.hitl_id, decision: 'approved' }),
    });
    assert.equal(adminResolve.status, 200);
    const adminData = (await adminResolve.json()) as any;
    assert.equal(adminData.success, true);
    assert.equal(getPendingHitl().some((h) => h.hitl_id === hitlRecord.hitl_id), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevAdmin === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = prevAdmin;
    if (prevOp === undefined) delete process.env.OPERATOR_TOKEN; else process.env.OPERATOR_TOKEN = prevOp;
  }
});

test('Universal App & MCP Gateway validates SSRF, hides secrets, gates writes, and serves JSON-RPC 2.0', async () => {
  const prevAdmin = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'mcp-test-admin';

  // SSRF / URL hardening checks
  assert.throws(() => safeConnectorUrl('http://api.example.com'), /HTTPS required/);
  assert.throws(() => safeConnectorUrl('https://127.0.0.1/secret'), /Private\/local/);
  assert.throws(() => safeConnectorUrl('https://user:pass@api.example.com'), /credentials/);
  assert.ok(CONNECTOR_TEMPLATES.some((t) => t.transport === 'mcp-http'));
  assert.ok(CONNECTOR_TEMPLATES.some((t) => t.transport === 'graphql'));
  assert.ok(CONNECTOR_TEMPLATES.some((t) => t.transport === 'webhook'));

  const app = express();
  app.use(express.json());
  app.use(rbacMiddleware);
  app.use('/api/plugins', pluginRouter);
  app.use('/api/mcp', mcpRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Install an app connector with a server-only secret
    const installRes = await fetch(`${baseUrl}/api/plugins/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-test-admin' },
      body: JSON.stringify({
        id: 'test-crm',
        name: 'Test CRM',
        version: '1.0.0',
        transport: 'rest',
        category: 'productivity',
        baseUrl: 'https://crm.example.com',
        auth: { type: 'bearer' },
        secret: 'super-secret-crm-token',
        autoEnable: true,
        tools: [
          { name: 'list_contacts', method: 'GET', path: '/v1/contacts', risk: 'read' },
          { name: 'create_contact', method: 'POST', path: '/v1/contacts', risk: 'write' },
        ],
      }),
    });
    assert.equal(installRes.status, 201);
    const installJson = (await installRes.json()) as any;
    assert.equal(installJson.credentialConfigured, true);
    assert.equal(JSON.stringify(installJson).includes('super-secret-crm-token'), false);

    // Listing connectors never exposes secret value
    const listRes = await fetch(`${baseUrl}/api/plugins`, {
      headers: { authorization: 'Bearer mcp-test-admin' },
    });
    const listText = await listRes.text();
    assert.equal(listText.includes('super-secret-crm-token'), false);
    const installedRecord = listConnectors('default').find((c) => c.manifest.id === 'test-crm');
    assert.ok(installedRecord);
    assert.equal(hasConnectorSecret(installedRecord, 'default'), true);

    // Write tool call without approval_id pauses with HITL 202
    const writeRes = await fetch(`${baseUrl}/api/plugins/test-crm/call/create_contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-test-admin' },
      body: JSON.stringify({ arguments: { email: 'a@example.com' } }),
    });
    assert.equal(writeRes.status, 202);
    const writeJson = (await writeRes.json()) as any;
    assert.equal(writeJson.code, 'HITL_REQUIRED');

    // MCP JSON-RPC 2.0 initialize, tools/list, tools/call, resources/read
    const rpcInit = await fetch(`${baseUrl}/api/mcp/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-test-admin' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    }).then((r) => r.json() as Promise<any>);
    assert.equal(rpcInit.result.serverInfo.name, 'Microfixd-MCP');

    const rpcList = await fetch(`${baseUrl}/api/mcp/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-test-admin' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    }).then((r) => r.json() as Promise<any>);
    assert.ok(rpcList.result.tools.some((t: any) => t.name === 'app.test-crm.list_contacts'));
    assert.ok(rpcList.result.tools.some((t: any) => t.name === 'system_health'));

    const rpcCall = await fetch(`${baseUrl}/api/mcp/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-test-admin' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'system_health', arguments: {} } }),
    }).then((r) => r.json() as Promise<any>);
    assert.equal(rpcCall.result.isError, false);
    assert.ok(rpcCall.result.content[0].text.includes('capabilities'));

    const rpcRes = await fetch(`${baseUrl}/api/mcp/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-test-admin' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'microfixd://connectors/installed' } }),
    }).then((r) => r.json() as Promise<any>);
    assert.ok(rpcRes.result.contents[0].text.includes('test-crm'));
  } finally {
    removeConnector('test-crm', 'default');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevAdmin === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = prevAdmin;
  }
});
