import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {analyzeVectorCase,vectorCaseGateway} from '../server/automotive/vectorCaseGateway';
const vehicle = {year:2012,make:'Test',model:'Bench',engine:'Fixture'};
function observed(code:string) {
 return {id:crypto.randomUUID(),type:'dtc',title:'Observed code',dtc:code,source_id:crypto.randomUUID(),knowledge:null};
}
function procedure(code:string,cause:string,minutes=10,risk='routine') {
 return {id:crypto.randomUUID(),type:'reference',title:'Published procedure',dtc:null,source_id:crypto.randomUUID(),knowledge:{
   source:'https://example.com/service',title:'Fixture',excerpt:'Service reference',make:vehicle.make,model:vehicle.model,engine:vehicle.engine,
   yearFrom:2010,yearTo:2014,dtcs:[code],symptoms:[],cause,repair:'See reference',
   test:{id:'bench-test',title:'Fixture test',procedure:'Bench check',expected:'Reference value',verification:'Record result',minutes,risk}
 }};
}
function caseInput(evidence:unknown[],completed_test_refs:string[]=[]) {
 return {schema_version:'1',pipeline_version:'vector-case-1',organization_id:crypto.randomUUID(),case_id:crypto.randomUUID(),run_id:crypto.randomUUID(),revision:1,
   vehicle,complaint:'Intermittent concern',safety_class:'standard',evidence,open_contradictions:[],completed_test_refs};
}
test('eligible tests across the full input compete for the twenty available proposals',()=>{
 const observedCode=observed('P0300');
 const completed=procedure('P0300','Completed',1);
 const specialists=Array.from({length:20},()=>procedure('P0300','Specialist',1,'specialist'));
 const slow=Array.from({length:20},()=>procedure('P0300','Slow',60));
 const fast=procedure('P0300','Fast',1);
 const evidence=[observedCode,...specialists,completed,...slow,fast];
 for(const order of [evidence,[...evidence].reverse()]){
  const output=analyzeVectorCase(caseInput(order,[completed.id]));
  assert.equal(output.proposals.length,20);
  assert.equal(output.proposals[0].reference_id,fast.id);
  assert.deepEqual(output.proposals[0].supporting_evidence,[observedCode.id]);
  assert.ok(output.proposals.every(p=>p.reference_id===fast.id || slow.some(item=>item.id===p.reference_id)));
 }
});
test('authenticated gateway abstains without evidence and offers separate policy and challenge capabilities',async()=>{
 const app=express();app.use(express.json());const secret='test-credential'.repeat(3);app.use('/vector',vectorCaseGateway(secret));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();assert.ok(addr&&typeof addr!=='string');
 const url='http://127.0.0.1:'+addr.port+'/vector/analyze-case';
 const data={schema_version:'1',pipeline_version:'vector-case-1',organization_id:crypto.randomUUID(),case_id:crypto.randomUUID(),run_id:crypto.randomUUID(),revision:1,
 vehicle:{year:null,make:null,model:null,engine:null},complaint:'intermittent concern',safety_class:'standard',evidence:[],open_contradictions:[],completed_test_refs:[]};
 const send=(key:string,capability:string,body:unknown=data)=>fetch(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','x-vector-capability':capability},body:JSON.stringify(body)});
 try{
   assert.equal((await send('invalid','diagnostic')).status,401);
   const diagnostic=await send(secret,'diagnostic');assert.equal(diagnostic.status,200);assert.equal(diagnostic.headers.get('x-vector-model-version'),'microfixd-case-ranking-1.1.0');assert.equal((await diagnostic.json()).abstain,true);
   assert.deepEqual(await (await send(secret,'policy')).json(),{run_id:data.run_id,flags:[]});
   assert.deepEqual(await (await send(secret,'challenge')).json(),{run_id:data.run_id,reasons:[]});
   assert.equal((await send(secret,'diagnostic',{...data,createEvidence:true})).status,422);
   const evidence=[observed('P0300'),observed('P0420'),procedure('P0300','Cause A'),procedure('P0420','Cause B')];
   const challenge=async(items:unknown[])=>{
    const response=await send(secret,'challenge',caseInput(items));
    assert.equal(response.status,200);
    return (await response.json()).reasons;
   };
   assert.deepEqual(await challenge(evidence),[]);
   assert.deepEqual(await challenge([...evidence,procedure('P0300','Cause A')]),[]);
   assert.equal((await challenge([...evidence,procedure('P0300','Cause C')])).length,1);
 }finally{server.closeAllConnections();server.close();}
});
test('compounded case experience is tenant-scoped ranking context and cannot invent evidence or verify a repair',()=>{
 const code=observed('P0300'),a=procedure('P0300','Cause A'),b=procedure('P0300','Cause B');
 a.id='00000000-0000-4000-8000-000000000001';b.id='ffffffff-ffff-4fff-8fff-ffffffffffff';
 const s=caseInput([code,a,b]);
 const unit={unitId:crypto.randomUUID(),tenantId:s.organization_id,caseId:crypto.randomUUID(),version:1,generation:2,parentUnitIds:[crypto.randomUUID()],approvedBy:crypto.randomUUID(),verificationId:crypto.randomUUID(),evaluationVersion:'case-regression-1',vehicle,dtcs:['P0300'],rootCause:'Cause B'};
 assert.equal(analyzeVectorCase(s).proposals[0].reference_id,a.id);
 const result=analyzeVectorCase({...s,learning_context:[unit]});assert.equal(result.proposals[0].reference_id,b.id);
 assert.ok(result.proposals.every(p=>p.grade==='plausible'&&p.supporting_evidence.includes(code.id)));
 assert.equal(analyzeVectorCase({...s,evidence:[code,a],learning_context:[unit]}).proposals[0].reference_id,a.id);
 assert.equal(analyzeVectorCase({...s,evidence:[a,b],learning_context:[unit]}).abstain,true);
 assert.throws(()=>analyzeVectorCase({...s,learning_context:[{...unit,tenantId:crypto.randomUUID()}]}),/scope mismatch/);
 assert.throws(()=>analyzeVectorCase({...s,learning_context:[{...unit,caseId:s.case_id}]}),/scope mismatch/);
});
