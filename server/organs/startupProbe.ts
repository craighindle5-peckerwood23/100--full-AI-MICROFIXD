import {randomUUID} from 'node:crypto';
import {dispatchOrgan} from './dispatch';
import {organRegistry} from './organRegistry';
import {probeCanary} from './probes';
export async function runStartupProbe(){
 const ids=organRegistry.all().map(o=>o.id),failures:string[]=[],lanes:Record<string,number>={};const start=performance.now();
 await Promise.all(Array.from({length:3},async(_,sweep)=>{
  const request_id=randomUUID();await Promise.all(ids.map(async id=>{try{const result=await dispatchOrgan(id,'probe',{request_id},'system-diagnostics') as any;
   if(result.value.organ!==id||result.value.request_id!==request_id||result.value.tenant_id!=='system-diagnostics')failures.push(`CORRELATION:${sweep}:${id}`);
   lanes[result.lane]=(lanes[result.lane]??0)+1;
  }catch{failures.push(`EXECUTION:${sweep}:${id}`);}}));
 }));
 const report={commit:process.env.RENDER_GIT_COMMIT??'local',probe_only:true,organs:ids.length,calls:ids.length*3,duration_ms:Math.round(performance.now()-start),lanes,canary:probeCanary.snapshot(),failures};
 console.log('[system-probe] '+JSON.stringify(report));return report;
}
