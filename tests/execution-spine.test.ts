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
