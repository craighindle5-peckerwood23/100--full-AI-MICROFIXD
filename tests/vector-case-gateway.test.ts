import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {vectorCaseGateway} from '../server/automotive/vectorCaseGateway';
test('authenticated gateway abstains without evidence and offers separate policy and challenge capabilities',async()=>{
 const app=express();app.use(express.json());const secret='test-credential'.repeat(3);app.use('/vector',vectorCaseGateway(secret));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();assert.ok(addr&&typeof addr!=='string');
 const url='http://127.0.0.1:'+addr.port+'/vector/analyze-case';
 const data={schema_version:'1',pipeline_version:'vector-case-1',organization_id:crypto.randomUUID(),case_id:crypto.randomUUID(),run_id:crypto.randomUUID(),revision:1,
 vehicle:{year:null,make:null,model:null,engine:null},complaint:'intermittent concern',safety_class:'standard',evidence:[],open_contradictions:[],completed_test_refs:[]};
 const send=(key:string,capability:string,body:unknown=data)=>fetch(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','x-vector-capability':capability},body:JSON.stringify(body)});
 try{
   assert.equal((await send('invalid','diagnostic')).status,401);
   const diagnostic=await send(secret,'diagnostic');assert.equal(diagnostic.status,200);assert.equal((await diagnostic.json()).abstain,true);
   assert.deepEqual(await (await send(secret,'policy')).json(),{run_id:data.run_id,flags:[]});
   assert.deepEqual(await (await send(secret,'challenge')).json(),{run_id:data.run_id,reasons:[]});
   assert.equal((await send(secret,'diagnostic',{...data,createEvidence:true})).status,422);
 }finally{server.closeAllConnections();server.close();}
});
