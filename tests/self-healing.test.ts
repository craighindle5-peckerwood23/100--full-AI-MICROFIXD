import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {rollbackRepair} from '../server/engineering/sourceRepair';
import {repairSource} from '../server/engineering/sourceRepair';
import {healingMissionRequest} from '../server/engineering/healingStatus';
import {sourceIncident} from '../server/engineering/repairIncidents';
import {learningRouter} from '../server/routes/learningRoutes';

const base='a'.repeat(40),candidate='b'.repeat(40),tree='c'.repeat(40),restored='d'.repeat(40);
test('rollback restores the baseline tree with a forward-only commit and records actual readiness',async()=>{
 const writes:any[]=[],phases:string[]=[];let checks=0,healthReads=0;
 const api=async(path:string,method='GET',body?:any)=>{
  if(path==='git/ref/heads/main'){checks++;return {object:{sha:candidate}};}
  writes.push({path,method,body});
  if(path==='git/commits'){assert.equal(body.tree,tree);assert.deepEqual(body.parents,[candidate]);return {sha:restored};}
  assert.deepEqual(body,{sha:restored,force:false});return {};
 };
 const result=await rollbackRepair(base,candidate,tree,api,async()=>{},async phase=>{phases.push(phase);},async()=>{
  healthReads++;return {status:'ok',commit:healthReads===1?candidate:restored,storage:{durable:true}};
 },async()=>{});
 assert.equal(result,restored);assert.equal(checks,2);assert.equal(healthReads,2);
 assert.equal(writes.length,2);assert.deepEqual(phases,['rollback_created','rollback_promoted','rollback_verified']);
});

test('rollback cannot overwrite a competing release or continue after authorization is revoked',async()=>{
 let writes=0,checks=0;
 const api=async(path:string)=>{if(path==='git/ref/heads/main')return {object:{sha:++checks===1?candidate:'e'.repeat(40)}};writes++;return {sha:restored};};
 await assert.rejects(()=>rollbackRepair(base,candidate,tree,api,async()=>{},async()=>{},async()=>null,async()=>{}),/ROLLBACK_CONFLICT/);
 assert.equal(writes,1,'a proposed commit may exist, but main was never moved');
 await assert.rejects(()=>rollbackRepair(base,candidate,tree,api,async()=>{throw Error('REPAIR_LEASE_LOST');},async()=>{},async()=>null,async()=>{}),/LEASE_LOST/);
 assert.equal(writes,1);
});

test('a degraded or wrong rollback revision never becomes verified recovery',async()=>{
 const phases:string[]=[];
 const api=async(path:string)=>path==='git/ref/heads/main'?{object:{sha:candidate}}:{sha:restored};
 await assert.rejects(()=>rollbackRepair(base,candidate,tree,api,async()=>{},async p=>{phases.push(p);},async()=>({status:'degraded',commit:restored,storage:{durable:true}}),async()=>{throw Error('STOP_TEST_AFTER_OBSERVATION');}),/STOP_TEST/);
 assert.ok(!phases.includes('rollback_verified'));
});

