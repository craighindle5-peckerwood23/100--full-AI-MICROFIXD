import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AgentBus, DatabaseRepositories, PlannerService, type Database, type Mission, type Row, type Table } from '../server/planner/executionSpine';
function fixture() {
  const rows = new Map<string, Row>();
  const db: Database = {
    async insertIfAbsent(table, id, row) { if (!rows.has(`${table}:${id}`)) rows.set(`${table}:${id}`, structuredClone(row)); },
    async get<T extends Row>(table: Table, id: string, tenant: string): Promise<T> { const r = rows.get(`${table}:${id}`); if (!r || r.tenant_id !== tenant) throw Error('NOT_FOUND'); return structuredClone(r) as T; },
    async list<T extends Row>(table: Table, filters: Record<string,string>, tenant: string): Promise<T[]> { return [...rows.entries()].filter(([k,r]) => k.startsWith(`${table}:`) && r.tenant_id === tenant && Object.entries(filters).every(([k,v]) => r[k] === v)).map(([,r]) => structuredClone(r) as T); },
    async patch(table,id,changes,tenant) { const r = await db.get(table,id,tenant); rows.set(`${table}:${id}`, {...r,...changes} as Row); },
    async increment(table,id,field,tenant) { const r = await db.get(table,id,tenant); await db.patch(table,id,{[field]: Number(r[field])+1},tenant); }
  };
  const repository = new DatabaseRepositories(db,'a');
  const mission: Mission = {mission_id:randomUUID(),tenant_id:'a',created_at:new Date().toISOString(),created_by:'operator',objective:' test ',constraints:{tool_permissions:['read']},status:'queued',result_artifact_id:null};
  let calls = 0;
  const deps = {
    repository,
    async transaction<T>(work:(r:DatabaseRepositories)=>Promise<T>) { const before = structuredClone(rows); try { return await work(repository); } catch(e) { rows.clear(); for (const [k,v] of before) rows.set(k,v); throw e; } },
    async withMissionLock<T>(_t:string,_m:string,work:()=>Promise<T>) { return work(); },
    async plan() { return [{agent_id:null,tool_permissions:['read'],input_context:{},expected_output_schema:{type:'object'},subtasks:[{agent_id:null,tool_request:{name:'read'},input:{}}]}]; },
    async executeTool() { calls++; return {raw:{ok:true},normalized:{ok:true},evidence:{source:'test',confidence:0.9}}; },
    async invokeAgent() { throw Error('UNEXPECTED'); },
    validate:(v:unknown)=>!!v && typeof v === 'object',
    async recordError() {}, retryable:()=>true,
    budget:{max_attempts:2,backoff_ms:0,max_subtasks:2}, async sleep() {}
  };
  return {deps,mission,repository,db,calls:()=>calls};
}
test('durable result is reused without another tool or synthesis call',async()=>{
  const f=fixture(); const p=new PlannerService(f.deps);
  const result=await p.planAndExecuteMission(f.mission); assert.equal(result.status,'succeeded'); assert.ok(result.result_artifact_id);
  await new PlannerService(f.deps).planAndExecuteMission(f.mission); assert.equal(f.calls(),1);
});
test('procedure persistence retries before finalization without repeating a completed tool',async()=>{
 const f=fixture();let attempts=0;
 const planner=new PlannerService({...f.deps,rememberCompletion:async(m,tasks,artifacts,final)=>{
  attempts++;assert.equal(m.tenant_id,'a');assert.ok(tasks.every(t=>t.status==='succeeded'));
  assert.ok(artifacts.some(a=>a.subtask_id));assert.equal(final.type,'mission_result');
  if(attempts===1)throw Error('knowledge database unavailable');
 }});
 await assert.rejects(()=>planner.planAndExecuteMission(f.mission),/knowledge database unavailable/);
 assert.notEqual((await f.repository.getMission(f.mission.mission_id)).status,'succeeded');
 assert.equal((await planner.planAndExecuteMission(f.mission)).status,'succeeded');assert.equal(f.calls(),1);assert.equal(attempts,2);
});
test('blocked work is never supplied to procedure learning',async()=>{
 const f=fixture();let learned=false;f.deps.executeTool=async()=>{throw Error('failed tool');};
 const result=await new PlannerService({...f.deps,rememberCompletion:async()=>{learned=true;}}).planAndExecuteMission(f.mission);
 assert.equal(result.status,'waiting');assert.equal(learned,false);
});
test('bounded failures block task and wait for human recovery',async()=>{
  const f=fixture(); let attempts=0; f.deps.executeTool=async()=>{attempts++;throw Error('quota');};
  assert.equal((await new PlannerService(f.deps).planAndExecuteMission(f.mission)).status,'waiting');
  assert.equal(attempts,2); const tasks=await f.repository.getTasks(f.mission.mission_id); assert.equal(tasks[0].status,'blocked');
  assert.equal((await f.repository.getSubtasks(tasks[0].task_id))[0].attempts,2);
});
test('tenant-scoped bus includes broadcasts and excludes other recipients',async()=>{
  const f=fixture(); const bus=new AgentBus(f.repository,'a'); const agent=randomUUID();
  for(const to of [null,agent,randomUUID()]) await bus.publishMessage({message_id:randomUUID(),tenant_id:'a',from_agent:randomUUID(),to_agent:to,mission_id:f.mission.mission_id,content:'hi',artifacts:[],confidence:1,created_at:new Date().toISOString()});
  assert.equal((await bus.getMessagesForAgent(agent,f.mission.mission_id)).length,2);
  await assert.rejects(new DatabaseRepositories(f.db,'b').getMission(f.mission.mission_id));
});
test('approval pauses and resumes the same subtask without duplicating tasks',async()=>{
 const f=fixture();let approved=false;
 const real=f.deps.executeTool;
 f.deps.executeTool=async()=>{if(!approved)throw Object.assign(Error('approval'),{code:'WAITING_APPROVAL'});return real();};
 const planner=new PlannerService(f.deps);
 assert.equal((await planner.planAndExecuteMission(f.mission)).status,'waiting');
 const task=(await f.repository.getTasks(f.mission.mission_id))[0];const sub=(await f.repository.getSubtasks(task.task_id))[0];
 assert.equal(sub.status,'waiting_input');assert.equal(f.calls(),0);
 approved=true;
 await f.repository.updateSubtaskStatus(sub.subtask_id,'queued');await f.repository.updateTaskStatus(task.task_id,'queued');await f.repository.updateMissionStatus(f.mission.mission_id,'queued');
 assert.equal((await new PlannerService(f.deps).planAndExecuteMission(f.mission)).status,'succeeded');assert.equal(f.calls(),1);assert.equal((await f.repository.getTasks(f.mission.mission_id)).length,1);
});
test('restart recovery reuses a completed tool ledger result without repeating the action',async()=>{
 const f=fixture();let commitFailed=true;
 const transaction=f.deps.transaction;
 f.deps.transaction=async work=>transaction(async r=>{const original=r.setSubtaskOutputs.bind(r);r.setSubtaskOutputs=async(...args)=>{if(commitFailed){commitFailed=false;throw Error('worker terminated before commit');}return original(...args);};try{return await work(r);}finally{r.setSubtaskOutputs=original;}});
 let cached:any;
 const execute=f.deps.executeTool;f.deps.executeTool=async()=>{cached=await execute();return cached;};
 await assert.rejects(new PlannerService(f.deps).planAndExecuteMission(f.mission));
 const recovered=new PlannerService({...f.deps,recoverTool:async()=>cached});
 assert.equal((await recovered.planAndExecuteMission(f.mission)).status,'succeeded');assert.equal(f.calls(),1);
});
test('unknown external outcome pauses for reconciliation instead of replay',async()=>{
 const f=fixture();f.deps.executeTool=async()=>{throw Object.assign(Error('unknown outcome'),{code:'RECONCILIATION_REQUIRED'});};
 assert.equal((await new PlannerService(f.deps).planAndExecuteMission(f.mission)).status,'waiting');
 const task=(await f.repository.getTasks(f.mission.mission_id))[0];assert.equal((await f.repository.getSubtasks(task.task_id))[0].status,'waiting_input');
});
test('approval waits do not consume the execution retry budget',async()=>{
 const f=fixture();f.deps.executeTool=async()=>{throw Object.assign(Error('approval'),{code:'WAITING_APPROVAL'});};
 await new PlannerService(f.deps).planAndExecuteMission(f.mission);
 const task=(await f.repository.getTasks(f.mission.mission_id))[0];assert.equal((await f.repository.getSubtasks(task.task_id))[0].attempts,0);
});
test('token exhaustion pauses without retrying the provider',async()=>{
 const f=fixture();let calls=0;f.deps.executeTool=async()=>{calls++;throw Object.assign(Error('budget'),{code:'TOKEN_BUDGET_EXHAUSTED'});};
 assert.equal((await new PlannerService(f.deps).planAndExecuteMission(f.mission)).status,'waiting');assert.equal(calls,1);
});
test('invalid normalized output never becomes an artifact or a success',async()=>{
 const f=fixture();f.deps.validate=()=>false;
 assert.equal((await new PlannerService(f.deps).planAndExecuteMission(f.mission)).status,'waiting');assert.equal((await f.repository.getArtifacts(f.mission.mission_id)).length,0);
});
test('agent output recovery does not invoke another model',async()=>{
 const f=fixture();const planned=await f.deps.plan();planned[0].subtasks[0].tool_request=null as any;f.deps.plan=async()=>planned;
 const p=new PlannerService({...f.deps,recoverAgent:async()=>({raw:{ok:true},normalized:{ok:true},evidence:{provider:'persisted'}})});
 assert.equal((await p.planAndExecuteMission(f.mission)).status,'succeeded');assert.equal(f.calls(),0);
});

 test('final result records policy fingerprints and source evidence hashes',async()=>{
 const f=fixture();await new PlannerService(f.deps).planAndExecuteMission(f.mission);
 const artifacts=await f.repository.getArtifacts(f.mission.mission_id);
 const final=artifacts.find(a=>a.type==='mission_result')!;
 assert.equal(final.evidence.policy_version,'spine-2026-10-09.1');
 assert.match(String(final.evidence.constraints_hash),/^[a-f0-9]{64}$/);
 const provenance=final.evidence.provenance as any[];
 assert.equal(provenance.length,1);assert.equal(provenance[0].artifact_id,artifacts.find(a=>a.subtask_id)!.artifact_id);
 assert.match(provenance[0].evidence_hash,/^[a-f0-9]{64}$/);
 });
 test('restart cannot finalize a succeeded subtask whose artifact was lost',async()=>{
 const f=fixture();const plan=await f.deps.plan();plan[0].subtasks.push({...plan[0].subtasks[0]});f.deps.plan=async()=>plan;
 const original=f.deps.executeTool;let calls=0;
 f.deps.executeTool=async()=>{if(++calls>=2)throw Error('crash');return original();};
 await new PlannerService(f.deps).planAndExecuteMission(f.mission);
 const task=(await f.repository.getTasks(f.mission.mission_id))[0];
 const subs=await f.repository.getSubtasks(task.task_id);
 // Simulate durable state corruption: a success checkpoint without its evidence.
 for(const sub of subs)await f.repository.updateSubtaskStatus(sub.subtask_id,'succeeded');
 await f.repository.updateTaskStatus(task.task_id,'queued');await f.repository.updateMissionStatus(f.mission.mission_id,'queued');
 assert.equal((await new PlannerService(f.deps).planAndExecuteMission(f.mission)).status,'waiting');
 assert.equal((await f.repository.getMission(f.mission.mission_id)).result_artifact_id,null);
 });

