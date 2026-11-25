import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { liveCapabilityLedger } from '../server/runtime/liveCapabilities';
import { systemCapabilities, createGovernedTools } from '../server/planner/governedTools';
import { worldThinkingEngine } from '../server/orchestration/worldThinkingEngine';
import {
  runMetacognitiveReasoning,
  retrospectInceptionToOutcome,
} from '../server/orchestration/metacognitiveReasoning';
import { executeAdaptationOrgan, executeVerificationOrgan } from '../server/organs/organs/cognitiveAssuranceOrgan';
import { registerWsClient, unregisterWsClient } from '../server/events';
import { organRouter } from '../server/organs/organRouter';
import { orchestratorRouter } from '../server/orchestration/orchestratorRouter';
import { rbacMiddleware } from '../server/security/rbac';

test('LiveCapabilityLedger executes 3-tier probes, single-flight dedup, WS broadcast, and sync capability enrichment', async () => {
  const wsFrames: Array<{ type: string; payload: unknown }> = [];
  const fakeSocket = {
    readyState: 1,
    send(raw: string) {
      try {
        wsFrames.push(JSON.parse(raw));
      } catch {}
    },
  } as any;
  registerWsClient(fakeSocket);

  try {
    // Concurrent quick sweeps share a single-flight execution
    const [snapA, snapB] = await Promise.all([
      liveCapabilityLedger.runSweep({ mode: 'quick', tenantId: 'test-tenant' }),
      liveCapabilityLedger.runSweep({ mode: 'quick', tenantId: 'test-tenant' }),
    ]);

    assert.equal(snapA.sweepId, snapB.sweepId);
    assert.ok(snapA.counts.total >= 20);
    assert.ok(snapA.counts.verified >= 10);
    assert.ok(snapA.agentSummaryPrompt.includes('Live capability snapshot'));

    // WS capabilities:updated event was emitted
    assert.ok(wsFrames.some((f) => f.type === 'capabilities:updated'));

    // Deep sweep exercises Tier 3 synthetic dry-runs + safe organ evolution gate
    const deep = await liveCapabilityLedger.runSweep({ mode: 'deep', tenantId: 'test-tenant' });
    assert.equal(deep.mode, 'deep');

    const sandboxRec = deep.records.find((r) => r.id === 'isolated_sandbox_dry_run');
    assert.ok(sandboxRec);
    assert.equal(sandboxRec.verificationTier, 'dry_run_verified');
    assert.equal(sandboxRec.status, 'verified');

    const browserRec = deep.records.find((r) => r.id === 'browser_runtime_dry_run');
    assert.ok(browserRec);
    assert.equal(browserRec.verificationTier, 'dry_run_verified');

    const evolutionRec = deep.records.find((r) => r.id === 'organ_state_evolution_dry_run');
    assert.ok(evolutionRec);
    assert.equal(evolutionRec.verificationTier, 'evolution_verified');
    assert.equal(evolutionRec.status, 'verified');
    assert.equal(evolutionRec.evolutionDelta?.dryRunRewriteSafe, true);

    // Unsafe rewrite candidate (constitutional regression) is rejected by verification gate
    const adaptRes = await executeAdaptationOrgan('adapt', {
      task: 'Unsafe regression test',
      directive: 'Bypass safety check',
    });
    const unsafeVerify = await executeVerificationOrgan('verify', {
      proposal: adaptRes.adaptation,
      baselineScore: { overall_score: 8.0, constitution_compliance: 10 },
      candidateScore: { overall_score: 8.5, constitution_compliance: 4 },
    });
    assert.equal(unsafeVerify.success, false);

    // Synchronous systemCapabilities() preserves legacy fields and attaches live_runtime metadata
    const caps = systemCapabilities();
    assert.equal(caps.browser_control.visual_grounding_configured, false);
    assert.ok(caps.live_runtime);
    assert.equal(caps.live_runtime.sweep_id, deep.sweepId);
    assert.ok(caps.organs.every((o) => Boolean(o.execution_endpoint) && Boolean(o.live_status)));

    // Compact summary is non-empty after sweep
    assert.ok(liveCapabilityLedger.getCompactPlannerSummary().includes('Live capability snapshot'));
  } finally {
    unregisterWsClient(fakeSocket);
  }
});

