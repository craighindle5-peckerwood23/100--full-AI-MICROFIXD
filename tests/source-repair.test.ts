import test from 'node:test';
import assert from 'node:assert/strict';
import {repairPath,repairURL,validateRepairPatch,repairSource} from '../server/engineering/sourceRepair';
import {getTool} from '../server/tools/toolRegistry';
import {createGovernedTools,READ_TOOLS} from '../server/planner/governedTools';

test('repair validation protects isolation, governance, tests, dependencies and unrelated source',()=>{
 for(const path of ['../a.ts','scripts/engineering-loop.mjs','infrastructure/repair-runner/server.mjs','tests/example.ts','server/engineering/sourceRepair.ts','server/security/rbac.ts','server/planner/governedTools.ts','package.json','server/index.ts','server/tools/toolRegistry.ts'])assert.throws(()=>repairPath(path));
 assert.equal(repairPath('server/automotive/example.ts'),'server/automotive/example.ts');
 for(const url of ['http://runner.onrender.com','https://runner.onrender.com.evil.test','https://key@runner.onrender.com','https://runner.onrender.com/path'])assert.throws(()=>repairURL(url));
 const sources=new Map([['server/automotive/example.ts','old']]);
 assert.throws(()=>validateRepairPatch({files:[{path:'src/unrequested.ts',content:'new'}]},sources));
 assert.throws(()=>validateRepairPatch({files:[{path:'server/automotive/example.ts',content:'old'}]},sources));
 assert.deepEqual(validateRepairPatch({edits:[{path:'server/automotive/example.ts',old_text:'old',new_text:'new'}]},sources),[{path:'server/automotive/example.ts',content:'new'}]);
 assert.throws(()=>validateRepairPatch({edits:[{path:'server/automotive/example.ts',old_text:'missing',new_text:'new'}]},sources),/NOT_UNIQUE/);
 assert.throws(()=>validateRepairPatch({edits:[{path:'server/automotive/example.ts',old_text:'old',new_text:'new'}]},new Map([['server/automotive/example.ts','old old']])),/NOT_UNIQUE/);
 assert.ok(getTool('repair_source_code'));assert.equal(READ_TOOLS.has('repair_source_code'),false);
});
test('repair uses a separate Render candidate, rejects stale green results, and promotes only an exact verified commit',async()=>{
 const original={token:process.env.GITHUB_TOKEN,url:process.env.MICROFIXD_REPAIR_RUNNER_URL};process.env.GITHUB_TOKEN='fixture-secret';process.env.MICROFIXD_REPAIR_RUNNER_URL='https://fixture-runner.onrender.com';
 const events:any[]=[];let checks=0,mainReads=0;const base='a'.repeat(40),candidate='b'.repeat(40);
 const db:any={from:()=>({upsert:async(row:any)=>{events.push(['durable',JSON.parse(row.content).phase]);return {error:null};}})};
 const json=(value:any,status=200)=>new Response(JSON.stringify(value),{status});
 const request:typeof fetch=async(input,options)=>{
  const url=String(input),body=options?.body?JSON.parse(String(options.body)):null;events.push([options?.method??'GET',url,body]);
  if(url.startsWith('https://api.github.com/')){
   assert.equal((options?.headers as any).Authorization,'Bearer fixture-secret');
   if(url.endsWith('git/ref/heads/main')){mainReads++;return json({object:{sha:base}});}
   if(url.endsWith(`git/commits/${base}`))return json({tree:{sha:'tree-base'}});
   if(url.includes('/contents/'))return json({type:'file',encoding:'base64',size:3,content:Buffer.from('old').toString('base64')});
   if(url.endsWith('git/ref/heads/repair/candidate'))return json({},404);
   if(url.endsWith('/git/trees'))return json({sha:'tree-candidate'});
   if(url.endsWith('/git/commits'))return json({sha:candidate});
   if(url.endsWith('/git/refs'))return json({});
   if(url.endsWith('/git/refs/heads/main')){assert.equal(checks,2);assert.equal(mainReads,3);assert.equal(body.force,false);assert.equal(body.sha,candidate);return json({});}
   throw new Error('Unexpected fixture GitHub URL');
  }
  assert.equal(options?.headers,undefined,'no controller secret forwarded to runner or production');
  if(url.includes('fixture-runner')){checks++;return json({commit:checks===1?base:candidate,status:'verified',network:'none',productionSecrets:false,gate:'production+engineering+adapters'});}
  return json({status:'ok',commit:candidate});
 };
 try{
  const result=await repairSource(db,{tenant:'fixture',mission:'mission',subtask:'task'},'Fix fixture',['server/automotive/example.ts'],async()=>({content:JSON.stringify({files:[{path:'server/automotive/example.ts',content:'new'}]})}),async()=>{},request,async()=>{});
  assert.equal(result.status,'live_verified');assert.equal(result.commit,candidate);
  assert.deepEqual(events.filter(e=>e[0]==='durable').map(e=>e[1]),['candidate_created','sandbox_verified','promoted','live_verified']);
  await assert.rejects(()=>repairSource(db,{tenant:'fixture',mission:'mission',subtask:'task'},'Fix fixture',['server/automotive/example.ts'],async()=>({content:'{}'}),async()=>{throw new Error('REPAIR_LEASE_LOST');},request),/LEASE_LOST/);
 }finally{if(original.token===undefined)delete process.env.GITHUB_TOKEN;else process.env.GITHUB_TOKEN=original.token;if(original.url===undefined)delete process.env.MICROFIXD_REPAIR_RUNNER_URL;else process.env.MICROFIXD_REPAIR_RUNNER_URL=original.url;}
});
test('durable repair cannot start for an unapproved or foreign tenant mission',async()=>{
 const tools=createGovernedTools({} as any,'foreign','mission','worker');
 await assert.rejects(()=>tools.executeTool({name:'repair_source_code',arguments:{objective:'repair fixture',paths_json:'["src/example.ts"]'}},{tenant_id:'foreign',mission_id:'mission',subtask_id:'task',tool_permissions:['repair_source_code'],constraints:{tool_approval_mode:'manual'}} as any),/OWNER_ADMIN_REQUIRED/);
});
