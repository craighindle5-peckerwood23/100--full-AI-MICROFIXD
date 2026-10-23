import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {rememberKnowledge, recallKnowledge, rememberProcedure, recallProcedures} from '../server/memory/knowledgeMemory';
import {packMemoryContext} from '../server/memory/contextWindow';
import {contentHash} from '../server/planner/executionSpine';

/** PostgREST transport fixture exercises the real Supabase query builder. */
function storage() {
  const records = new Map<string, any>(), missions = new Map<string, any>();
  let fail = false, sequence = 0;
  const fetcher = async (input: any, init?: any) => {
    const request = input instanceof Request ? input : new Request(input, init), url = new URL(request.url);
    const params = url.searchParams;
    if (fail) return Response.json({code:'42501',message:'denied'}, {status:403});
    if(url.pathname.endsWith('/automotive_source_records'))return Response.json([]);
    assert.match(url.pathname, /rest\/v1\/(microfixd_memory_records|spine_rows)$/);
    if (request.method === 'POST') {
      const value = await request.json();
      if (!records.has(value.id)) records.set(value.id, {...value,created_at:new Date(1700000000000 + ++sequence).toISOString()});
      return Response.json(params.has('select') ? {id:value.id} : null);
    }
    let data = url.pathname.endsWith('/spine_rows') ? [...missions.values()] : [...records.values()];
    for (const [key, value] of params) {
      if (value.startsWith('eq.')) data = data.filter(row => String(row[key]) === value.slice(3));
      if (value.startsWith('in.')) {
        const allowed = value.slice(4, -1).split(',').map(v=>v.replace(/^"|"$/g,''));
        data = data.filter(row => allowed.includes(String(row[key])));
      }
      if (value.startsWith('cs.')) data = data.filter(row => Object.entries(JSON.parse(value.slice(3))).every(([k,v])=>row[key]?.[k]===v));
    }
    data.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    data = data.slice(0, Number(params.get('limit')) || data.length);
    return Response.json(request.headers.get('accept')?.includes('vnd.pgrst.object') ? data[0] ?? null : data);
  };
  const db = createClient('https://knowledge-test.supabase.co','server-test-key',{global:{fetch:fetcher},auth:{persistSession:false}});
  return {db,records,missions,fetcher,setFail(value:boolean){fail=value;}};
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
  globalThis.fetch=async(input:any,init:any)=>{
    const request=input instanceof Request?input:new Request(input,init);
    if(!request.url.includes('api.groq.com'))return s.fetcher(input,init);
    const body=await request.json(),serialized=JSON.stringify(body.messages);
    if(serialized.includes('Microfixd command router'))return Response.json({choices:[{message:{role:'assistant',content:'{"intent":"query","complexity":"low","organs":["memory","brain"],"priority":"normal"}'},finish_reason:'stop'}],usage:{total_tokens:10}});
    assert.ok(serialized.includes('BMW has fault P0300'));assert.ok(!serialized.includes('other customer private'));recalled=true;
    assert.equal((serialized.match(/UNIQUE_PRIOR_REFERENCE/g)||[]).length,1);
    return Response.json({id:'brain',object:'chat.completion',created:1,model:'test',choices:[{message:{role:'assistant',content:'Remembered the recorded BMW fault.'},finish_reason:'stop'}],usage:{total_tokens:20}});
  };
  try{
    const {executeMemoryOrgan}=await import('../server/organs/organs/memoryOrgan');
    await executeMemoryOrgan('store',{...who,organ:'command',content:'UNIQUE_PRIOR_REFERENCE'});
    const {runCommand}=await import('../server/orchestration/commandCenter');
    const result=await runCommand({...who,task:'What do you remember about BMW?',source:'api',priority:'normal',context:{responseOnly:true}});
    assert.equal(recalled,true);assert.equal(result.success,true);
    for(const agent of ['brain','command','feedback'])assert.ok([...s.records.values()].some(row=>row.agent_id===agent&&row.tenant_id===who.tenant_id));
  }finally{globalThis.fetch=oldFetch;envKeys.forEach((key,i)=>{if(oldEnv[i]===undefined)delete process.env[key];else process.env[key]=oldEnv[i];});}
});