test('the repair controller rolls back three degraded candidate observations and never reports a healed result',async()=>{
 const saved=[process.env.GITHUB_TOKEN,process.env.MICROFIXD_REPAIR_RUNNER_URL];
 process.env.GITHUB_TOKEN='fixture';process.env.MICROFIXD_REPAIR_RUNNER_URL='https://fixture.onrender.com';
 let main=base,created=0,degraded=0;const phases:string[]=[];
 const db:any={from:()=>({insert:async(row:any)=>{phases.push(row.operation.phase);return {error:null};},upsert:async()=>({error:null})})};
 const fetcher:typeof fetch=async(input,options)=>{
  const url=String(input),body=options?.body?JSON.parse(String(options.body)):null;
  if(url.endsWith('git/ref/heads/main'))return Response.json({object:{sha:main}});
  if(url.endsWith('git/commits/'+base))return Response.json({tree:{sha:tree}});
  if(url.includes('/contents/'))return Response.json({type:'file',size:3,encoding:'base64',content:Buffer.from('old').toString('base64')});
  if(url.endsWith('git/ref/heads/repair/candidate'))return Response.json({}, {status:404});
  if(url.endsWith('/git/trees'))return Response.json({sha:tree});
  if(url.endsWith('/git/commits'))return Response.json({sha:++created===1?candidate:restored});
  if(url.endsWith('/git/refs'))return Response.json({});
  if(url.endsWith('/git/refs/heads/main')){assert.equal(body.force,false);main=body.sha;return Response.json({});}
  if(url.includes('fixture.onrender.com'))return Response.json({commit:candidate,status:'verified',experiment:{baseline:base,candidate,cases:2,repaired:['fixture'],regressions:0},network:'none',productionSecrets:false,gate:'production+engineering+adapters'});
  if(main===candidate)degraded++;
  return Response.json({status:main===candidate?'degraded':'ok',commit:main,storage:{durable:true}},{status:main===candidate?503:200});
 };
 try{
  await assert.rejects(()=>repairSource(db,{tenant:'default',mission:'m',subtask:'s'},'Repair fixture\nRegression case: tests/source-repair.test.ts#fixture',['server/automotive/example.ts'],async()=>({content:JSON.stringify({edits:[{path:'server/automotive/example.ts',old_text:'old',new_text:'new'}]})}),async()=>{},fetcher,async()=>{}),/REPAIR_ROLLED_BACK/);
  assert.equal(degraded,3);assert.equal(main,restored);assert.ok(phases.includes('rollback_verified'));assert.ok(!phases.includes('live_verified'));
 }finally{['GITHUB_TOKEN','MICROFIXD_REPAIR_RUNNER_URL'].forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});}
});

test('repair request construction is deterministic, bounded and preserves protected paths',()=>{
 const input={objective:'Repair observed fixture\nRegression case: tests/source-repair.test.ts#fixture',paths:['server/automotive/example.ts']};
 assert.deepEqual(healingMissionRequest(input),healingMissionRequest(input));
 for(const bad of [{...input,paths:['server/security/rbac.ts']},{...input,paths:[...input.paths,...input.paths]},{...input,objective:'Deploy a fake repair'},{...input,paths:[]}])assert.throws(()=>healingMissionRequest(bad));
 assert.deepEqual(healingMissionRequest(input).tool_permissions,['repair_source_code']);
});

test('incident deduplication permits the same fault to be investigated on a new revision',()=>{
 const saved=process.env.RENDER_GIT_COMMIT;
 const error=new ReferenceError('fixture is not defined');error.stack='at work (/opt/render/project/src/server/automotive/example.ts:12:1)';
 try{
  process.env.RENDER_GIT_COMMIT=base;const first=sourceIncident(error)!;
  assert.equal(first.fingerprint,sourceIncident(error)!.fingerprint);
  process.env.RENDER_GIT_COMMIT=candidate;assert.notEqual(first.fingerprint,sourceIncident(error)!.fingerprint);
  assert.ok(!first.objective.includes(error.message));
 }finally{if(saved===undefined)delete process.env.RENDER_GIT_COMMIT;else process.env.RENDER_GIT_COMMIT=saved;}
});