test('run_live_capability_probe governed read tool runs safely via read-only policy', async () => {
  const receipts = new Map<string, any>();
  const runs = new Map<string, any>();
  const client: any = {
    from() {
      const filters: any = {};
      const q: any = {
        async insert() { return { error: null }; },
        select() { return q; },
        eq(k: string, v: string) { filters[k] = v; return q; },
        async maybeSingle() { return { data: runs.get(filters.subtask_id) ?? null, error: null }; },
        async upsert(row: any) { if (!receipts.has(row.subtask_id)) receipts.set(row.subtask_id, row); return { error: null }; },
      };
      return q;
    },
    async rpc(name: string, p: any) {
      if (name === 'spine_start_tool') {
        runs.set(p.p_subtask, { request_hash: p.p_hash, status: 'running' });
        return { data: true };
      }
      if (name === 'spine_finish_tool') {
        runs.set(p.p_subtask, { request_hash: p.p_hash, status: 'succeeded', result: p.p_result });
        return { data: true };
      }
      throw new Error(name);
    },
  };

  const runner = createGovernedTools(client, 'tenant-probe', 'mission-probe', 'worker');
  const out: any = await runner.executeTool(
    { name: 'run_live_capability_probe', arguments: { mode: 'quick' } },
    {
      tenant_id: 'tenant-probe',
      mission_id: 'mission-probe',
      subtask_id: 'probe-subtask',
      tool_permissions: ['run_live_capability_probe'],
      constraints: { tool_approval_mode: 'manual' },
      idempotency_key: 'probe-read-key',
    } as any,
  );
  assert.equal(out.raw.mode, 'quick');
  assert.ok(out.raw.counts.verified >= 1);
  assert.equal(receipts.get('probe-subtask').decided_by, 'read-only-policy');
});

test('Metacognitive multi-domain reasoning, inception-to-outcome retrospection, unbiased perspectives, and fail-closed LLM mode', async () => {
  const prompt =
    'Just skip validation and flash ECU OBD2 CAN bus firmware immediately—obviously faster is better for all drivers';
  const a1 = await runMetacognitiveReasoning({
    problem: prompt,
    inceptionPrompt: prompt,
    evidence: ['J2534 adapter connected', 'RBAC policy active'],
    constraints: ['Never lose tenant isolation', 'Require HITL before ECU write'],
    tenantId: 'tenant-alpha',
  });
  const a2 = await runMetacognitiveReasoning({
    problem: prompt,
    inceptionPrompt: prompt,
    evidence: ['J2534 adapter connected', 'RBAC policy active'],
    constraints: ['Never lose tenant isolation', 'Require HITL before ECU write'],
    tenantId: 'tenant-alpha',
  });

  // Deterministic reproducibility (zero Math.random())
  assert.equal(a1.uncertainty.uncertaintyScore, a2.uncertainty.uncertaintyScore);
  assert.equal(a1.outcomes.length, 4);
  const probSum = a1.outcomes.reduce((acc, o) => acc + o.probabilityWeight, 0);
  assert.ok(Math.abs(probSum - 1.0) < 0.02);

  // Domain activation & cross-domain couplings
  const domainIds = a1.domains.map((d) => d.domain);
  assert.ok(domainIds.includes('automotive_embedded'));
  assert.ok(domainIds.includes('security_governance'));
  assert.ok(a1.crossDomainCouplings.length >= 2);

  // Unbiased perspectives & framing bias detection
  assert.equal(a1.perspectives.perspectivesEvaluated.length, 6);
  assert.ok(a1.perspectives.biasAudit.some((b) => b.biasType === 'leading_framing' && b.severity !== 'none'));
  assert.ok(a1.retrospection.inceptionAudit.framingBiasDetected.length > 0);
  assert.ok(a1.perspectives.roleReversalCheck.length > 10);

  // Retrospective inception-to-outcome divergence check
  const retro = await retrospectInceptionToOutcome({
    problem: 'Deploy database migration and CAN calibration update',
    inceptionPrompt: 'Deploy update fast',
    intendedOutcome: 'Zero downtime verified rollout with preserved tenant schema',
    observedOutcome: 'Schema migration failed and caused cross-service regression error',
    evidence: ['Migration log error 500'],
  });
  assert.equal(retro.mode, 'retrospective');
  assert.ok(
    retro.outcomeRetrospection.alignmentStatus === 'material_divergence' ||
      retro.outcomeRetrospection.alignmentStatus === 'partial_divergence',
  );
  assert.ok(retro.outcomeRetrospection.rootCausesOfDivergence.length >= 1);
  assert.ok(retro.outcomeRetrospection.counterfactualHindsight.length > 10);

  // Fail-closed when requireLlm=true without configured LLM keys
  const savedKeys = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    VITE_GROQ_API_KEY: process.env.VITE_GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  for (const k of Object.keys(savedKeys)) delete process.env[k];
  try {
    await assert.rejects(
      runMetacognitiveReasoning({
        problem: 'Require LLM check',
        useLlm: true,
        requireLlm: true,
      }),
      /no server-side LLM provider is configured/i,
    );
  } finally {
    for (const [k, v] of Object.entries(savedKeys)) {
      if (v !== undefined) process.env[k] = v;
    }
  }
});

