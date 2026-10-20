import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DispatcherTrackingHook, type DatabaseConnection} from '../server/core/dispatcherTrackingHook';
import type {DispatchResult} from '../server/core/missionDispatcher';

const sample: DispatchResult = {taskId:'task-abc',missionId:'mission-xyz',status:'SUCCESS',timestamp:'2026-10-20T12:00:00.000Z',adapterResponse:{status:'succeeded',result:{complete:true},evidenceHash:'a'.repeat(64)}};
test('insert uses six bound values and rejects duplicate events', async () => {
  const db: DatabaseConnection = {async execute(query,params) {
    assert.match(query,/ON CONFLICT \(mission_id,task_id\) DO NOTHING/);
    assert.equal(params.length,6);
    assert.equal(params[0],sample.taskId);
    return {rowCount:1,rows:[]};
  }};
  assert.equal(await new DispatcherTrackingHook(db).logEvent(sample),true);
});
test('metric aggregate is scoped by mission and yields 90 percent', async () => {
  const db: DatabaseConnection = {async execute(query,params) {
    assert.match(query,/WHERE mission_id=\$1/);
    assert.deepEqual(params,['mission-xyz']);
    return {rowCount:1,rows:[{total:'10',successes:'9',failures:'1'}]};
  }};
  assert.deepEqual(await new DispatcherTrackingHook(db).getMissionMetrics('mission-xyz'),{totalDispatched:10,successCount:9,failureCount:1,reliabilityRate:90});
});
test('database write failures are not swallowed', async () => {
  const db: DatabaseConnection = {async execute() {throw new Error('database unavailable');}};
  await assert.rejects(new DispatcherTrackingHook(db).logEvent(sample),/Database tracking hook failure/);
});
