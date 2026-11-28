import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSchema} from '../server/planner/supabaseRuntime';
test('structured output rejects missing fields, wrong types and extra fields',()=>{
 const schema={type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false};
 assert.equal(validateSchema({answer:'verified'},schema),true);
 for(const value of [{}, {answer:3}, {answer:'ok',extra:true}, null])assert.equal(validateSchema(value,schema),false);
 assert.equal(validateSchema('unclassified',{}),false);
});
test('enum values and unsupported schemas fail closed',()=>{
 assert.equal(validateSchema('read',{type:'string',enum:['read']}),true);
 assert.equal(validateSchema('write',{type:'string',enum:['read']}),false);
 assert.equal(validateSchema({},{type:'object',properties:{answer:{bogus:true}}}),false);
 assert.equal(validateSchema([],{type:'array'}),false);
});


test('planner accepts JSON code fences and a single steps wrapper, never surrounding instructions',async()=>{
 const {parsePlanOutput,planningErrorCode}=await import('../server/planner/planOutput');
 assert.deepEqual(parsePlanOutput('```json\n[{"tool_request":null,"input":{"step":"explain"}}]\n```'),[{tool_request:null,input:{step:'explain'}}]);
 assert.deepEqual(parsePlanOutput('{"steps":["one"]}'),['one']);
 for(const text of ['Before: ["one"]','[]','{"steps":["one"],"extra":true}','null'])assert.throws(()=>parsePlanOutput(text),/INVALID_PLAN/);
 assert.equal(planningErrorCode(new Error('secret-token-value')),'PLANNING_FAILED');
 assert.equal(planningErrorCode(new SyntaxError('invalid response')),'INVALID_PLAN_JSON');
});

test('completion review requires real evidence IDs and well-formed bounded next steps',async()=>{
 const {parseCompletionOutput,completionEvidence}=await import('../server/planner/completionReview');
 const artifacts:any[]=[{artifact_id:'real',hash:'digest',content:{result:{organs:[{id:'paragon',native_executor:true}],tools:[{name:'list_system_capabilities'}]}},evidence:{tool:'list_system_capabilities'}}];
 assert.equal((completionEvidence(artifacts)[0].content_preview).includes('inventory_only'),true);
 const good={status:'complete',reason:'Inventory requested and returned',evidence_artifact_ids:['real'],next_steps:[]};
 assert.equal(parseCompletionOutput(JSON.stringify(good),artifacts).status,'complete');
 for(const bad of [{...good,evidence_artifact_ids:['forged']},{...good,evidence_artifact_ids:[]},{...good,status:'continue'},{...good,next_steps:[{}]},{...good,extra:'injected'}])assert.throws(()=>parseCompletionOutput(JSON.stringify(bad),artifacts),/INVALID_COMPLETION/);
});

test('planning diagnostics have mission-scoped IDs and preserve every allowed tool argument contract',async()=>{
 const {plannerMessageId,planningToolCatalog}=await import('../server/planner/supabaseRuntime');
 const {ENABLED_TOOLS}=await import('../server/planner/governedTools');
 const {getTool}=await import('../server/tools/toolRegistry');
 const failure={kind:'planning_error',code:'TOKEN_BUDGET_EXHAUSTED'};
 const one=plannerMessageId('tenant','mission-one','planner','supervisor',failure);
 assert.equal(one,plannerMessageId('tenant','mission-one','planner','supervisor',failure));
 assert.notEqual(one,plannerMessageId('tenant','mission-two','planner','supervisor',failure));
 assert.notEqual(one,plannerMessageId('other','mission-one','planner','supervisor',failure));
 const compact=planningToolCatalog(ENABLED_TOOLS);
 assert.deepEqual(compact.map(t=>t.name),ENABLED_TOOLS);
 for(const tool of compact)assert.deepEqual(tool.parameters,getTool(tool.name)!.parameters);
 assert.ok(Buffer.byteLength(JSON.stringify(compact))<Buffer.byteLength(JSON.stringify(ENABLED_TOOLS.map(getTool))));
});

test('mission reservations include injected observations, release explicit rejection and settle the successful fallback',async()=>{
 const {createMissionModelCall}=await import('../server/planner/supabaseRuntime');
 const {completeTextWithFallback}=await import('../server/orchestration/llmFallback');
 const keys=['OPENROUTER_API_KEY','GROQ_API_KEY','GEMINI_API_KEY','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID'];
 const saved=keys.map(k=>process.env[k]),originalFetch=globalThis.fetch;
 let held=0,dispatches=0;const reservations=new Map<string,number>(),settlements:number[]=[],payloads:any[]=[];
 const db:any={rpc:async(name:string,p:any)=>{
  if(name==='spine_reserve_call'){
   assert.equal(p.p_tenant,'tenant');assert.equal(p.p_mission,'mission');assert.equal(p.p_owner,'owner');
   if(held+p.p_tokens>6000)return {data:false,error:null};
   held+=p.p_tokens;reservations.set(p.p_run,p.p_tokens);return {data:true,error:null};
  }
  assert.equal(name,'spine_settle_call');held-=reservations.get(p.p_run)!;held+=p.p_tokens;settlements.push(p.p_tokens);return {error:null};
 }};
 try{
  keys.forEach(k=>delete process.env[k]);process.env.OPENROUTER_API_KEY='fixture';process.env.CLOUDFLARE_API_TOKEN='fixture';process.env.CLOUDFLARE_ACCOUNT_ID='fixture';
  globalThis.fetch=async(url,init)=>{
   dispatches++;const body=JSON.parse(String(init?.body));payloads.push(body);
   assert.ok(body.messages[0].content.includes('Server runtime observations'));
   assert.ok(held>=Buffer.byteLength(JSON.stringify(body.messages))+512);
   if(String(url).includes('openrouter.ai'))return Response.json({error:{message:'rate limit'}},{status:429});
   assert.equal(settlements[0],0,'rejected attempt must settle before fallback dispatch');
   return Response.json({success:true,result:{response:'verified fixture answer'}});
  };
  const call=createMissionModelCall(db,{getMission:async()=>({status:'queued'})} as any,'tenant','mission','owner',completeTextWithFallback);
  const result=await call([{role:'user',content:'Report your observed runtime state'}],100,0);
  assert.equal(result.provider,'cloudflare');assert.equal(dispatches,2);assert.equal(settlements.length,2);
  assert.ok(settlements[1]>0);assert.equal(held,settlements[1]);
 }finally{globalThis.fetch=originalFetch;keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});}
});

test('ambiguous provider failure retains its reservation and a budget stop prevents another dispatch',async()=>{
 const {createMissionModelCall}=await import('../server/planner/supabaseRuntime');
 let reservations=0,settlements=0,dispatches=0;
 const db:any={rpc:async(name:string)=>name==='spine_reserve_call'?{data:++reservations===1,error:null}:(settlements++,{error:null})};
 const model:any=async(messages:any,maxTokens:number,_temperature:any,_provider:any,options:any)=>{
  await options.beforeAttempt('openrouter',{messages,maxTokens});dispatches++;
  await options.onAttemptFailure('openrouter',Object.assign(new Error('timeout'),{status:504}));
  await options.beforeAttempt('groq',{messages,maxTokens});dispatches++;
 };
 const call=createMissionModelCall(db,{getMission:async()=>({status:'queued'})} as any,'tenant','mission','owner',model);
 await assert.rejects(()=>call([{role:'user',content:'fixture'}],100,0),/TOKEN_BUDGET_EXHAUSTED/);
 assert.equal(dispatches,1);assert.equal(settlements,0);
});