test('expired mission performs no planning or external effects',async()=>{
 const f=fixture();f.mission.constraints.deadline_at='2000-01-01T00:00:00Z';
 f.deps.plan=async()=>{throw Error('must not plan');};
 assert.equal((await new PlannerService(f.deps).planAndExecuteMission(f.mission)).status,'waiting');assert.equal(f.calls(),0);
});


test('planning failure is recorded before terminal state and executes no tools',async()=>{
 const f=fixture();const events:string[]=[];
 f.deps.plan=async()=>{throw new Error('INVALID_PLAN_JSON');};
 const planner=new PlannerService({...f.deps,recordPlanningError:async(m,error)=>{assert.equal(m.tenant_id,'a');events.push((error as Error).message);}});
 assert.equal((await planner.planAndExecuteMission(f.mission)).status,'failed');
 assert.deepEqual(events,['INVALID_PLAN_JSON']);assert.equal(f.calls(),0);
 assert.equal((await f.repository.getTasks(f.mission.mission_id)).length,0);
});

test('objective review continues after discovery without replaying completed effects',async()=>{
 const f=fixture();let reviews=0;
 f.deps.budget.max_subtasks=4;
 const planner=new PlannerService({...f.deps,reviewCompletion:async(_m,_tasks,artifacts)=>{
  reviews++;
  if(reviews===1){const next=await f.deps.plan();next[0].subtasks[0].input={step:'fulfil remaining requirement'};
   return {status:'continue',reason:'Discovery did not fulfil the requested output',evidence_artifact_ids:artifacts.map(a=>a.artifact_id),next_tasks:next,method:'model_review'};}
  return {status:'complete',reason:'Both required outputs are present',evidence_artifact_ids:artifacts.map(a=>a.artifact_id),next_tasks:[],method:'model_review'};
 }});
 const result=await planner.planAndExecuteMission(f.mission);assert.equal(result.status,'succeeded');assert.equal(f.calls(),2);assert.equal(reviews,2);
 const final=(await f.repository.getArtifacts(f.mission.mission_id)).find(a=>a.type==='mission_result')!;
 assert.equal((final.evidence.completion_review as any).status,'complete');
 assert.equal((await f.repository.getTasks(f.mission.mission_id)).length,2);
 await new PlannerService(f.deps).planAndExecuteMission(f.mission);assert.equal(f.calls(),2);
});

