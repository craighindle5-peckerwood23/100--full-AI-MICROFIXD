import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const port=3199,token=randomUUID(),base=`http://127.0.0.1:${port}`;
const env={...process.env,PORT:String(port),ADMIN_TOKEN:token,SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',MICROFIXD_PROBE_CANARY_PERCENT:'50'};
const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{env,stdio:['ignore','ignore','ignore']});
const request=async(path,body)=>{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error(`HTTP_${response.status}:${path}`);return response.json();};
try{
 let ready=false;for(let i=0;i<100;i++){try{await request('/api/health');ready=true;break;}catch{if(server.exitCode!==null)throw Error('SERVER_EXITED');await new Promise(r=>setTimeout(r,100));}}if(!ready)throw Error('STARTUP_TIMEOUT');
 const {organs}=await request('/api/organs/all');const ids=organs.map(o=>o.id);const started=performance.now();
 const failures=[],lanes={stable:0,canary:0,fallback:0};
 const sweeps=await Promise.all(Array.from({length:3},async(_,i)=>{
 const request_id=randomUUID(),response=await request('/api/organs/batch',{calls:ids.map(id=>({id,action:'probe',payload:{request_id}}))});
 if(response.results.length!==ids.length)throw Error('MISSING_RESULTS');
 for(const result of response.results){const value=result.result?.value;if(!result.success||value?.organ!==result.id||value?.request_id!==request_id||value?.tenant_id!=='default')failures.push({organ:result.id,sweep:i,code:'CORRELATION_OR_EXECUTION_FAILURE'});else lanes[result.result.lane]++;}
 return {sweep:i,calls:response.results.length};
 }));
 const request_id=randomUUID(),broadcast=await request('/api/organs/broadcast',{organ_ids:ids,action:'probe',payload:{request_id}});
 if(!broadcast.success||broadcast.results.length!==ids.length||broadcast.results.some(r=>r.result?.value?.request_id!==request_id))failures.push({code:'BROADCAST_ROUTING_FAILURE'});
 const mixed=await request('/api/organs/batch',{calls:[{id:ids[0],action:'probe',payload:{request_id:'fault-check'}},{id:'__missing_organ__',action:'probe',payload:{request_id:'fault-check'}}]});
 const failure_isolation=!mixed.success&&mixed.results[0].success&&!mixed.results[1].success;
 if(!failure_isolation)failures.push({code:'FAILURE_ISOLATION_BROKEN'});
 await request('/api/organs/'+ids[0]+'/isolate',{});
 const isolated=await request('/api/organs/batch',{calls:[{id:ids[0],action:'probe',payload:{request_id:'isolated'}},{id:ids[1],action:'probe',payload:{request_id:'isolated'}}]});
 const isolation_enforced=!isolated.success&&!isolated.results[0].success&&isolated.results[1].success;
 if(!isolation_enforced)failures.push({code:'ISOLATION_NOT_ENFORCED'});
 await request('/api/organs/'+ids[0]+'/reset',{});
 const final=await request('/api/organs/all');if(final.organs.some(o=>o.status==='busy'))failures.push({code:'BUSY_STATE_LEAK'});
 const loaded=await request('/api/organs/load-all',{request_id:randomUUID()});
 const native=loaded.results.filter(r=>r.result?.value?.native_executor).length;
 const report={environment:'local HTTP; external integrations disabled',probe_only:true,capability_execution_verified:false,organs:ids.length,concurrent_sweeps:sweeps,total_probe_calls:ids.length*5+4,fault_checks:{failure_isolation,isolation_enforced},native_executors:native,without_explicit_executor:ids.length-native,duration_ms:Math.round(performance.now()-started),lanes,canary:await request('/api/organs/probe-canary'),failures};
 writeFileSync('docs/system-probe-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
}finally{server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(server.exitCode===null)server.kill('SIGKILL');}
