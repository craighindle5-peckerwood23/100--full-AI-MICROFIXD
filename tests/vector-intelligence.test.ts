import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createVectorIntelligenceRouter } from '../server/integrations/vector/intelligence';
import type { completeTextWithFallback } from '../server/orchestration/llmFallback';

test('Vector cognitive gateway authenticates independently, validates evidence and never fabricates provider success', async () => {
  process.env.VECTOR_CONNECTOR_SECRET = 'vector-test-secret-32-characters-long';
  const request = { schemaVersion: 'vector.intelligence.v1', requestId: randomUUID(), organizationId: randomUUID(), userId: randomUUID(), vehicleId: randomUUID(), workflowId: randomUUID(),
    task: 'diagnose', context: { question: 'Synthetic contract fixture' }, evidenceIds: [],
    constraints: { evidenceRequired: true, uncertaintyMustBePreserved: true, unsupportedSpecificationsProhibited: true, humanApprovalRequired: true, directVehicleControlProhibited: true } };
  let calls = 0, fail = false, hallucinate = false;
  const complete: typeof completeTextWithFallback = async messages => {
    calls++; assert.match(String(messages[0].content), /no tools/);
    if (fail) throw new Error('provider offline');
    return { content: JSON.stringify({ conclusion: 'Insufficient evidence.', observations: [], hypotheses: [], opportunityCandidates: [], requiredEvidence: ['Measured results'], recommendedTests: [], possibleRisks: [], uncertainty: ['No measurements supplied'], citations: hallucinate ? [randomUUID()] : [], safetyDisposition: 'insufficient_data', requiresHumanApproval: true }), provider: 'groq', model: 'test-fixture', tokensUsed: 10, truncated: false };
  };
  const app = express(); app.use(express.json()); app.use('/api/vector', createVectorIntelligenceRouter(complete));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const url = 'http://127.0.0.1:' + (server.address() as any).port + '/api/vector/intelligence';
  const post = (body: unknown, token = process.env.VECTOR_CONNECTOR_SECRET) => fetch(url, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post(request, 'wrong')).status, 401);
    assert.equal((await post({ ...request, execute: true })).status, 400);
    const first = await post(request); assert.equal(first.status, 200); const response = await first.json();
    assert.equal(response.requiresHumanApproval, true);
    assert.deepEqual(await (await post(request)).json(), response); assert.equal(calls, 1);
    assert.equal((await post({ ...request, context: { different: true } })).status, 409);
    hallucinate = true; assert.equal((await post({ ...request, requestId: randomUUID() })).status, 503);
    hallucinate = false; fail = true; assert.equal((await post({ ...request, requestId: randomUUID() })).status, 503);
  } finally { delete process.env.VECTOR_CONNECTOR_SECRET; await new Promise<void>(r => server.close(() => r())); }
});
