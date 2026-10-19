import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {obdSampleSchema,type OBDSample,type OBDSession} from '../server/automotive/obd/schema';
import {interpretSample,sessionView} from '../server/automotive/obd/interpreter';
import {createOBDRouter} from '../server/automotive/obd/obdRouter';
import {OBDRepository} from '../server/automotive/obd/repository';
const sample=(responses:OBDSample['responses']):OBDSample=>({sequence:1,observedAt:new Date().toISOString(),status:'connected',protocol:'ISO15765-11bit-500000',adapterVersion:'fixture',responses,errors:[]});
test('OBD decodes real-format responses by ECU without inventing missing measurements',()=>{
 const result=interpretSample(sample([{command:'010C',ecu:'7E8',payload:'410C1AF8'},{command:'0105',ecu:'7E8',payload:'41057B'},{command:'0101',ecu:'7E8',payload:'410181000000'},{command:'03',ecu:'7E8',payload:'43010133'},{command:'03',ecu:'7E9',payload:'4301C123'},{command:'0902',ecu:'7E8',payload:'490201'+Buffer.from('WBAWB73519P047240').toString('hex').toUpperCase()}]));
 assert.equal(result.readings.find(r=>r.name==='rpm')?.value,1726);
 assert.equal(result.readings.find(r=>r.name==='coolant')?.value,83);
 assert.equal(result.readings.find(r=>r.name==='speed'),undefined);
 assert.equal(result.vin,'WBAWB73519P047240');assert.equal(result.monitors[0].mil,true);
 assert.deepEqual(result.dtcs.map(d=>[d.ecu,d.code]),[['7E8','P0133'],['7E9','U0123']]);
});
test('CAN count is protocol-specific; malformed, negative and mismatched PID replies are unknown',()=>{
 const result=interpretSample(sample([{command:'03',payload:'43020133'},{command:'010C',payload:'41051A'},{command:'0105',payload:'7F0112'}]));
 assert.equal(result.validResponses,0);assert.equal(result.dtcs.length,0);assert.equal(result.readings.length,0);
 const legacy=sample([{command:'03',payload:'43013300000000'}]);legacy.protocol='A3';assert.equal(interpretSample(legacy).dtcs[0].code,'P0133');
 assert.equal(obdSampleSchema.safeParse({...sample([]),responses:[{command:'04',payload:''}]}).success,false);
 assert.equal(obdSampleSchema.safeParse({...sample([]),responses:[{command:'010C',payload:'41G0'}]}).success,false);
});
test('disagreement between VINs cannot silently identify a vehicle',()=>{
 const result=interpretSample(sample(['WBAWB73519P047240','WBAWB73519P047241'].map(v=>({command:'0902' as const,payload:'490201'+Buffer.from(v).toString('hex').toUpperCase()}))));
 assert.equal(result.vin,null);assert.equal(result.vinConflict,true);
});
test('disconnected, stale, empty and delayed PID data cannot be reported as live running engine',()=>{
 const now=Date.now(),receivedAt=new Date(now).toISOString();
 const session:OBDSession={id:'00000000-0000-4000-8000-000000000001',adapter:'j2534',label:'fixture',owner:'tech',createdAt:receivedAt,sequence:1,receivedAt,latest:sample([{command:'010C',payload:'410C1AF8'}]),history:[]};
 assert.equal(sessionView(session,now).understanding.engineRunning,true);
 assert.equal(sessionView(session,now+21000).state,'stale');assert.equal(sessionView(session,now+21000).understanding.engineRunning,null);
 assert.equal(sessionView({...session,latest:sample([])},now).state,'vehicle_not_responding');
 const cached={...session,latest:sample([{command:'03',payload:'4300'}]),queries:[{command:'010C',receivedAt:new Date(now-31000).toISOString(),responses:session.latest!.responses}]};
 assert.equal(sessionView(cached,now).understanding.engineRunning,null);
});
test('OBD API enforces tenant, uploader identity, monotonic uploads, retry idempotency and clock bounds',async()=>{
 const records=new Map<string,OBDSession>();
 const factory=(tenant:string)=>({list:async()=>[...records].filter(([key])=>key.startsWith(tenant+':')).map(([,v])=>v),create:async(s:OBDSession)=>{records.set(tenant+':'+s.id,s);return s;},get:async(id:string)=>{const s=records.get(tenant+':'+id);if(!s)throw Error('NOT_FOUND');return s;},save:async(s:OBDSession,previous:number)=>{if(records.get(tenant+':'+s.id)?.sequence!==previous)throw Error('REVISION_CONFLICT');records.set(tenant+':'+s.id,s);return s;}} as unknown as OBDRepository);
 const app=express();app.use(express.json());app.use((req:any,_res,next)=>{if(req.header('x-user')){req.microfixdRole=req.header('x-role')||'operator';req.microfixdTenantId=req.header('x-tenant')||'a';req.microfixdUserId=req.header('x-user');}next();});app.use('/obd',createOBDRouter(factory));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',()=>r()));const base=`http://127.0.0.1:${(server.address() as any).port}/obd`;
 const request=(path:string,body?:unknown,headers:Record<string,string>={})=>fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-user':'owner',...headers},body:body?JSON.stringify(body):undefined});
 try{
 assert.equal((await fetch(base+'/sessions')).status,403);
 assert.equal((await request('/sessions',{adapter:'j2534',label:'test'},{'x-role':'observer'})).status,403);
 const created=await (await request('/sessions',{adapter:'j2534',label:'test'})).json();assert.equal(created.state,'waiting_for_bridge');
 const s=sample([{command:'010C',payload:'410C1AF8'}]);const path=`/sessions/${created.id}/samples`;
 assert.equal((await request(path,s,{'x-user':'different-user'})).status,403);
 assert.equal((await request(path,s,{'x-tenant':'b'})).status,404);
 assert.equal((await request(path,{...s,observedAt:'2000-01-01T00:00:00.000Z'})).status,422);
 assert.equal((await request(path,s)).status,200);assert.equal((await request(path,s)).status,200);
 assert.equal((await request(path,{...s,responses:[]})).status,409);
 assert.equal((await request(path,{...s,sequence:3})).status,409);
 const next=sample([{command:'03',payload:'43010133'}]);next.sequence=2;
 const result=await (await request(path,next)).json();assert.equal(result.understanding.engineRunning,true);assert.equal(result.interpreted.dtcs[0].code,'P0133');
 const other=await (await request('/sessions',undefined,{'x-tenant':'b'})).json();assert.deepEqual(other,[]);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
test('live diagnostic case captures session provenance and rejects stale or mismatched vehicles',async()=>{
 const {createCaseFromOBD}=await import('../server/automotive/obd/caseWorkflow');
 const id='00000000-0000-4000-8000-000000000001',vehicleId='00000000-0000-4000-8000-000000000002';
 const vehicle={id:vehicleId,vin:'WBAWB73519P047240',year:2010,make:'BMW',model:'335i',engine:'fixture-engine'};
 let latest=sample([{command:'03',payload:'43010133'},{command:'0902',payload:'490201'+Buffer.from(vehicle.vin).toString('hex').toUpperCase()}]);
 const session:OBDSession={id,adapter:'j2534',label:'test',owner:'owner',createdAt:new Date().toISOString(),receivedAt:new Date().toISOString(),sequence:1,latest,history:[]};
 const obd={get:async()=>session} as unknown as OBDRepository;
 const repo={get:async()=>vehicle,knowledge:async()=>[],insert:async(_kind:any,data:any)=>data} as any;
 const args={obdSessionId:id,vehicleId,complaint:'Actual complaint',identityConfirmed:true};
 const result=await createCaseFromOBD(repo,obd,args,'technician');
 assert.deepEqual(result.dtcs,['P0133']);assert.equal(result.source?.id,id);assert.equal(result.source?.sequence,1);assert.equal(result.state,'needs_evidence');
 session.receivedAt='2000-01-01T00:00:00.000Z';await assert.rejects(()=>createCaseFromOBD(repo,obd,args,'tech'),/LIVE_OBD_SESSION/);
 session.receivedAt=new Date().toISOString();vehicle.vin='WBAWB73519P047241';await assert.rejects(()=>createCaseFromOBD(repo,obd,args,'tech'),/VIN_MISMATCH/);
});