test('blocked, malformed and cross-mission completion claims never finalize success',async()=>{
 for(const kind of ['blocked','foreign','missing-reviewer']){
  const f=fixture();f.mission.constraints.completion_policy='objective-v1';
  const review:any={status:kind==='blocked'?'blocked':'complete',reason:'Unmet original objective',evidence_artifact_ids:kind==='foreign'?['foreign-artifact']:[],next_tasks:[],method:'model_review'};
  const deps=kind==='missing-reviewer'?f.deps:{...f.deps,reviewCompletion:async()=>review};
  assert.equal((await new PlannerService(deps).planAndExecuteMission(f.mission)).status,'waiting');
  assert.equal((await f.repository.getMission(f.mission.mission_id)).result_artifact_id,null);assert.equal(f.calls(),1);
 }
});

test('identical continuation and permission expansion are blocked before new effects',async()=>{
 for(const expand of [false,true]){
  const f=fixture();f.deps.budget.max_subtasks=4;
  const planner=new PlannerService({...f.deps,reviewCompletion:async(_m,_t,artifacts)=>{
   const next=await f.deps.plan();if(expand){next[0].tool_permissions=['write'];next[0].subtasks[0].input={new:true};}
   return {status:'continue',reason:'Another action requested',evidence_artifact_ids:artifacts.map(a=>a.artifact_id),next_tasks:next,method:'model_review'};
  }});
  assert.equal((await planner.planAndExecuteMission(f.mission)).status,'waiting');assert.equal(f.calls(),1);
  assert.equal((await f.repository.getTasks(f.mission.mission_id)).length,1);
 }
});

