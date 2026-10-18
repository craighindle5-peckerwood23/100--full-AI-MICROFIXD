import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routePermission} from '../server/security/routePermission';
import {auditMission} from '../server/planner/missionAudit';
import {deadlineExceeded,contentHash,type Mission,type Task,type Subtask,type Artifact} from '../server/planner/executionSpine';
const mission:Mission={mission_id:'m',tenant_id:'t',created_at:new Date().toISOString(),created_by:'u',objective:'verified work',constraints:{},status:'succeeded',result_artifact_id:'final'};
function fixture(){
 const task:Task={task_id:'task',mission_id:'m',tenant_id:'t',agent_id:null,tool_permissions:[],input_context:{},expected_output_schema:{type:'object'},status:'succeeded',attempts:1};
 const sub:Subtask={subtask_id:'sub',task_id:'task',tenant_id:'t',agent_id:null,tool_request:null,input:{},status:'succeeded',attempts:1,raw_output:{ok:true},normalized_output:{ok:true}};
 const evidence={policy_version:'v1',constraints_hash:contentHash(mission.constraints),objective_hash:contentHash(mission.objective)};
 const source:Artifact={artifact_id:'source',mission_id:'m',tenant_id:'t',task_id:'task',subtask_id:'sub',type:'json',content:{ok:true},evidence,hash:contentHash({ok:true})};
 const final:Artifact={artifact_id:'final',mission_id:'m',tenant_id:'t',task_id:null,subtask_id:null,type:'mission_result',content:{outputs:[{artifact_id:'source',content:{ok:true}}],canonical_artifacts:['source']},evidence:{...evidence,provenance:[{artifact_id:'source',task_id:'task',subtask_id:'sub',content_hash:source.hash,evidence_hash:contentHash(evidence)}]},hash:contentHash({outputs:[{artifact_id:'source',content:{ok:true}}],canonical_artifacts:['source']})};
 return {tasks:[task],subs:[sub],artifacts:[source,final]};
}
test('execution writes require execute permission while reads allow monitoring',()=>{
 for(const base of ['/api/execution','/api/planner'])for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(routePermission(base+'/missions',method,'monitor'),'execute');
 assert.equal(routePermission('/api/execution/missions','GET','monitor'),'monitor');assert.equal(routePermission('/api/hitl/decide','POST','monitor'),'approve');
});
test('complete mission audit verifies evidence lineage',()=>{const f=fixture();assert.equal(auditMission(mission,f.tasks,f.subs,f.artifacts).verified,true);});
test('audit detects content tampering, scope violations and missing outputs',()=>{
 const f=fixture();f.artifacts[0].content={ok:false};f.artifacts[0].tenant_id='other';f.subs.push({...f.subs[0],subtask_id:'lost'});
 const codes=auditMission(mission,f.tasks,f.subs,f.artifacts).issues.map(i=>i.code);
 assert.ok(codes.includes('CONTENT_HASH_MISMATCH'));assert.ok(codes.includes('ARTIFACT_SCOPE_MISMATCH'));assert.ok(codes.includes('SUCCEEDED_SUBTASK_MISSING_ARTIFACT'));
});
test('audit detects modified evidence and changed mission constraints',()=>{
 const f=fixture();f.artifacts[0].evidence={...f.artifacts[0].evidence,confidence:1};
 assert.ok(auditMission(mission,f.tasks,f.subs,f.artifacts).issues.some(i=>i.code==='PROVENANCE_LINK_MISMATCH'));
 assert.ok(auditMission({...mission,constraints:{max_tokens:99}},f.tasks,f.subs,f.artifacts).issues.some(i=>i.code==='POLICY_PROVENANCE_MISSING_OR_CHANGED'));
});
test('deadline handles expiry and fails closed for invalid persisted values',()=>{
 assert.equal(deadlineExceeded(mission),false);assert.equal(deadlineExceeded({...mission,constraints:{deadline_at:'invalid'}}),true);
 assert.equal(deadlineExceeded({...mission,constraints:{deadline_at:'2026-01-01T00:00:00Z'}},Date.parse('2026-01-01T00:00:00Z')),true);
 assert.equal(deadlineExceeded({...mission,constraints:{deadline_at:'2026-01-01T00:00:00Z'}},Date.parse('2025-01-01T00:00:00Z')),false);
});

