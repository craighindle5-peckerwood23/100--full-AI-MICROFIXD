import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {createCaseSchema,knowledgeSchema,actionSchema,type Vehicle,type Knowledge,type DiagnosticCase} from '../server/automotive/schemas';
import {retrieve} from '../server/automotive/driveiq/retriever';
import {transition} from '../server/automotive/torquelogic/stateMachine';
import {createCase,refreshEvidence} from '../server/automotive/workflows/diagnosticWorkflow';
import {AutomotiveRepository} from '../server/automotive/database/repository';
import {createAutomotiveRouter} from '../server/automotive/automotiveRouter';
import {decodeVIN} from '../server/automotive/integrations/vinDecoder';
import {safetyAlerts} from '../server/automotive/redline/safetyEngine';
import {selectTest} from '../server/automotive/torquelogic/testSelector';
// Synthetic logic fixture. Not OEM service instructions or a repair recommendation.
const vehicle:Vehicle={id:randomUUID(),year:2010,make:'BMW',model:'335i',engine:'fixture-engine'};
const evidence:Knowledge={id:randomUUID(),source:'https://example.com/synthetic-fixture',title:'Synthetic fixture',excerpt:'Test-only evidence',make:'BMW',model:'335i',engine:'fixture-engine',yearFrom:2010,yearTo:2010,dtcs:['P0300'],symptoms:['fixture symptom'],cause:'Synthetic cause',repair:'Synthetic repair',test:{id:'fixture-test',title:'Fixture test',procedure:'Synthetic procedure',expected:'Synthetic measurement',verification:'Repeat synthetic measurement',risk:'routine',minutes:5}};
function fixture(){return {id:randomUUID(),vehicle,complaint:'fixture symptom',dtcs:['P0300'],hazards:[],state:'testing',revision:0,hypotheses:[{id:randomUUID(),evidence,status:'untested',observations:[]}],alerts:[],events:[]} as DiagnosticCase;}
const parse=(value:unknown)=>actionSchema.parse(value);
test('DriveIQ requires exact engine and year fitment even when DTC matches',()=>{
 assert.equal(retrieve([evidence],vehicle,['P0300'],'').length,1);
 for(const v of [{...vehicle,engine:'other'}, {...vehicle,year:2011},{...vehicle,make:'Ford'}])assert.deepEqual(retrieve([evidence],v,['P0300'],''),[]);
 assert.deepEqual(retrieve([evidence],vehicle,['P0171'],'different complaint'),[]);
 assert.equal(knowledgeSchema.safeParse({...evidence,id:undefined}).success,false);
});
test('complete diagnostic loop requires observation, confirmed repair and verification',()=>{
 let c=fixture();const hypothesisId=c.hypotheses[0].id;
 assert.throws(()=>transition(c,parse({type:'repair',revision:0,hypothesisId,workPerformed:'work',technicianConfirmed:true}),'tech'),/SUPPORTED/);
 c=transition(c,parse({type:'observe',revision:0,hypothesisId,testId:'fixture-test',finding:'measurement',assessment:'supports'}),'tech');
 assert.equal(c.hypotheses[0].status,'supported');assert.equal(c.events.length,1);
 assert.equal(fixture().revision,0);
 c=transition(c,parse({type:'repair',revision:1,hypothesisId,workPerformed:'actual work',technicianConfirmed:true}),'tech');
 c=transition(c,parse({type:'verify',revision:2,finding:'measured after repair',complaintResolved:true,dtcsAbsent:true,testPassed:true,technicianConfirmed:true}),'tech');
 assert.equal(c.state,'verified');assert.equal(c.revision,3);assert.equal(c.events.length,3);
 assert.throws(()=>transition(c,parse({type:'verify',revision:3,finding:'repeat',complaintResolved:true,dtcsAbsent:true,testPassed:true,technicianConfirmed:true}),'tech'),/ALREADY_VERIFIED/);
});
test('conflicting findings, failed verification, safety holds and stale revisions cannot become success',()=>{
 let c=fixture();const hypothesisId=c.hypotheses[0].id;
 const observe=(revision:number,assessment:string)=>parse({type:'observe',revision,hypothesisId,testId:'fixture-test',finding:'measured',assessment});
 c=transition(c,observe(0,'supports'),'tech');
 assert.throws(()=>transition(c,observe(0,'supports'),'tech'),/REVISION/);
 c=transition(c,observe(1,'refutes'),'tech');assert.equal(c.hypotheses[0].status,'inconclusive');
 c=transition(c,observe(2,'supports'),'tech');assert.equal(c.hypotheses[0].status,'inconclusive');
 c=fixture();const h=c.hypotheses[0].id;c.hypotheses[0].status='supported';
 c=transition(c,parse({type:'repair',revision:0,hypothesisId:h,workPerformed:'work',technicianConfirmed:true}),'tech');
 c=transition(c,parse({type:'verify',revision:1,finding:'still fails',complaintResolved:false,dtcsAbsent:true,testPassed:true,technicianConfirmed:true}),'tech');
 assert.equal(c.state,'testing');assert.equal(c.hypotheses[0].status,'inconclusive');
 c.alerts=safetyAlerts('brakes fail',[]);assert.equal(selectTest(c),null);
 assert.throws(()=>transition(c,parse({type:'repair',revision:2,hypothesisId:h,workPerformed:'work',technicianConfirmed:true}),'tech'),/SAFETY_HOLD/);
});
test('unavailable knowledge does not invent diagnosis and can be refreshed after import',async()=>{
 let knowledge:Knowledge[]=[];let saved:DiagnosticCase;
 const repo={get:async()=>vehicle,knowledge:async()=>knowledge,insert:async(_kind:string,c:DiagnosticCase)=>saved=c,save:async(c:DiagnosticCase)=>saved=c} as unknown as AutomotiveRepository;
 const c=await createCase(repo,{vehicleId:vehicle.id,complaint:'fixture symptom',dtcs:['P0300']},'tech');
 assert.equal(c.state,'needs_evidence');assert.deepEqual(c.hypotheses,[]);
 knowledge=[evidence];const next=await refreshEvidence(repo,c,'tech');assert.equal(next.state,'testing');assert.equal(next.revision,1);
 assert.equal(createCaseSchema.safeParse({vehicleId:vehicle.id,complaint:'x',dtcs:['BAD']}).success,false);
});
test('repository applies tenant on reads, writes and compare-and-set updates',async()=>{
 const calls:any[]=[];const builder:any={then:(resolve:any)=>resolve({data:[{id:'x'}],error:null})};
 for(const method of ['select','eq','update','insert','order','limit','ilike'])builder[method]=(...args:any[])=>{calls.push([method,...args]);return builder;};
 builder.maybeSingle=async()=>({data:{data:vehicle},error:null});
 const db:any={from:(name:string)=>{calls.push(['from',name]);return builder;}};
 const repo=new AutomotiveRepository(db,'tenant-a');await repo.get('vehicle',vehicle.id);await repo.insert('vehicle',vehicle);await repo.save({...fixture(),revision:1},0);
 assert.equal(calls.filter(c=>c[0]==='eq'&&c[1]==='tenant_id'&&c[2]==='tenant-a').length,2);
 assert.equal(calls.find(c=>c[0]==='insert')[1].tenant_id,'tenant-a');
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='revision'&&c[2]===0));
});
test('VIN decoder rejects invalid, incomplete, and unavailable provider responses',async()=>{
 await assert.rejects(()=>decodeVIN('bad'),/INVALID/);
 await assert.rejects(()=>decodeVIN('WBAWB73519P047240',async()=>new Response(JSON.stringify({Results:[{ErrorCode:'1'}]}))),/INCOMPLETE/);
 await assert.rejects(()=>decodeVIN('WBAWB73519P047240',async()=>new Response('',{status:503})),/UNAVAILABLE/);
});
test('mounted API rejects anonymous, validates inputs, forbids non-admin imports, and hides database errors',async()=>{
 const app=express();app.use(express.json());let fail=false;
 app.use((req:any,_res,next)=>{if(req.header('x-test-user')){req.microfixdRole='operator';req.microfixdTenantId='tenant-a';}next();});
 app.use('/api/automotive',createAutomotiveRouter(()=>({list:async()=>{if(fail)throw new Error('AUTOMOTIVE_READ_FAILED');return [];}} as any)));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',()=>r()));const url=`http://127.0.0.1:${(server.address() as any).port}/api/automotive`;
 try{
  assert.equal((await fetch(url+'/vehicles')).status,403);
  assert.equal((await fetch(url+'/vehicles',{headers:{'x-test-user':'yes'}})).status,200);
  assert.equal((await fetch(url+'/vehicles',{method:'POST',headers:{'x-test-user':'yes','content-type':'application/json'},body:'{}'})).status,400);
  assert.equal((await fetch(url+'/knowledge',{method:'POST',headers:{'x-test-user':'yes','content-type':'application/json'},body:'{}'})).status,403);
  fail=true;assert.equal((await fetch(url+'/vehicles',{headers:{'x-test-user':'yes'}})).status,503);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
test('native automotive organ routing pins the verified tenant over hostile payloads',async()=>{
 const {dispatchOrgan}=await import('../server/organs/dispatch');
 const {EXECUTORS}=await import('../server/organs/executors');
 const original=EXECUTORS.vector_automotive;
 try{EXECUTORS.vector_automotive=async(_action,payload)=>payload;
 const result:any=await dispatchOrgan('vector_automotive','list',{tenant_id:'victim-tenant'},'verified-tenant');
 assert.equal(result.tenant_id,'verified-tenant');
 await assert.rejects(()=>dispatchOrgan('vector_automotive','list',{tenant_id:'victim'},''),/TENANT_REQUIRED/);
 }finally{EXECUTORS.vector_automotive=original;}
});
