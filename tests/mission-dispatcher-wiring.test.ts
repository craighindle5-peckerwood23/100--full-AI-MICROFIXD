import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MissionDispatcher, type MissionTask} from '../server/core/missionDispatcher';
import {GovernedAdapterRuntime} from '../server/tools/governedAdapterRuntime';

const task = (id: string): MissionTask => ({
  taskId: id, missionId: 'mission-999', endpoint: 'safe_action', payload: {action: 'READ_STATUS'}, maxRetries: 2, timeoutMs: 5000
});
test('dispatcher processes every task, retains input order and enforces concurrency', async () => {
  let running = 0, peak = 0;
  const runtime = new GovernedAdapterRuntime(async () => true, async () => {});
  runtime.register({name: 'safe_action', async execute(args) {
    running++; peak = Math.max(peak, running);
    await new Promise(resolve => setTimeout(resolve, 5));
    running--; return {action: args.action};
  }});
  const dispatcher = new MissionDispatcher(runtime, 2);
  const results = await dispatcher.dispatchMissionBatch(Array.from({length: 7}, (_, i) => task(String(i))));
  assert.deepEqual(results.map(r => r.taskId), ['0','1','2','3','4','5','6']);
  assert.ok(results.every(r => r.status === 'SUCCESS'));
  assert.ok(peak <= 2);
});
test('dispatcher fails closed on unauthorized action without execution', async () => {
  let executed = false;
  const runtime = new GovernedAdapterRuntime(async () => false, async () => {});
  runtime.register({name: 'safe_action', async execute() {executed = true; return {}; }});
  const result = await new MissionDispatcher(runtime).dispatchMissionBatch([task('blocked')]);
  assert.equal(result[0].status, 'FAILED');
  assert.equal(executed, false);
});
test('unknown tool cannot execute arbitrary external action', async () => {
  const runtime = new GovernedAdapterRuntime(async () => true, async () => {});
  const result = await new MissionDispatcher(runtime).dispatchMissionBatch([{...task('unknown'), endpoint: 'EXFILTRATE'}]);
  assert.equal(result[0].status, 'FAILED');
});
