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
