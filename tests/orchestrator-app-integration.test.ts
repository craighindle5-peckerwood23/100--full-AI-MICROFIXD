import assert from 'node:assert/strict';
import {test} from 'node:test';
import {OrchestratorApp} from '../server/core/orchestratorApp';
import type {DatabaseConnection} from '../server/core/dispatcherTrackingHook';
import {GovernedAdapterRuntime} from '../server/tools/governedAdapterRuntime';

test('bootstrap validates dependencies and dispatches with persisted audit',async()=>{
  const logs:readonly unknown[][]=[];
  const db:DatabaseConnection={async execute(query,params){
    assert.match(query,/INSERT INTO public.mission_dispatch_logs/);
    (logs as unknown[][]).push([...params]);
    return {rowCount:1,rows:[]};
  }};
  const runtime=new GovernedAdapterRuntime(async()=>true,async()=>{});
  runtime.register({name:'status_read',async execute(){return {online:true};}});
  const app=new OrchestratorApp();
  assert.throws(()=>app.bootstrap({maxConcurrency:0},db,runtime),/invalid concurrency/);
  app.bootstrap({maxConcurrency:2},db,runtime);
  const result=await app.processOrchestrationPipeline([{taskId:'task-1',missionId:'mission-1',endpoint:'status_read',payload:{},maxRetries:0,timeoutMs:1000}]);
  assert.equal(result[0].status,'SUCCESS');
  assert.equal(logs.length,1);
  assert.equal(logs[0][0],'task-1');
  assert.throws(()=>app.bootstrap({maxConcurrency:2},db,runtime),/already initialized/);
});
test('audit failure rejects the pipeline instead of reporting success',async()=>{
  const db:DatabaseConnection={async execute(){throw new Error('database offline');}};
  const runtime=new GovernedAdapterRuntime(async()=>true,async()=>{});
  runtime.register({name:'status_read',async execute(){return {online:true};}});
  const app=new OrchestratorApp();
  app.bootstrap({maxConcurrency:1},db,runtime);
  await assert.rejects(app.processOrchestrationPipeline([{taskId:'task-2',missionId:'mission-1',endpoint:'status_read',payload:{},maxRetries:0,timeoutMs:1000}]),/Dispatch audit persistence failed/);
});