test('audit rejects a final answer disconnected from verified source outputs',()=>{
 const f=fixture();f.artifacts[1].content={outputs:[],canonical_artifacts:[]};f.artifacts[1].hash=contentHash(f.artifacts[1].content);
 const issues=auditMission(mission,f.tasks,f.subs,f.artifacts).issues;
 assert.ok(issues.some(i=>i.code==='FINAL_OUTPUT_LINK_MISMATCH'));assert.ok(issues.some(i=>i.code==='CANONICAL_TASK_LINK_MISMATCH'));
});


test('every advertised durable tool resolves to a concrete executor and schema',async()=>{
 const {ENABLED_TOOLS}=await import('../server/planner/governedTools');
 const {getTool}=await import('../server/tools/toolRegistry');
 const {EXECUTORS}=await import('../server/organs/executors');
 for(const name of ENABLED_TOOLS){const tool=getTool(name);assert.ok(tool,name);assert.ok(tool.organ==='system_catalog'||typeof EXECUTORS[tool.organ]==='function',name);assert.equal(tool.parameters.type,'object');}
});

test('durable public reader validates URLs through the real adapter',async()=>{
 const {getExecutor}=await import('../server/organs/executors');
 await assert.rejects(()=>getExecutor('crawl_engine')('read_public_page',{url:'file:///etc/passwd'}));
});


test('organ invocation rejects missing adapters and dedicated paths and pins tenant identity',async()=>{
 const {organInvocationPayload,systemCapabilities}=await import('../server/planner/governedTools');
 assert.throws(()=>organInvocationPayload({organ_id:'missing',payload_json:'{}'},'t','m'),/UNSUPPORTED_ORGAN_CAPABILITY/);
 for(const organ_id of ['playwright','crawl_engine','github_connector'])assert.throws(()=>organInvocationPayload({organ_id,payload_json:'{}'},'t','m'),/USE_DEDICATED_GOVERNED_TOOL/);
 assert.deepEqual(organInvocationPayload({organ_id:'memory',payload_json:'{"tenant_id":"other","session_id":"other","content":"test"}'},'t','m'),{tenant_id:'t',session_id:'t:m',content:'test'});
 assert.ok(systemCapabilities().organs.every(o=>o.execution_endpoint&&typeof o.native_executor==='boolean'));
});


test('public marketing endpoints expose canonical sitemap without exposing private API routes',async()=>{
 const {default:express}=await import('express');
 const {marketingRouter}=await import('../server/marketing/seo');
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'microfixd-seo-'));
 await writeFile(join(dir,'index.html'),'<html><head><title>Old</title></head><body><div id="root"></div></body></html>');
 const app=express();app.use(marketingRouter(dir));const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{const robots=await (await fetch(base+'/robots.txt')).text();assert.ok(robots.includes('Disallow: /api/'));assert.ok(robots.includes('Allow: /saas'));
 const sitemap=await (await fetch(base+'/sitemap.xml')).text();assert.ok(sitemap.includes('/saas</loc>'));
 const landing=await (await fetch(base+'/saas')).text();assert.ok(landing.includes('rel="canonical"'));assert.ok(landing.includes('Governed AI workspace'));assert.ok(landing.includes('<noscript>'));
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));await rm(dir,{recursive:true,force:true});}
});

