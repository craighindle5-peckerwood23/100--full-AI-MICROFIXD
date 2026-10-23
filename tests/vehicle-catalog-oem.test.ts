import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createAutoDevRouter} from '../server/automotive/integrations/autoDev';
import {createAutomotiveRouter} from '../server/automotive/automotiveRouter';
import {syncCatalog,importModels,modelsURL,CATALOG_SOURCE} from '../server/automotive/vehicleCatalog';
import {runOneIngestionJob} from '../server/automotive/ingestion-worker';
import {sourceContentHash} from '../server/automotive/nhtsa-ingestion';

test('OEM gateway preserves partial answers, missing fields and throttles; fails closed on config and malformed responses',async()=>{
 let key:string|undefined,reply:()=>Promise<Response>=async()=>new Response('{}');let calls=0;
 const app=express();app.use(createAutoDevRouter(async(url,options)=>{calls++;assert.equal(String(url),'https://api.auto.dev/build/1FTFW3LDXRFB40317');assert.equal(options?.redirect,'error');assert.equal((options?.headers as any).Authorization,'Bearer fixture-key');return reply();},()=>key));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${(server.address() as any).port}/build/`;
 try{
  assert.equal((await fetch(base+'bad')).status,400);assert.equal(calls,0);
  assert.equal((await fetch(base+'1FTFW3LDXRFB40317')).status,503);assert.equal(calls,0);key='fixture-key';
  const partial={vehicle:{make:'fixture'},build:null,catalog:{vinSpecific:false,availableOptions:[{code:'demo',name:'not installed proof'}]},reason:'no_build_record',retryable:false};
  reply=async()=>new Response(JSON.stringify(partial),{status:207});const res=await fetch(base+'1ftfw3ldxrfb40317');assert.equal(res.status,207);assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual(await res.json(),partial);
  const full={build:{vin:'1FTFW3LDXRFB40317',options:{}},missing:[{field:'exteriorColor',reason:'no_vin_record'}]};reply=async()=>new Response(JSON.stringify(full));assert.deepEqual(await (await fetch(base+'1FTFW3LDXRFB40317')).json(),full);
  for(const wrong of [{build:{vin:'AAAAAAAAAAAAAAAAA'}},{build:null,vehicle:{vin:'AAAAAAAAAAAAAAAAA'}},{build:{vin:'1FTFW3LDXRFB40317'},vehicle:{vin:'AAAAAAAAAAAAAAAAA'}}]){reply=async()=>new Response(JSON.stringify(wrong),{status:wrong.build===null?207:200});assert.equal((await fetch(base+'1FTFW3LDXRFB40317')).status,502);}
  reply=async()=>new Response('secret upstream details',{status:403});assert.deepEqual(await (await fetch(base+'1FTFW3LDXRFB40317')).json(),{error:'OEM_PROVIDER_ACCESS_UNAVAILABLE'});
  reply=async()=>new Response(JSON.stringify({error:{code:'RATE_LIMITED'}}),{status:429,headers:{'retry-after':'30'}});const limited=await fetch(base+'1FTFW3LDXRFB40317');assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'30');
  for(const body of ['not json','{"unrelated":true}','{"build":{}}']){reply=async()=>new Response(body,{status:body.includes('build')?207:200});assert.equal((await fetch(base+'1FTFW3LDXRFB40317')).status,502);}
  reply=async()=>{throw new DOMException('fixture','TimeoutError');};assert.equal((await fetch(base+'1FTFW3LDXRFB40317')).status,504);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('automotive OEM and catalog routes remain behind the existing auth and admin import boundaries',async()=>{
 const app=express();app.use(express.json());app.use((req:any,_res,next)=>{if(req.header('x-user')){req.microfixdTenantId='tenant-test';req.microfixdRole='operator';}next();});app.use(createAutomotiveRouter(()=>({} as any)));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{for(const path of ['/oem/build/1FTFW3LDXRFB40317','/catalog','/catalog/status'])assert.equal((await fetch(base+path)).status,403);
 assert.equal((await fetch(base+'/catalog/sync',{method:'POST',headers:{'x-user':'yes'}})).status,403);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
function fixture(){
 const tables=new Map<string,Map<string,any>>();let fail=false;const finished:any[]=[];let job:any;
 const db:any={from:(table:string)=>{
  const rows=tables.get(table)??new Map();tables.set(table,rows);
  const builder:any={upsert:async(values:any,opts:any)=>{if(fail)return {error:{code:'fixture'}};for(const value of Array.isArray(values)?values:[values]){const key=table==='vector_makes'?value.name.toLowerCase():table==='vector_models'?`${value.make_id}:${value.name}`:table==='automotive_sources'?value.id:`${value.source_id}:${value.source_key}`;if(!opts?.ignoreDuplicates||!rows.has(key))rows.set(key,{id:rows.get(key)?.id??'00000000-0000-4000-8000-000000000001',...value});}return {error:null};},select:()=>builder,eq:(_field:string,value:any)=>{builder.value=value;return builder;},single:async()=>({data:rows.get(builder.value),error:fail?{}:null}),update:()=>builder,lt:async()=>({error:fail?{}:null})};return builder;
 },rpc:async(name:string,args:any)=>name==='automotive_claim_job'?{data:job?[job]:[],error:null}:(finished.push(args),{data:true,error:null})};
 return {db,tables,finished,setFail:(value:boolean)=>fail=value,setJob:(value:any)=>job=value};
}
test('make sync and fenced model acquisition are idempotent, preserve source hashes, and reject wrong provider identities',async()=>{
 const f=fixture();const makes={Count:3,Results:[{Make_ID:1,Make_Name:'BMW'},{Make_ID:2,Make_Name:'bmw'},{Make_ID:3,Make_Name:'Honda'}]};
 const fetchMakes=async()=>new Response(JSON.stringify(makes));
 assert.equal((await syncCatalog(f.db,fetchMakes)).providerMakes,3);await syncCatalog(f.db,fetchMakes);
 assert.equal(f.tables.get('vector_makes')?.size,2);assert.equal(f.tables.get('automotive_ingestion_jobs')?.size,3);
 const key=JSON.stringify({makeId:1,makeName:'BMW'}),url=modelsURL(1);const rows={Count:2,Results:[{Make_ID:1,Model_ID:10,Model_Name:'335i'},{Make_ID:1,Model_ID:10,Model_Name:'335i'}]};
 const request=async()=>new Response(JSON.stringify(rows));await importModels(f.db,key,url,request);await importModels(f.db,key,url,request);assert.equal(f.tables.get('vector_models')?.size,1);
 const stored=f.tables.get('automotive_source_records')?.get(`${CATALOG_SOURCE}:1`);assert.equal(stored.content_sha256,sourceContentHash(stored.payload));
 await assert.rejects(()=>importModels(f.db,key,'https://example.test',request),/URL_MISMATCH/);
 await assert.rejects(()=>importModels(f.db,key,url,async()=>new Response(JSON.stringify({Count:1,Results:[{Make_ID:3,Model_ID:10,Model_Name:'bad'}]}))),/IDENTITY_MISMATCH/);
 f.setJob({id:'job',source_id:CATALOG_SOURCE,source_key:key,request_url:url,lease_token:'fenced-token'});
 assert.equal(await runOneIngestionJob(f.db,request),'completed');assert.equal(f.finished[0].p_token,'fenced-token');
 f.setFail(true);assert.equal(await runOneIngestionJob(f.db,request),'failed');assert.equal(f.finished[1].p_success,false);
 assert.throws(()=>modelsURL(-1));await assert.rejects(()=>syncCatalog(f.db,async()=>new Response('{"Count":5,"Results":[]}')),/INVALID_RESPONSE/);
});