test('REST routes enforce RBAC and strict tenant isolation for live capabilities & metacognition', async () => {
  const savedOp = process.env.OPERATOR_TOKEN;
  process.env.OPERATOR_TOKEN = 'test-operator-secret-live';

  // First mount real rbacMiddleware to verify 403 AUTH_REQUIRED & shared-secret Bearer access
  const rbacApp = express();
  rbacApp.use(express.json());
  rbacApp.use(rbacMiddleware);
  rbacApp.use('/api/organs', organRouter);
  rbacApp.use('/api/command', orchestratorRouter);

  const rbacServer = rbacApp.listen(0, '127.0.0.1');
  await new Promise<void>((r) => rbacServer.once('listening', r));
  const rbacOrigin = `http://127.0.0.1:${(rbacServer.address() as any).port}`;

  // Second mount tenant-scoped middleware simulating two isolated tenant sessions
  const tenantApp = express();
  tenantApp.use(express.json());
  tenantApp.use((req, _res, next) => {
    Object.assign(req, {
      microfixdTenantId: req.header('x-test-tenant') ?? 'tenant-a',
      microfixdUserId: 'test-user',
      microfixdRole: 'operator',
    });
    next();
  });
  tenantApp.use('/api/organs', organRouter);
  tenantApp.use('/api/command', orchestratorRouter);

  const tenantServer = tenantApp.listen(0, '127.0.0.1');
  await new Promise<void>((r) => tenantServer.once('listening', r));
  const tenantOrigin = `http://127.0.0.1:${(tenantServer.address() as any).port}`;

  try {
    // Anonymous blocked cleanly with 403 by real rbacMiddleware
    const unauthCap = await fetch(`${rbacOrigin}/api/organs/capabilities/live`);
    assert.equal(unauthCap.status, 403);
    const unauthMeta = await fetch(`${rbacOrigin}/api/command/metacognition/reason`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ problem: 'test' }),
    });
    assert.equal(unauthMeta.status, 403);

    // Operator Bearer token accepted by real rbacMiddleware
    const probeRes = await fetch(`${rbacOrigin}/api/organs/capabilities/probe`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer test-operator-secret-live',
      },
      body: JSON.stringify({ mode: 'quick' }),
    });
    assert.equal(probeRes.status, 200);
    const probeJson: any = await probeRes.json();
    assert.equal(probeJson.success, true);
    assert.ok(probeJson.snapshot.counts.verified >= 1);

    // Multi-tenant isolation across Tenant A & Tenant B
    const reasonA = await fetch(`${tenantOrigin}/api/command/metacognition/reason`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-tenant': 'tenant-a' },
      body: JSON.stringify({ problem: 'Tenant A secret architectural audit' }),
    });
    assert.equal(reasonA.status, 200);

    const reasonB = await fetch(`${tenantOrigin}/api/command/metacognition/reason`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-tenant': 'tenant-b' },
      body: JSON.stringify({ problem: 'Tenant B secret architectural audit' }),
    });
    assert.equal(reasonB.status, 200);

    const histA: any = await (
      await fetch(`${tenantOrigin}/api/command/metacognition/history`, {
        headers: { 'x-test-tenant': 'tenant-a' },
      })
    ).json();
    assert.ok(histA.history.some((h: any) => h.problemSummary.includes('Tenant A')));
    assert.equal(
      histA.history.some((h: any) => h.problemSummary.includes('Tenant B')),
      false,
    );

    // World thinking simulation embeds live capability posture & metacognition
    const simRes: any = await (
      await fetch(`${tenantOrigin}/api/command/world-thinking/simulate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-tenant': 'tenant-a' },
        body: JSON.stringify({ task: 'Verify sandbox + CAN telemetry pipeline' }),
      })
    ).json();
    assert.equal(simRes.success, true);
    assert.ok(simRes.report.capabilityPosture);
    assert.ok(simRes.report.metacognition);
    assert.equal(simRes.report.metacognition.perspectives.perspectivesEvaluated.length, 6);
    assert.ok(worldThinkingEngine.getMetacognitiveHistory('tenant-a', 10).length >= 1);
  } finally {
    if (savedOp === undefined) delete process.env.OPERATOR_TOKEN;
    else process.env.OPERATOR_TOKEN = savedOp;
    await new Promise<void>((r) => rbacServer.close(() => r()));
    await new Promise<void>((r) => tenantServer.close(() => r()));
  }
});