test('standing owner authorization records exact receipts, preserves rejection, and isolates memory payloads',async()=>{
 const {createGovernedTools,requestHash}=await import('../server/planner/governedTools');
 const {EXECUTORS}=await import('../server/organs/executors');
 const receipts=new Map<string,any>(),runs=new Map<string,any>();let payload:any,calls=0;
 const client:any={from(table:string){const filters:any={};const q:any={select(){return q;},eq(k:string,v:string){filters[k]=v;return q;},async maybeSingle(){return {data:runs.get(filters.subtask_id)??null,error:null};},async upsert(row:any){if(!receipts.has(row.subtask_id))receipts.set(row.subtask_id,row);return {error:null};}};return q;},async rpc(name:string,p:any){
  if(name==='spine_start_tool'){const receipt=receipts.get(p.p_subtask);if(p.p_protected&&receipt?.status!=='approved')return {data:false};runs.set(p.p_subtask,{request_hash:p.p_hash,status:'running'});return {data:true};}
  if(name==='spine_finish_tool'){runs.set(p.p_subtask,{request_hash:p.p_hash,status:'succeeded',result:p.p_result});return {data:true};}throw new Error(name);
 }};
 const original=EXECUTORS.memory;EXECUTORS.memory=async(_action,p)=>{calls++;payload=p;return {stored:true};};
 const context:any={tenant_id:'tenant-a',mission_id:'mission-a',subtask_id:'store',tool_permissions:['store_memory'],constraints:{tool_approval_mode:'preauthorized',approval_actor:'owner-id'},idempotency_key:'one'};
 const request={name:'store_memory',arguments:{content:'test memory',tags:'one, two'}};
 const runner=createGovernedTools(client,'tenant-a','mission-a','worker');
 try{
  await runner.executeTool(request,context);assert.equal(receipts.get('store').status,'approved');assert.equal(receipts.get('store').decided_by,'owner-id');assert.equal(receipts.get('store').request_hash,requestHash(request));
  assert.equal(payload.session_id,'tenant-a:tools');assert.equal(payload.tenant_id,'tenant-a');assert.deepEqual(payload.tags,['one','two']);
  await runner.executeTool(request,context);assert.equal(calls,1);
  await assert.rejects(()=>runner.executeTool(request,{...context,tenant_id:'tenant-b'}),/TENANT_MISMATCH/);
  await assert.rejects(()=>runner.executeTool(request,{...context,subtask_id:'manual',constraints:{tool_approval_mode:'manual'}}),/WAITING_APPROVAL/);
  receipts.set('rejected',{status:'rejected'});await assert.rejects(()=>runner.executeTool(request,{...context,subtask_id:'rejected'}),/WAITING_APPROVAL/);assert.equal(receipts.get('rejected').status,'rejected');
  await runner.executeTool({name:'list_system_capabilities',arguments:{}},{...context,subtask_id:'catalog',tool_permissions:['list_system_capabilities'],constraints:{tool_approval_mode:'manual'}});assert.equal(receipts.get('catalog').status,'approved');
 }finally{EXECUTORS.memory=original;}
});

test('browser catalog supplies required page URLs and denied origins cannot launch tools',async()=>{
 const {getTool}=await import('../server/tools/toolRegistry');const {createGovernedTools}=await import('../server/planner/governedTools');
 for(const name of ['take_screenshot','click_element']){const tool=getTool(name)!;assert.equal(tool.parameters.properties.url.type,'string');assert.ok(tool.parameters.required.includes('url'));}
 const runner=createGovernedTools({} as any,'t','m','worker');
 for(const url of ['https://other.example/page','http://example.org','https://127.0.0.1'])await assert.rejects(()=>runner.executeTool({name:'take_screenshot',arguments:{url}},{tenant_id:'t',mission_id:'m',subtask_id:'s',tool_permissions:['take_screenshot'],constraints:{browser_origins:['https://example.org']}} as any));
});

test('emergency tool engages the actual local oversight flag and reports its scope',async()=>{
 const {executeWorldModelOrgan}=await import('../server/organs/organs/worldModelOrgan');const {orchestrationOversight}=await import('../server/orchestration/orchestrationOversight');
 try{const result:any=await executeWorldModelOrgan('emergency_kill',{reason:'regression'});assert.equal(result.engaged,true);assert.equal(result.scope,'local_oversight_registry');assert.equal(orchestrationOversight.verifyDelegation('test','work').allowed,false);}
 finally{orchestrationOversight.resetEmergencyKill();}
});
