import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {sourceContentHash} from '../server/automotive/nhtsa-ingestion';
import {storedContext} from '../server/memory/contextGraph';
import {importVehicleReferences,searchVehicleReferences} from '../server/automotive/sourceReferences';
import {getTool} from '../server/tools/toolRegistry';
import {READ_TOOLS,ENABLED_TOOLS} from '../server/planner/governedTools';

function fixture(){
 const records:any[]=[
  {id:'old',tenant_id:'a',agent_id:'command',content:'BMW older stored context',metadata:{session_id:'s'},created_at:'2026-01-01'},
  {id:'shared',tenant_id:'a',agent_id:'command',content:'BMW explicitly shared context',metadata:{session_id:'other',scope:'tenant'},created_at:'2026-01-02'},
  {id:'private',tenant_id:'a',agent_id:'command',content:'PRIVATE_OTHER_SESSION',metadata:{session_id:'other'},created_at:'2026-01-02'},
  {id:'foreign',tenant_id:'b',agent_id:'command',content:'PRIVATE_OTHER_TENANT',metadata:{session_id:'s',scope:'tenant'},created_at:'2026-01-02'},
 ];
 const references=new Map<string,any>();let fail=false;
 const db=createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false},global:{fetch:async(input:any,init:any)=>{
  const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url),p=url.searchParams;
  if(fail)return Response.json({code:'ERROR',message:'fixture failure'},{status:503});
  if(url.pathname.endsWith('automotive_source_records')){
   if(request.method==='POST'){const value=await request.json();references.set(value.source_id+':'+value.source_key,{...value,id:'source'});return Response.json(null);}
   assert.equal(p.get('source_id'),'in.(nhtsa-recalls,nhtsa-complaints)');
   return Response.json([...references.values()]);
  }
  assert.ok(url.pathname.endsWith('microfixd_memory_records'));
  assert.equal(p.get('tenant_id'),'eq.a');
  const scope=JSON.parse(p.get('metadata')!.slice(3));
  assert.ok(scope.session_id==='s'||scope.scope==='tenant');
  const data=records.filter(r=>r.tenant_id==='a'&&Object.entries(scope).every(([k,v])=>r.metadata[k]===v)&&(!p.has('agent_id')||r.agent_id===p.get('agent_id')!.slice(3)));
  return Response.json(data);
 }}});
 return {db,records,references,setFail(value:boolean){fail=value;}};
}
const source={NHTSACampaignNumber:'fixture-1',Make:'BMW',Model:'335I',ModelYear:'2010',Summary:'Synthetic test recall; not a real vehicle instruction',Component:'fixture'};
const request:typeof fetch=async()=>Response.json({Count:1,results:[source]});

test('real LangGraph and LangChain retrieval connects stored context and source evidence while isolating private sessions and tenants',async()=>{
 const s=fixture();await importVehicleReferences(s.db,'recalls',{make:'BMW',model:'335I',modelYear:2010},request);
 const result=await storedContext(s.db,{tenant_id:'a',session_id:'s'},[],'BMW recalls',8000);
 assert.equal(result.window.retrieval_engine,'langgraph+langchain');
 assert.equal(result.window.vehicle_reference_records,1);
 assert.match(result.context,/older stored context/);assert.match(result.context,/explicitly shared context/);
 assert.match(result.context,/api.nhtsa.gov/);assert.match(result.context,/official_recall_record/);
 assert.ok(!result.context.includes('PRIVATE_OTHER_SESSION'));assert.ok(!result.context.includes('PRIVATE_OTHER_TENANT'));
 const small=await storedContext(s.db,{tenant_id:'a',session_id:'s'},[],'BMW recalls',200);
 assert.ok(small.context.length<=200);assert.ok(small.window.omitted>0);
 s.setFail(true);await assert.rejects(()=>storedContext(s.db,{tenant_id:'a',session_id:'s'},[],'BMW',8000),/READ_FAILED/);
});
test('NHTSA ingestion deduplicates campaign records, retains original source hash and rejects storage/provider failures',async()=>{
 const s=fixture();
 for(let i=0;i<2;i++)assert.equal((await importVehicleReferences(s.db,'recalls',{make:'BMW',model:'335I',modelYear:2010},request)).stored,1);
 assert.equal(s.references.size,1);
 const record=[...s.references.values()][0];assert.equal(record.content_sha256,sourceContentHash(source));
 record.payload=Object.fromEntries(Object.entries(record.payload).reverse());
 assert.equal((await searchVehicleReferences(s.db,'BMW')).references.length,1);
 record.payload.Summary='tampered';await assert.rejects(()=>searchVehicleReferences(s.db,'BMW'),/INVALID_REFERENCE_HASH/);
 const degraded=await storedContext(s.db,{tenant_id:'a',session_id:'s'},[],'BMW recalls',8000);
 assert.equal(degraded.degraded,true);assert.equal(degraded.window.vehicle_reference_status,'INVALID_REFERENCE_HASH');
 assert.match(degraded.context,/older stored context/);
 record.payload={...source};
 assert.deepEqual(record.payload,source);assert.ok(record.source_url.startsWith('https://api.nhtsa.gov/recalls/'));
 await assert.rejects(()=>importVehicleReferences(s.db,'recalls',{make:'BMW',model:'335I',modelYear:2010},async()=>new Response('',{status:503})),/NHTSA HTTP/);
 await assert.rejects(()=>searchVehicleReferences(s.db,'BMW',100),/INVALID_REFERENCE/);
 s.setFail(true);await assert.rejects(()=>importVehicleReferences(s.db,'recalls',{make:'BMW',model:'335I',modelYear:2010},request),/STORAGE_FAILED/);
 assert.ok(getTool('search_vehicle_references'));assert.ok(ENABLED_TOOLS.includes('search_vehicle_references'));assert.ok(READ_TOOLS.has('search_vehicle_references'));
});
