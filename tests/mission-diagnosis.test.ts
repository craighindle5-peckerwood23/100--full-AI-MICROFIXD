import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createClient} from '@supabase/supabase-js';
import {diagnoseMission,inspectBlocker,type Finding,type Probe} from '../server/planner/missionDiagnosis';
import {missionStatusSummary} from '../src/lib/missionStatusSummary';

type Case=[string,string,string,string,Finding];
const development:Case[]=[
  ['waiting','WAITING_APPROVAL','pending','','approval'],
  ['waiting','WAITING_APPROVAL','expired','','expired'],
  ['waiting','WAITING_APPROVAL','rejected','','rejected'],
  ['waiting','RECONCILIATION_REQUIRED','','uncertain','reconcile'],
  ['waiting','TOKEN_BUDGET_EXHAUSTED','','','budget'],
  ['waiting','PROVIDERS_EXHAUSTED','','','provider'],
  ['waiting','METACOGNITIVE_HALT','','','oversight'],
  ['failed','EXECUTION_ERROR','','','unknown'],
  ['running','','','','status'],
  ['waiting','WAITING_APPROVAL','approved','','unknown'],
];
const heldOut:Case[]=[
  ['failed','','expired','','expired'],
  ['waiting','WAITING_APPROVAL','approved','running','reconcile'],
  ['waiting','RECONCILIATION_REQUIRED','consumed','succeeded','unknown'],
  ['waiting','','rejected','','rejected'],
  ['waiting','','pending','','approval'],
  ['failed','PROVIDERS_EXHAUSTED','consumed','succeeded','provider'],
  ['waiting','METACOGNITIVE_QUARANTINE','','','oversight'],
  ['failed','TOKEN_BUDGET_EXHAUSTED','','','budget'],
  ['succeeded','RECONCILIATION_REQUIRED','','uncertain','status'],
  ['waiting','RECONCILIATION_REQUIRED','','running','reconcile'],
];
// Grade explicit discrimination of the state. Give the old summary credit for
// a recognizable worker code, even if it does not explain the operator action.
function gradeSummary(summary:string):Finding{
  if(summary.startsWith('Waiting for approval'))return 'approval';
  if(!/^Mission (paused|failed)/.test(summary))return 'status';
  if(summary.includes('TOKEN_BUDGET_EXHAUSTED'))return 'budget';
  if(summary.includes('PROVIDERS_EXHAUSTED'))return 'provider';
  if(summary.includes('METACOGNITIVE_'))return 'oversight';
  if(summary.includes('RECONCILIATION_REQUIRED'))return 'reconcile';
  if(summary.includes('WAITING_APPROVAL'))return 'approval';
  return 'unknown';
}
for(const [split,cases] of Object.entries({development,heldOut})){
  test(`${split} diagnostic replay`,async()=>{
    let baselineCorrect=0,candidateCorrect=0,probeCount=0;
    for(const [status,code,approval,run,expected] of cases){
      const probes:Probe[]=[];
      const a=approval?{status:approval==='expired'?'pending':approval==='consumed'?'approved':approval,
        consumed_at:approval==='consumed'?'2025-01-01':null,expires_at:approval==='expired'?'2020-01-01':'2030-01-01'}:null;
      const old=missionStatusSummary(status as Parameters<typeof missionStatusSummary>[0],a?[a]:[],code?[{code}]:[],[]);
      const result=await inspectBlocker(status,code,true,async probe=>{probes.push(probe);return probe==='approvals'?a:run?{status:run}:null;},Date.UTC(2026,0,1));
      assert.equal(result.finding,expected);
      assert.equal(new Set(probes).size,probes.length);
      assert.ok(probes.length<=2);
      baselineCorrect+=Number(gradeSummary(old)===expected);candidateCorrect++;probeCount+=probes.length;
    }
    console.log(JSON.stringify({split,cases:cases.length,baselineCorrect,candidateCorrect,targetedLedgerReads:probeCount,duplicateReads:0,modelCalls:0}));
  });
}
test('tenant-scoped storage reads select the current step and match only an artifact-backed prior stop',async()=>{
  const tenant='a',id='new', old='past', seen:string[]=[];
  const sub={subtask_id:'s',status:'waiting_input',tool_request:{name:'read_public_page',arguments:{url:'https://example.org'}}};
  const step={tool:'read_public_page',subtask_id:'old-s',artifact_id:'artifact',argument_names:['url']};
  let storedSteps:unknown[]=[step],priorCode='WAITING_APPROVAL',failure='',permission=true;
  const fetcher:typeof fetch=async input=>{
    const url=new URL(input instanceof Request?input.url:String(input)),q=url.searchParams,table=url.pathname.split('/').at(-1)!;
    const who=q.get('tenant_id');assert.ok(who==='eq.a'||who==='eq.b');seen.push(table);
    if(failure===table)return Response.json({message:'unavailable'},{status:500});
    const kind=q.get('kind'),mid=q.get('mission_id');
    let rows:unknown[]=[];
    if(who==='eq.a'){
      if(table==='spine_rows'&&kind==='eq.missions'&&mid==='eq.new')rows=[{data:{mission_id:id,tenant_id:tenant,status:'waiting',constraints:{tool_permissions:permission?['read_public_page']:[]}}}];
      else if(table==='spine_rows'&&kind==='eq.subtasks'&&mid==='eq.new')rows=[{data:sub}];
      else if(table==='spine_errors'&&mid==='eq.new'){assert.equal(q.get('subtask_id'),'eq.s');rows=[{code:'WAITING_APPROVAL'}];}
      else if(table==='spine_approvals'){assert.equal(mid,'eq.new');assert.equal(q.get('subtask_id'),'eq.s');assert.match(q.get('request_hash')!,/^eq\.[0-9a-f]{64}$/);rows=[{status:'pending',expires_at:'2030-01-01'}];}
      else if(table==='microfixd_memory_records')rows=[{id:'p',tenant_id:tenant,created_at:'2025-01-01',content:JSON.stringify({steps:storedSteps}),metadata:{version:'knowledge-v1',type:'procedure',scope:'tenant',mission_id:old,final_artifact_id:'f'}}];
      else if(table==='spine_rows'&&kind==='eq.missions'&&q.has('id'))rows=[{id:old,data:{tenant_id:tenant,status:'succeeded',result_artifact_id:'f'}}];
      else if(table==='spine_errors'&&mid==='eq.past'){assert.equal(q.get('subtask_id'),'eq.old-s');rows=q.get('code')==='eq.'+priorCode?[{code:priorCode}]:[];}
    }
    return Response.json(rows);
  };
  const db=createClient('https://fixture.supabase.co','fixture',{global:{fetch:fetcher}});
  assert.equal(await diagnoseMission(db,'b',id),null);assert.deepEqual(seen,['spine_rows']);
  const result=await diagnoseMission(db,tenant,id);assert.equal(result?.finding,'approval');assert.equal(result.precedents.length,1);
  priorCode='UNRELATED';assert.equal((await diagnoseMission(db,tenant,id))?.precedents.length,0);
  priorCode='WAITING_APPROVAL';permission=false;assert.equal((await diagnoseMission(db,tenant,id))?.precedents.length,0);
  permission=true;storedSteps=[{...step,subtask_id:undefined}];assert.equal((await diagnoseMission(db,tenant,id))?.precedents.length,0);
  failure='microfixd_memory_records';assert.equal((await diagnoseMission(db,tenant,id))?.memory,'unavailable');
  failure='spine_approvals';await assert.rejects(()=>diagnoseMission(db,tenant,id));
});
