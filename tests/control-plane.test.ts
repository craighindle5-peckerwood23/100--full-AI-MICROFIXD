import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {plannerRouter} from '../server/planner/plannerRouter';
import {executionRouter} from '../server/execution/executionRouter';
import {autonomyRouter} from '../server/autonomy-adapter/autonomyRouter';
import {toolsRouter} from '../server/tools/toolsRouter';
import {skinRouter} from '../server/skin/skinRouter';
import {orchestratorRouter} from '../server/orchestration/orchestratorRouter';
import type {Mission} from '../server/planner/executionSpine';
import {routePermission} from '../server/security/routePermission';

test('all compatibility submissions reuse one persisted tenant-scoped mission and survive router recreation',async()=>{
 const saved=new Map<string,Mission>();
 const store=express();store.use(express.json());
 store.post('/rest/v1/rpc/spine_lease',(_req,res)=>res.json(true));
 store.post('/rest/v1/rpc/spine_commit',(req,res)=>{for(const op of req.body.p_operations){const m=op.data;const key=`${m.tenant_id}:${m.mission_id}`;if(!saved.has(key))saved.set(key,m);}res.json(true);});
 store.get('/rest/v1/spine_rows',(req,res)=>{
  const tenant=String(req.query.tenant_id).slice(3),id=String(req.query.id??'').slice(3),kind=String(req.query.kind).slice(3);
  const rows=kind==='missions'?[...saved.values()].filter(m=>m.tenant_id===tenant&&(!id||m.mission_id===id)).map(data=>({data})):[];
  if(req.header('accept')?.includes('vnd.pgrst.object'))return rows.length?res.json(rows[0]):res.status(406).json({code:'PGRST116'});
  res.json(rows);
 });
 const db=store.listen(0,'127.0.0.1');await new Promise<void>(r=>db.once('listening',r));
 const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL=`http://127.0.0.1:${(db.address() as any).port}`;process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-key';
 const makeApp=()=>{const app=express();app.use(express.json());app.use((req,_res,next)=>{Object.assign(req,{microfixdTenantId:req.header('x-test-tenant')??'a',microfixdUserId:'test-operator',microfixdRole:req.header('x-test-role')??'admin'});next();});app.use('/api/planner',plannerRouter);app.use('/api/execution',executionRouter);app.use('/api/autonomy',autonomyRouter);app.use('/api/tools',toolsRouter);app.use('/api/skin',skinRouter);app.use('/api/command',orchestratorRouter);return app;};
 let server=makeApp().listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const origin=()=>`http://127.0.0.1:${(server.address() as any).port}`;
 const submit=async(path:string,body:any,key='same-request',tenant='a',role='admin')=>{const response=await fetch(origin()+path,{method:'POST',headers:{'content-type':'application/json','Idempotency-Key':key,'x-test-tenant':tenant,'x-test-role':role,'x-microfixd-tenant':'untrusted'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 try{
  let id='';
  for(const [path,field] of [['/api/planner/missions','objective'],['/api/execution/run','task'],['/api/autonomy/goals','goal'],['/api/tools/run','message'],['/api/skin/receive','payload'],['/api/command/run','task']]){
   const result=await submit(path,{[field]:'Verify one control plane'});
   assert.equal(result.status,202,JSON.stringify(result));id||=result.body.mission_id;
   assert.equal(result.body.mission_id,id);assert.equal(result.body.tenant_id,'a');assert.equal(result.body.status,'queued');
  }
  assert.equal(saved.size,1);
  const {ENABLED_TOOLS}=await import('../server/planner/governedTools');
  const initial=[...saved.values()][0];assert.deepEqual(initial.constraints.tool_permissions,ENABLED_TOOLS);assert.equal(initial.constraints.tool_approval_mode,'preauthorized');
  const restricted=await submit('/api/planner/missions',{objective:'Restricted scope',tool_permissions:[],tool_approval_mode:'preauthorized',approval_actor:'forged'},'operator-request','a','operator');
  assert.equal(restricted.status,202);assert.equal(restricted.body.constraints.tool_approval_mode,'manual');assert.equal(restricted.body.constraints.approval_actor,null);assert.deepEqual(restricted.body.constraints.tool_permissions,[]);
  const browser=await submit('/api/tools/execute',{tool_name:'take_screenshot',arguments:{url:'https://example.org/page'}},'browser-request');
  assert.equal(browser.status,202);assert.deepEqual(browser.body.constraints.browser_origins,['https://example.org']);
  const manual=await submit('/api/planner/missions',{objective:'Manual mission',tool_approval_mode:'manual'},'manual');assert.equal(manual.body.constraints.tool_approval_mode,'manual');
  const invalid=await submit('/api/planner/missions',{objective:'Invalid plan',plan:[null]},'invalid-plan');assert.equal(invalid.status,400);

  const conflict=await submit('/api/execution/run',{task:'Changed objective'});assert.equal(conflict.status,409);
  const other=await submit('/api/execution/run',{task:'Verify one control plane'},'same-request','b');assert.equal(other.status,202);assert.notEqual(other.body.mission_id,id);
  const exact=await submit('/api/tools/execute',{tool_name:'scan_for_security_issues',arguments:{output:'test text'}},'exact-tool');assert.equal(exact.status,202);assert.equal(exact.body.constraints.plan[0].subtasks[0].tool_request.name,'scan_for_security_issues');
  await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));
  server=makeApp().listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const persisted=await (await fetch(origin()+'/api/autonomy/runs/'+id)).json();assert.equal(persisted.run.id,id);assert.equal(persisted.run.status,'queued');
  const denied=await fetch(origin()+'/api/autonomy/runs/'+id,{headers:{'x-test-tenant':'b'}});assert.equal(denied.status,404);
 }finally{
  if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
  if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
  await new Promise<void>(r=>server.close(()=>r()));await new Promise<void>(r=>db.close(()=>r()));
 }
});

test('legacy imports share canonical agents and never fabricate repairs or measured success',async()=>{
 const core=await import('../microfixd/core/agents/registry');const legacy=await import('../microfixd/backend/core/agents/registry');assert.equal(core.agentRegistry,legacy.agentRegistry);
 const repair=await import('../microfixd/core/agents/repair');const alias=await import('../microfyxd/core/agents/repair');assert.equal(repair.RepairAgent,alias.RepairAgent);
 for(const agent of Object.values(core.agentRegistry))await assert.rejects(()=>agent.execute({}),/DURABLE_MISSION/);
 await assert.rejects(()=>repair.executeRepairTool('run_tests',{}),/NOT_IMPLEMENTED/);
 const {missionEngine}=await import('../microfixd/backend/core/mission/engine');assert.equal(missionEngine.getCurrentMission(),null);
 const {execute}=await import('../server/execution/executionSpine');await assert.rejects(()=>execute({} as any),/RETIRED/);
 assert.equal(routePermission('/api/skin/receive','POST','read'),'execute');
});

test('legacy mission facade only mirrors committed server state',async()=>{
 const {MissionStateMachine}=await import('../microfixd/core/autonomy/missionStateMachine');const facade=new MissionStateMachine();
 const saved:Mission={mission_id:'persisted',tenant_id:'a',created_by:'u',created_at:new Date().toISOString(),objective:'work',constraints:{},status:'queued',result_artifact_id:null};let calls=0;
 facade.setTransport({submit:async(_objective,key)=>{calls++;assert.equal(key,'retry-key');return saved;},list:async()=>[{...saved,status:'succeeded'}]});
 facade.start();assert.deepEqual(facade.getMissions(),[]);
 assert.equal((await facade.createMission('work',[],'retry-key')).id,'persisted');assert.equal(calls,1);
 assert.equal((await facade.refresh())[0].state,'completed');
 facade.setTransport({submit:async()=>{throw new Error('storage failed');},list:async()=>[]});
 await assert.rejects(()=>facade.createMission('failed',[]),/storage failed/);assert.equal(facade.getMissions().length,1);
});


test('non-durable tool and command runners cannot execute tasks or fabricate scheduled jobs',async()=>{
 const {orchestrateWithTools}=await import('../server/tools/toolOrchestrator');await assert.rejects(()=>orchestrateWithTools('do work'),/RETIRED/);
 const {runCommand}=await import('../server/orchestration/commandCenter');await assert.rejects(()=>runCommand({task:'do work'} as any),/TASKS_REQUIRE_DURABLE_PLANNER/);
 const {executeSchedulerOrgan}=await import('../server/organs/organs/schedulerOrgan');assert.equal((await executeSchedulerOrgan('status',{}) as any).running,false);await assert.rejects(()=>executeSchedulerOrgan('trigger_job',{job_id:'health_check'}),/NOT_CONFIGURED/);
});


test('browser autonomy import starts no timers and cannot simulate a completed deployment',async()=>{
 const old=setInterval;let timers=0;
 globalThis.setInterval=((...args:any[])=>{timers++;return (old as any)(...args);}) as any;
 try{const {autonomousCore}=await import('../src/autonomy/autonomousCore');assert.equal(timers,0);assert.equal(autonomousCore.getFallbackAlert().active,false);await assert.rejects(()=>autonomousCore.triggerAutoDeployment(),/NOT_CONFIGURED/);await assert.rejects(()=>autonomousCore.triggerSelfRepairOrgan(),/NOT_CONFIGURED/);}
 finally{globalThis.setInterval=old;}
 const {autonomyRuntime}=await import('../src/autonomy/Organism');await assert.rejects(()=>autonomyRuntime.executeDAG({steps:[{name:'pretend'}]},'test'),/RETIRED/);
});