test('repair HTTP workflow enforces owner access, queues idempotently and reports durable evidence',async()=>{
 const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GITHUB_TOKEN','MICROFIXD_REPAIR_RUNNER_URL','MICROFIXD_REPAIR_OWNER_TENANT'];
 const saved=keys.map(k=>process.env[k]);
 let mission:any=null,events:any[]=[],storageFail=false;
 const app=express();app.use(express.json());
 app.post('/rest/v1/rpc/:name',(req,res)=>{
  assert.equal(req.body.p_tenant,'default');
  if(req.params.name==='spine_commit')for(const op of req.body.p_operations)if(op.kind==='missions'&&!mission)mission=op.data;
  res.json(req.params.name==='spine_lease'?true:null);
 });
 app.get('/rest/v1/:table',(req,res)=>{
  if(storageFail)return res.status(503).json({code:'503',message:'fixture unavailable'});
  const tenant=String(req.query.tenant_id).slice(3);let rows:any[]=[];
  if(req.params.table==='spine_rows'&&mission?.tenant_id===tenant)rows=[{data:mission}];
  if(req.params.table==='spine_events'&&tenant==='default')rows=events;
  if(req.params.table==='spine_errors')rows=[];
  if(req.headers.accept?.includes('vnd.pgrst.object'))return res.json(rows[0]??null);
  res.json(rows);
 });
 // Controlled identity fixture. Production identity comes from the unchanged RBAC middleware.
 app.use('/api/learning',(req:any,_res,next)=>{if(req.header('x-test-role')){req.microfixdRole=req.header('x-test-role');req.microfixdTenantId=req.header('x-test-tenant')||'default';}next();},learningRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${(server.address() as any).port}`;
 process.env.SUPABASE_URL=url;process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.GITHUB_TOKEN='fixture';process.env.MICROFIXD_REPAIR_RUNNER_URL='https://fixture.onrender.com';delete process.env.MICROFIXD_REPAIR_OWNER_TENANT;
 const body={objective:'Fix the observed fixture\nRegression case: tests/source-repair.test.ts#fixture',paths:['server/automotive/example.ts']};
 const post=(role:string,tenant='default',key='same-request',value=body)=>fetch(url+'/api/learning/self-healing/repair',{method:'POST',headers:{'content-type':'application/json','x-test-role':role,'x-test-tenant':tenant,...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(value)});
 const status=async(tenant='default')=>{const response=await fetch(url+'/api/learning/self-healing/status',{headers:{'x-test-role':'admin','x-test-tenant':tenant}});return {response,body:await response.json()};};
 try{
  assert.equal((await fetch(url+'/api/learning/self-healing/status')).status,403);
  assert.equal((await post('operator')).status,403);assert.equal((await post('admin','foreign')).status,403);
  assert.equal((await post('admin','default','')).status,400);
  assert.equal((await post('admin','default','invalid',{...body,paths:['server/security/rbac.ts']})).status,400);
  const first=await post('admin');assert.equal(first.status,202);const firstBody=await first.json();
  const retry=await post('admin');assert.equal(retry.status,202);assert.equal((await retry.json()).mission_id,firstBody.mission_id);
  let live=await status();assert.equal(live.body.repairs[0].phase,'queued');assert.equal(live.body.repairs[0].healed,false);
  assert.deepEqual((await status('foreign')).body.repairs,[]);
  mission.status='succeeded';
  const checkpoint=(id:number,phase:string,evidence:any)=>({id,mission_id:mission.mission_id,created_at:new Date().toISOString(),operation:{op:'repair_checkpoint',phase,evidence}});
  events=[checkpoint(2,'live_verified',{candidate,health:{status:'ok',commit:base,storage:{durable:true}}}),checkpoint(1,'candidate_created',{candidate})];
  assert.equal((await status()).body.repairs[0].healed,false);
  events[0].operation.evidence.health.commit=candidate;
  assert.equal((await status()).body.repairs[0].healed,true);
  events.unshift(checkpoint(3,'rollback_created',{candidate,rollback:restored}));
  assert.equal((await status()).body.repairs[0].healed,false);
  events.unshift(checkpoint(4,'rollback_verified',{candidate,rollback:restored,health:{status:'ok',commit:restored,storage:{durable:true}}}));
  live=await status();assert.equal(live.body.repairs[0].rolled_back,true);assert.equal(live.body.repairs[0].healed,false);
  storageFail=true;assert.equal((await status()).response.status,503);
 }finally{await new Promise<void>(r=>server.close(()=>r()));keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});}
});