test('continuation count is durable and bounded even across operator resumes',async()=>{
 const f=fixture();let reviews=0;f.deps.budget.max_subtasks=8;
 const deps={...f.deps,reviewCompletion:async(_m,_t,artifacts)=>{
  const next=await f.deps.plan();next[0].subtasks[0].input={round:++reviews};
  return {status:'continue' as const,reason:'Work remains',evidence_artifact_ids:artifacts.map(a=>a.artifact_id),next_tasks:next,method:'model_review' as const};
 }};
 assert.equal((await new PlannerService(deps).planAndExecuteMission(f.mission)).status,'waiting');assert.equal(f.calls(),3);assert.equal(reviews,3);
 await f.repository.updateMissionStatus(f.mission.mission_id,'queued');
 assert.equal((await new PlannerService(deps).planAndExecuteMission(f.mission)).status,'waiting');assert.equal(f.calls(),3);assert.equal(reviews,3);
});

test('restart reuses completion checkpoint after final commit fails',async()=>{
 const f=fixture();let reviews=0,fail=true;
 const transaction=f.deps.transaction;
 f.deps.transaction=async work=>transaction(async r=>{
  const attach=r.attachResultArtifact.bind(r);r.attachResultArtifact=async(...args)=>{if(fail){fail=false;throw Error('final commit interrupted');}return attach(...args);};
  try{return await work(r);}finally{r.attachResultArtifact=attach;}
 });
 const deps={...f.deps,reviewCompletion:async(_m,_t,artifacts)=>{reviews++;return {status:'complete' as const,reason:'Evidence meets objective',evidence_artifact_ids:artifacts.map(a=>a.artifact_id),next_tasks:[],method:'model_review' as const};}};
 await assert.rejects(new PlannerService(deps).planAndExecuteMission(f.mission),/interrupted/);
 assert.equal((await new PlannerService(deps).planAndExecuteMission(f.mission)).status,'succeeded');assert.equal(reviews,1);assert.equal(f.calls(),1);
});

