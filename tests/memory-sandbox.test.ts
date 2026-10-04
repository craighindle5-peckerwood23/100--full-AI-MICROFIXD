import test from 'node:test';
import assert from 'node:assert/strict';
import { executeMemoryOrgan } from '../server/organs/organs/memoryOrgan';
import { runCode } from '../server/sandbox/codeRunner';
import { rbacMiddleware } from '../server/security/rbac';

let rows: any[] = [];
let fail = false;
process.env.SUPABASE_URL = 'https://memory-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
globalThis.fetch = async (input: any, init: any) => {
  const request = input instanceof Request ? input : new Request(input, init);
  assert.match(request.url, /microfixd_memory_records/);
  if (fail) return new Response(JSON.stringify({code:'42501', message:'permission denied'}), {status:403});
  if (request.method === 'POST') {
    const row = await request.json(); rows.push(row);
    return new Response(JSON.stringify({id:row.id}), {headers:{'Content-Type':'application/json'}});
  }
  const session = JSON.parse(new URL(request.url).searchParams.get('metadata')!.slice(3)).session_id;
  return new Response(JSON.stringify(rows.filter(r => r.metadata.session_id === session)), {headers:{'Content-Type':'application/json'}});
};
test('durable write uses canonical table and recall isolates sessions', async () => {
  const result = await executeMemoryOrgan('store', {content:'repair fact',session_id:'a',metadata:{session_id:'forged'}});
  assert.equal(result.durable,true);
  assert.equal((await executeMemoryOrgan('recent',{session_id:'a'})).count,1);
  assert.equal((await executeMemoryOrgan('recent',{session_id:'b'})).count,0);
});
test('database failure rejects instead of returning RAM success', async () => {
  fail = true;
  await assert.rejects(executeMemoryOrgan('store',{content:'must fail'}), /42501/);
  await assert.rejects(executeMemoryOrgan('health',{}), /42501/);
  fail = false;
});
test('central sandbox blocks every supported language without execution', async () => {
  for (const lang of ['javascript','typescript','python','bash']) {
    const result = await runCode('throw new Error("executed")',lang,'test');
    assert.equal(result.success,false); assert.ok([126,2].includes(result.exit_code));
    assert.match(result.stderr,/Human approval required|Only JavaScript/);
  }
});
test('forged admin headers cannot authorize execution or HITL approval', () => {
  for (const path of ['/api/sandbox/run','/api/hitl/decide']) {
    let status=0, called=false;
    rbacMiddleware({headers:{'x-microfixd-role':'admin'},path,method:'POST',ip:'test'} as any,
      {status(n:number){status=n;return this},json(){}} as any,()=>{called=true});
    assert.equal(status,403);assert.equal(called,false);
  }
});
test('brain recalls before inference and persists the completed response', async () => {
  process.env.GROQ_API_KEY='test-groq';
  const memoryFetch=globalThis.fetch;
  let sawContext=false;
  globalThis.fetch=async (input:any,init:any)=>{
    const request=input instanceof Request ? input : new Request(input,init);
    if (!request.url.includes('api.groq.com')) return memoryFetch(input,init);
    const body=await request.json();
    assert.equal(body.max_tokens,10000);
    sawContext=body.messages.some((m:any)=>m.content.includes('repair fact'));
    return new Response(JSON.stringify({id:'test',object:'chat.completion',created:1,model:'qwen/qwen3.8-27b',choices:[{index:0,message:{role:'assistant',content:'remembered repair'},finish_reason:'stop'}],usage:{total_tokens:10}}),{headers:{'Content-Type':'application/json'}});
  };
  try {
    const {executeBrainOrgan}=await import('../server/organs/organs/brainOrgan');
    const result:any=await executeBrainOrgan('complete',{prompt:'recall repair',session_id:'a'});
    assert.equal(sawContext,true);assert.equal(result.memory_persisted,true);
    assert.ok(rows.some(r=>r.content.includes('remembered repair')));
  } finally {globalThis.fetch=memoryFetch;}
});
test('core MemoryOrgan uses durable transport and reloads from database',async()=>{
  const {MemoryOrgan,configureMemoryTransport}=await import('../microfixd/core/memory/memory');
  configureMemoryTransport(executeMemoryOrgan);
  const first=new MemoryOrgan();
  await first.remember('repair_fact','durable core fact');
  const fresh=new MemoryOrgan();
  assert.match(await fresh.retrieveContext(),/durable core fact/);
  fail=true;
  await assert.rejects(first.remember('broken','must not disappear'),/42501/);
  await assert.rejects(first.flush(),/42501/);
  fail=false;
});

test('callable retrieval preserves whole records and reports budget exclusions',async()=>{
  await executeMemoryOrgan('store',{session_id:'retrieval-test',content:'complete record '+ 'x'.repeat(5000)+' RECORD_END'});
  const full=await executeMemoryOrgan('context',{session_id:'retrieval-test',limit:30,max_chars:60000});
  assert.match(full.context,/RECORD_END/);assert.equal(full.window.returned,1);assert.equal(full.window.omitted,0);
  const bounded=await executeMemoryOrgan('context',{session_id:'retrieval-test',limit:30,max_chars:1000});
  assert.equal(bounded.window.returned,0);assert.equal(bounded.window.omitted,1);assert.equal(bounded.context,'[]');
});
