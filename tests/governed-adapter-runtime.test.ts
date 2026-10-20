import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GovernedAdapterRuntime, ToolExecutionError, webhookSignatureValid} from '../server/tools/governedAdapterRuntime';

const envelope = {missionId: 'mission-1', subtaskId: 'subtask-1', tool: 'sample', arguments: {value: 2}, idempotencyKey: 'mission-1:subtask-1'};
test('authorized execution returns evidence and persists result', async () => {
  const saved: unknown[] = [];
  const runtime = new GovernedAdapterRuntime(async () => true, async (_e, result) => {saved.push(result);});
  runtime.register({name: 'sample', async execute(args) {return {value: args.value};}});
  const result = await runtime.execute(envelope);
  assert.equal(result.status, 'succeeded');
  assert.equal(result.evidenceHash.length, 64);
  assert.deepEqual(saved, [result]);
});
test('unauthorized execution never invokes adapter', async () => {
  let invoked = false;
  const runtime = new GovernedAdapterRuntime(async () => false, async () => {});
  runtime.register({name: 'sample', async execute() {invoked = true; return {}; }});
  await assert.rejects(runtime.execute(envelope), (error: unknown) => error instanceof ToolExecutionError && error.code === 'NOT_AUTHORIZED');
  assert.equal(invoked, false);
});
test('failed execution is recorded', async () => {
  let saved = false;
  const runtime = new GovernedAdapterRuntime(async () => true, async () => {saved = true;});
  runtime.register({name: 'sample', async execute() {throw new Error('service unavailable');}});
  const result = await runtime.execute(envelope);
  assert.equal(result.status, 'failed');
  assert.match(result.error ?? '', /service unavailable/);
  assert.equal(saved, true);
});
test('webhook digest comparison rejects invalid signatures', () => {
  assert.equal(webhookSignatureValid(Buffer.from('test'), '00'.repeat(32), 'secret'), false);
  assert.equal(webhookSignatureValid(Buffer.from('test'), 'not-a-digest', 'secret'), false);
});
