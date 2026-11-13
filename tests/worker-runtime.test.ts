import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlannerWorkerStatus,plannerWorkerStarted,plannerWorkerTickStarted,
  plannerWorkerMissionStarted,plannerWorkerMissionCompleted,plannerWorkerTickCompleted,
  plannerWorkerError,plannerWorkerStopped
} from '../server/planner/workerRuntime';

test('planner worker reports healthy lifecycle and mission progress',()=>{
  plannerWorkerStarted();
  let s=getPlannerWorkerStatus();
  assert.equal(s.phase,'idle');assert.equal(s.healthy,true);
  plannerWorkerTickStarted();plannerWorkerMissionStarted('mission-a');
  s=getPlannerWorkerStatus();
  assert.equal(s.phase,'busy');assert.equal(s.activeMissionId,'mission-a');assert.equal(s.stale,false);
  plannerWorkerMissionCompleted();plannerWorkerTickCompleted();
  s=getPlannerWorkerStatus();
  assert.equal(s.phase,'idle');assert.equal(s.missionsProcessed>=1,true);assert.equal(s.consecutiveErrors,0);
});

test('planner worker exposes repeated errors and stopped state',()=>{
  plannerWorkerStarted();
  for(let i=0;i<5;i++)plannerWorkerError(Object.assign(new Error('storage timeout'),{code:'STORAGE_TIMEOUT'}));
  let s=getPlannerWorkerStatus();
  assert.equal(s.healthy,false);assert.equal(s.consecutiveErrors>=5,true);assert.equal(s.lastErrorCode,'STORAGE_TIMEOUT');
  plannerWorkerStopped();s=getPlannerWorkerStatus();
  assert.equal(s.phase,'stopped');assert.equal(s.healthy,false);
});
