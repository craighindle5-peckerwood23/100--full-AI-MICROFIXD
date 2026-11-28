import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {rememberKnowledge, recallKnowledge, rememberProcedure, recallProcedures} from '../server/memory/knowledgeMemory';
import {packMemoryContext} from '../server/memory/contextWindow';
import {contentHash} from '../server/planner/executionSpine';
import {readProcedureConsolidation,recoverProcedureConsolidation} from '../server/memory/procedureConsolidation';

/** PostgREST transport fixture exercises the real Supabase query builder. */
function storage() {
  const records = new Map<string, any>(), missions = new Map<string, any>();
  let fail = false, failWrites = false, sequence = 0;
  const fetcher = async (input: any, init?: any) => {
    const request = input instanceof Request ? input : new Request(input, init), url = new URL(request.url);
    const params = url.searchParams;
    if (fail) return Response.json({code:'42501',message:'denied'}, {status:403});
    if(url.pathname.endsWith('/automotive_source_records'))return Response.json([]);
    assert.match(url.pathname, /rest\/v1\/(microfixd_memory_records|spine_rows)$/);
    if (request.method === 'POST') {
      if(failWrites)return Response.json({code:'503',message:'write unavailable'},{status:503});
      const value = await request.json();
      if (!records.has(value.id)) records.set(value.id, {...value,created_at:new Date(1700000000000 + ++sequence).toISOString()});
      return Response.json(params.has('select') ? {id:value.id} : null);
    }
    let data = url.pathname.endsWith('/spine_rows') ? [...missions.values()] : [...records.values()];
    const field=(row:any,key:string)=>key==='data->>status'?row.data?.status:row[key];
    for (const [key, value] of params) {
      if (value.startsWith('eq.')) data = data.filter(row => String(field(row,key)) === value.slice(3));
      if (value.startsWith('gt.')) data = data.filter(row => Number(field(row,key)) > Number(value.slice(3)));
      if (value.startsWith('in.')) {
        const allowed = value.slice(4, -1).split(',').map(v=>v.replace(/^"|"$/g,''));
        data = data.filter(row => allowed.includes(String(row[key])));
      }
      if (value.startsWith('cs.')) data = data.filter(row => Object.entries(JSON.parse(value.slice(3))).every(([k,v])=>row[key]?.[k]===v));
    }
    data.sort(params.get('order')?.startsWith('sequence') ? (a,b)=>a.sequence-b.sequence : (a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    data = data.slice(0, Number(params.get('limit')) || data.length);
    return Response.json(request.headers.get('accept')?.includes('vnd.pgrst.object') ? data[0] ?? null : data);
  };
  const db = createClient('https://knowledge-test.supabase.co','server-test-key',{global:{fetch:fetcher},auth:{persistSession:false}});
  return {db,records,missions,fetcher,setFail(value:boolean){fail=value;},setFailWrites(value:boolean){failWrites=value;}};
}
const who = {tenant_id:'tenant-a',session_id:'session-a'};

test('tenant knowledge survives a new session while session memory and other tenants stay isolated',async()=>{
  const s=storage();
  await rememberKnowledge(s.db,who,{key:'vehicle',content:'BMW shared state'});
  await rememberKnowledge(s.db,who,{key:'private',content:'BMW private state',scope:'session'});
  await rememberKnowledge(s.db,{tenant_id:'tenant-b',session_id:'session-a'},{key:'vehicle',content:'BMW other customer'});
  const cold=await recallKnowledge(s.db,{...who,session_id:'new-session'},'BMW');
  assert.deepEqual(cold.memories.map(m=>m.content),['BMW shared state']);
  const original=await recallKnowledge(s.db,who,'BMW');
  assert.equal(original.count,2);assert.ok(original.memories.every(m=>m.trust==='recorded_assertion'));
});

test('corrections supersede older claims; retries do not resurrect an old value or prevent later reversions',async()=>{
  const s=storage();
  const original={key:'vehicle.dtc',content:'P0300 misfire',event_id:'first'};
  const first=await rememberKnowledge(s.db,who,original);
  await rememberKnowledge(s.db,who,{...original,content:'P0171 lean',event_id:'correction'});
  await rememberKnowledge(s.db,who,original);
  let found=await recallKnowledge(s.db,who,'vehicle');
  assert.equal(s.records.size,2);assert.equal(found.memories[0].content,'P0171 lean');
  assert.deepEqual(found.memories[0].superseded_ids,[first.id]);
  await rememberKnowledge(s.db,who,{...original,event_id:'later-reversion'});
  found=await recallKnowledge(s.db,who,'vehicle');
  assert.equal(found.memories[0].content,'P0300 misfire');assert.equal(found.memories[0].superseded_count,2);
});

test('entity links retrieve one-hop supporting knowledge without unrelated claims',async()=>{
  const s=storage();
  await rememberKnowledge(s.db,who,{key:'bmw.dtc',content:'BMW has recorded fault P0300',subject:'BMW',predicate:'has_fault',object:'P0300'});
  await rememberKnowledge(s.db,who,{key:'dtc.meaning',content:'Random multiple cylinder misfire',subject:'P0300',predicate:'indicates',object:'Misfire'});
  await rememberKnowledge(s.db,who,{key:'unrelated',content:'Pressure washer pump'});
  const result=await recallKnowledge(s.db,who,'BMW');
  assert.equal(result.count,2);assert.ok(result.memories.some(m=>m.related&&m.content==='Random multiple cylinder misfire'));
});

test('invalid assertions and database failures cannot become durable success',async()=>{
  const s=storage();
  for(const input of [{key:'x',content:'fact',confidence:NaN},{key:'x',content:'fact',subject:'BMW'},{key:'x',content:'fact',scope:'global'},{key:'',content:'fact'}]){
    await assert.rejects(()=>rememberKnowledge(s.db,who,input));
  }
  assert.equal(s.records.size,0);s.setFail(true);
  await assert.rejects(()=>rememberKnowledge(s.db,who,{key:'x',content:'fact'}),/42501/);
  await assert.rejects(()=>recallKnowledge(s.db,who,'fact'),/42501/);
});

test('context compacts duplicate exchanges, skips oversized records and reports all exclusions',()=>{
  const pair={task:'Inspect BMW',output:'Recorded P0300'};
  const command={id:'command',agent_id:'command',content:JSON.stringify(pair)};
  const brain={id:'brain',agent_id:'brain',content:JSON.stringify({messages:[{role:'user',content:pair.task}],response:pair.output})};
  const huge={id:'huge',content:'x'.repeat(5000)}, small={id:'small',content:'Keep the full final sentence.'};
  const original=JSON.stringify([command,brain,huge,small]);
  const packed=packMemoryContext([command,brain,huge,small],[],300);
  assert.equal(packed.window.deduplicated,1);assert.deepEqual(packed.window.duplicate_ids,['brain']);
  assert.deepEqual(packed.window.omitted_ids,['huge']);assert.ok(packed.context.includes(small.content));
  assert.ok(packed.context.length<=300);assert.equal(JSON.stringify([command,brain,huge,small]),original);
});

function evidence() {
  const source:any={artifact_id:'source',tenant_id:who.tenant_id,mission_id:'mission',subtask_id:'sub',content:{result:{actual:true}},evidence:{tool:'get_github_repo'}};
  source.hash=contentHash(source.content);
  const mission:any={mission_id:'mission',tenant_id:who.tenant_id,objective:'Inspect repository',status:'running'};
  const final:any={artifact_id:'final',type:'mission_result',content:{outputs:['source']},tenant_id:who.tenant_id,mission_id:'mission',evidence:{completion_review:{status:'complete',method:'model_review',evidence_artifact_ids:['source']}}};
  const sub:any={subtask_id:'sub',tenant_id:who.tenant_id,status:'succeeded',tool_request:{name:'get_github_repo',arguments:{repo:'owner/repo',token:'PRIVATE_CREDENTIAL'}}};
  final.hash=contentHash(final.content);source.evidence.request_hash=contentHash(sub.tool_request);
  return {source,mission,final,sub};
}

test('procedure learning requires succeeded mission finalization and never retains argument values',async()=>{
  const s=storage(),f=evidence();
  await rememberProcedure(s.db,f.mission,f.final,[f.source],[f.sub]);
  await rememberProcedure(s.db,f.mission,f.final,[f.source],[f.sub]);
  assert.equal(s.records.size,1);assert.equal((await recallProcedures(s.db,who,'repository')).count,0);
  s.missions.set('mission',{id:'mission',tenant_id:who.tenant_id,kind:'missions',data:{...f.mission,status:'succeeded',result_artifact_id:'wrong-final'}});
  assert.equal((await recallProcedures(s.db,who,'repository')).count,0);
  s.missions.get('mission').data.result_artifact_id='final';
  const result=await recallProcedures(s.db,who,'repository');
  assert.equal(result.count,1);assert.ok(!result.procedures[0].content.includes('PRIVATE_CREDENTIAL'));
  assert.ok(!result.procedures[0].content.includes('owner/repo'));
  assert.equal((await recallProcedures(s.db,{...who,tenant_id:'tenant-b'},'repository')).count,0);
});

test('failed or tampered source evidence is rejected before procedure storage',async()=>{
  const s=storage(),f=evidence();
  await assert.rejects(()=>rememberProcedure(s.db,f.mission,f.final,[{...f.source,content:{result:{actual:false}}}],[f.sub]),/INVALID_PROCEDURE_EVIDENCE/);
  await assert.rejects(()=>rememberProcedure(s.db,f.mission,f.final,[f.source],[{...f.sub,status:'failed'}]),/INVALID_PROCEDURE_EVIDENCE/);
  await assert.rejects(()=>rememberProcedure(s.db,f.mission,f.final,[{...f.source,tenant_id:'other'}],[f.sub]),/INVALID_PROCEDURE_EVIDENCE/);
  assert.equal(s.records.size,0);
});

test('consolidation retains only completion-cited tool steps and retrieves by tool name',async()=>{
  const s=storage(),f=evidence();
  const discardedSub={...f.sub,subtask_id:'discarded',tool_request:{name:'read_public_page',arguments:{url:'https://discarded.example'}}};
  const discarded={...f.source,artifact_id:'discarded-artifact',subtask_id:'discarded',evidence:{tool:'read_public_page',request_hash:contentHash(discardedSub.tool_request)}};
  await rememberProcedure(s.db,f.mission,f.final,[f.source,discarded],[f.sub,discardedSub]);
  const stored=JSON.parse([...s.records.values()][0].content);
  assert.deepEqual(stored.steps.map((step:any)=>step.tool),['get_github_repo']);
  assert.equal(stored.reflection.excluded_tool_steps,1);assert.equal(stored.reflection.measured_quality_gain,null);
  s.missions.set('mission',{id:'mission',tenant_id:who.tenant_id,kind:'missions',data:{...f.mission,status:'succeeded',result_artifact_id:'final'}});
  assert.equal((await recallProcedures(s.db,who,'get_github_repo')).count,1);
  assert.equal((await recallProcedures(s.db,who,'read_public_page')).count,0);
  assert.equal((await recallProcedures(s.db,who,'automatically')).count,0);
});

function completedMission(s:ReturnType<typeof storage>,id='mission',sequence=1,tenant=who.tenant_id) {
  const f=evidence();f.mission={...f.mission,tenant_id:tenant,mission_id:id,status:'succeeded',result_artifact_id:`${id}:final`};
  f.source={...f.source,tenant_id:tenant,mission_id:id,artifact_id:`${id}:source`};
  f.final={...f.final,tenant_id:tenant,mission_id:id,artifact_id:`${id}:final`,evidence:{completion_review:{status:'complete',method:'model_review',evidence_artifact_ids:[f.source.artifact_id]}}};
  f.sub={...f.sub,tenant_id:tenant};
  const put=(key:string,kind:string,data:any,seq=sequence)=>s.missions.set(key,{id:key,tenant_id:tenant,mission_id:id,kind,data,sequence:seq});
  put(id,'missions',f.mission);
  put(`${id}:source`,'artifacts',f.source);put(`${id}:final`,'artifacts',f.final);put(`${id}:sub`,'subtasks',f.sub);
  return f;
}

test('a cold worker recovers missed consolidation once, and a new session recalls its procedure',async()=>{
  const s=storage();completedMission(s);
  const cold=()=>createClient('https://knowledge-test.supabase.co','server-test-key',{global:{fetch:s.fetcher},auth:{persistSession:false}});
  assert.equal((await readProcedureConsolidation(cold(),who.tenant_id,'mission'))?.status,'not_consolidated');
  const first=await recoverProcedureConsolidation(cold());
  assert.equal(first.consolidated,1);assert.equal(first.failed,0);assert.equal(s.records.size,1);
  const second=await recoverProcedureConsolidation(cold());
  assert.equal(second.existing,1);assert.equal(second.consolidated,0);assert.equal(s.records.size,1);
  const status=await readProcedureConsolidation(cold(),who.tenant_id,'mission');
  assert.equal(status?.status,'consolidated');assert.equal(status?.durable,true);
  assert.equal(await readProcedureConsolidation(cold(),'other','mission'),null);
  const recall=await recallProcedures(cold(),{...who,session_id:'after-restart'},'get_github_repo');
  assert.equal(recall.count,1);assert.equal(recall.procedures[0].trust,'historical_execution');
  assert.ok(!recall.procedures[0].content.includes('PRIVATE_CREDENTIAL'));
  assert.equal((await recallProcedures(cold(),{...who,tenant_id:'other'},'get_github_repo')).count,0);
});

test('a failed write is retried after recovery and never creates a false learning receipt',async()=>{
  const s=storage();completedMission(s);s.setFailWrites(true);
  const deferred=await recoverProcedureConsolidation(s.db);
  assert.equal(deferred.failed,1);assert.equal(deferred.consolidated,0);assert.equal(s.records.size,0);
  s.setFailWrites(false);
  assert.equal((await recoverProcedureConsolidation(s.db)).consolidated,1);
  assert.equal(s.records.size,1);
  s.setFail(true);await assert.rejects(()=>recoverProcedureConsolidation(s.db),/CONSOLIDATION_SCAN_UNAVAILABLE/);
});

test('bounded recovery moves past corrupt evidence and excludes failed or paused missions',async()=>{
  const s=storage();const bad=completedMission(s,'bad',1);completedMission(s,'good',2);
  s.missions.get('bad:source').data={...bad.source,content:{tampered:true}};
  for(const [id,status] of [['failed','failed'],['paused','waiting']]){
    completedMission(s,id,3);s.missions.get(id).data.status=status;
    assert.equal((await readProcedureConsolidation(s.db,who.tenant_id,id))?.status,'not_eligible');
  }
  let cursor=0;const outcomes=[];
  for(let i=0;i<3;i++){const report=await recoverProcedureConsolidation(s.db,cursor,1);outcomes.push(report);cursor=report.nextCursor;}
  assert.equal(outcomes[0].failed,1);assert.equal(outcomes[0].nextCursor,1);
  assert.equal(outcomes[1].consolidated,1);assert.equal(cursor,0);
  assert.equal(s.records.size,1);assert.equal([...s.records.values()][0].metadata.mission_id,'good');
  await assert.rejects(()=>rememberProcedure(s.db,{...bad.mission,status:'failed'},bad.final,[bad.source],[bad.sub]),/INVALID_PROCEDURE_EVIDENCE/);
});

test('tenant mismatch, duplicate citations and wrong final artifacts cannot become learned procedures',async()=>{
  const s=storage(),f=completedMission(s);
  s.missions.get('mission').data.tenant_id='other';
  assert.equal((await recoverProcedureConsolidation(s.db)).failed,1);assert.equal(s.records.size,0);
  await assert.rejects(()=>rememberProcedure(s.db,{...f.mission,result_artifact_id:'wrong'},f.final,[f.source],[f.sub]),/INVALID_PROCEDURE_EVIDENCE/);
  const duplicate={...f.final,evidence:{completion_review:{...f.final.evidence.completion_review,evidence_artifact_ids:[f.source.artifact_id,f.source.artifact_id]}}};
  await assert.rejects(()=>rememberProcedure(s.db,f.mission,duplicate,[f.source],[f.sub]),/INVALID_PROCEDURE_EVIDENCE/);
  assert.equal(s.records.size,0);
});

test('the command pipeline recalls knowledge once in the correct tenant and persists brain, response and feedback there',async()=>{
  const s=storage();
  await rememberKnowledge(s.db,who,{key:'vehicle',content:'BMW has fault P0300'});
  await rememberKnowledge(s.db,{...who,tenant_id:'tenant-b'},{key:'vehicle',content:'BMW other customer private'});
  const oldFetch=globalThis.fetch;
  const envKeys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GROQ_API_KEY','OPENROUTER_API_KEY','GEMINI_API_KEY','CLOUDFLARE_API_TOKEN'];
  const oldEnv=envKeys.map(key=>process.env[key]);
  process.env.SUPABASE_URL='https://knowledge-test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='server-test-key';process.env.GROQ_API_KEY='brain-test-key';
  for(const key of ['OPENROUTER_API_KEY','GEMINI_API_KEY','CLOUDFLARE_API_TOKEN'])delete process.env[key];
  let recalled=false;
  let modelAnswer='Remembered the recorded BMW fault.';
  globalThis.fetch=async(input:any,init:any)=>{
    const request=input instanceof Request?input:new Request(input,init);
    if(!request.url.includes('api.groq.com'))return s.fetcher(input,init);
    const body=await request.json(),serialized=JSON.stringify(body.messages);
    if(serialized.includes('Microfixd command router'))return Response.json({choices:[{message:{role:'assistant',content:'{"intent":"query","complexity":"low","organs":["memory","brain"],"priority":"normal"}'},finish_reason:'stop'}],usage:{total_tokens:10}});
    assert.ok(serialized.includes('BMW has fault P0300'));assert.ok(!serialized.includes('other customer private'));recalled=true;
    assert.equal((serialized.match(/UNIQUE_PRIOR_REFERENCE/g)||[]).length,1);
    return Response.json({id:'brain',object:'chat.completion',created:1,model:'test',choices:[{message:{role:'assistant',content:modelAnswer},finish_reason:'stop'}],usage:{total_tokens:20}});
  };
  try{
    const {executeMemoryOrgan}=await import('../server/organs/organs/memoryOrgan');
    await executeMemoryOrgan('store',{...who,organ:'command',content:'UNIQUE_PRIOR_REFERENCE'});
    const {runCommand}=await import('../server/orchestration/commandCenter');
    const result=await runCommand({...who,task:'What do you remember about BMW?',source:'api',priority:'normal',context:{responseOnly:true}});
    assert.equal(recalled,true);assert.equal(result.success,true);
    for(const agent of ['brain','command','feedback'])assert.ok([...s.records.values()].some(row=>row.agent_id===agent&&row.tenant_id===who.tenant_id));
    modelAnswer = 'I successfully deployed the repair.';
    const rejected = await runCommand({...who,task:'What changed on the BMW?',source:'api',priority:'normal',context:{responseOnly:true}});
    assert.equal(rejected.success,false);
    assert.equal(rejected.diagnostics?.failure?.code,'UNSUPPORTED_EXECUTION_CLAIM');
    assert.ok(!rejected.output.includes(modelAnswer));
    assert.ok(![...s.records.values()].some(row=>String(row.content).includes(modelAnswer)));
  }finally{globalThis.fetch=oldFetch;envKeys.forEach((key,i)=>{if(oldEnv[i]===undefined)delete process.env[key];else process.env[key]=oldEnv[i];});}
});

test('Ask Microfixd answers paused missions from live tenant records, independently of conversation history',async()=>{
  const {asksAboutPausedMissions}=await import('../server/planner/pausedMissionReport');
  for(const question of ['Tell me about microfixd paused missions','Which of my missions are paused?', 'Show me my waiting missions','Why are my missions on hold?', 'Are there any paused missions?']){
    assert.ok(asksAboutPausedMissions(question),question);
  }
  for(const other of ['Resume all paused missions','What is a paused mission?','List my paused missions from yesterday','Write a story about paused missions']){
    assert.equal(asksAboutPausedMissions(other),false,other);
  }
  const original=globalThis.fetch;
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL='https://knowledge-test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='server-test-key';
  let scenario:'waiting'|'empty'|'outage'|'detail-outage'='waiting', reads=0;
  const writes:string[]=[];
  globalThis.fetch=async(input,init)=>{
    const request=input instanceof Request?input:new Request(input,init);
    const target=new URL(request.url),q=target.searchParams;
    assert.equal(target.hostname,'knowledge-test.supabase.co','registry questions require no model call');
    if(target.pathname.endsWith('/microfixd_memory_records')){
      assert.equal(request.method,'POST');const record=await request.json();assert.equal(record.tenant_id,who.tenant_id);writes.push(record.agent_id);
      return Response.json({id:record.id});
    }
    assert.equal(request.method,'GET');assert.equal(q.get('tenant_id'),'eq.'+who.tenant_id);
    if(q.has('data->>status')&&q.get('kind')==='eq.missions'){
      reads++;assert.equal(q.get('data->>status'),'eq.waiting');assert.equal(q.get('limit'),'3');assert.match(request.headers.get('prefer')??'',/count=exact/);
      if(scenario==='outage')return Response.json({message:'offline'},{status:403});
      const empty=scenario==='empty';return Response.json(empty?[]:[{id:'m-1',objective:'Review sensor log'}],{headers:{'Content-Range':empty?'*/0':'0-0/1'}});
    }
    assert.equal(q.get('mission_id'),'eq.m-1');
    if(scenario==='detail-outage')return Response.json({message:'unavailable'},{status:403});
    if(q.get('kind')==='eq.missions')return Response.json([{data:{status:'waiting',constraints:{}}}]);
    if(q.get('kind')==='eq.subtasks')return Response.json([{data:{subtask_id:'step',tool_request:{name:'read_public_page',arguments:{}}}}]);
    if(target.pathname.endsWith('/spine_errors'))return Response.json([{code:'WAITING_APPROVAL'}]);
    assert.ok(target.pathname.endsWith('/spine_approvals'));return Response.json([{status:'pending',expires_at:'2099-01-01'}]);
  };
  try{
    const {runCommand}=await import('../server/orchestration/commandCenter');
    const run=()=>runCommand({...who,task:'Tell me about microfixd paused missions',source:'chat',priority:'normal',context:{responseOnly:true,tenant_id:'other',missions:[{id:'bogus'}]}});
    const first=await run();assert.equal(first.success,true);assert.match(first.output,/Review sensor log.*Operator approval is pending/);
    assert.deepEqual(first.missions?.map(m=>m.id),['m-1']);assert.equal(first.groq_tokens,0);assert.deepEqual(writes,['command','feedback']);
    scenario='empty';const empty=await run();assert.equal(empty.success,true);assert.match(empty.output,/No paused missions/);
    scenario='detail-outage';assert.match((await run()).output,/cause could not be read/);
    scenario='outage';const failed=await run();assert.equal(failed.success,false);assert.match(failed.output,/number of paused missions is unknown/);
    assert.equal(reads,4);
  }finally{
    globalThis.fetch=original;
    if(url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=url;
    if(key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=key;
  }
});