test('provider failure during completion review preserves completed work for recovery',async()=>{
 const f=fixture();let reviews=0;
 const deps={...f.deps,reviewCompletion:async(_m,_t,artifacts)=>{if(++reviews===1)throw Object.assign(new Error('PROVIDERS_EXHAUSTED'),{code:'PROVIDERS_EXHAUSTED'});return {status:'complete' as const,reason:'Evidence meets objective',evidence_artifact_ids:artifacts.map(a=>a.artifact_id),next_tasks:[],method:'model_review' as const};}};
 assert.equal((await new PlannerService(deps).planAndExecuteMission(f.mission)).status,'waiting');assert.equal(f.calls(),1);
 await f.repository.updateMissionStatus(f.mission.mission_id,'queued');
 assert.equal((await new PlannerService(deps).planAndExecuteMission(f.mission)).status,'succeeded');assert.equal(f.calls(),1);
});

test('mission audit rejects a completion claim detached from the current evidence snapshot',async()=>{
 const {auditMission}=await import('../server/planner/missionAudit');
 const f=fixture();f.mission.constraints.completion_policy='objective-v1';
 const deps={...f.deps,reviewCompletion:async(_m,_t,artifacts)=>({status:'complete' as const,reason:'Evidence meets objective',evidence_artifact_ids:artifacts.map(a=>a.artifact_id),next_tasks:[],method:'model_review' as const})};
 const m=await new PlannerService(deps).planAndExecuteMission(f.mission),tasks=await f.repository.getTasks(m.mission_id);
 const subs=(await Promise.all(tasks.map(t=>f.repository.getSubtasks(t.task_id)))).flat(),artifacts=await f.repository.getArtifacts(m.mission_id);
 assert.equal(auditMission(m,tasks,subs,artifacts).verified,true);
 const final=artifacts.find(a=>a.type==='mission_result')!;delete final.evidence.completion_review;
 assert.ok(auditMission(m,tasks,subs,artifacts).issues.some(i=>i.code==='OBJECTIVE_REVIEW_MISSING_OR_INVALID'));
});
