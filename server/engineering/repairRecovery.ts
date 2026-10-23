import type {SupabaseClient} from '@supabase/supabase-js';
import {repairPath,repairURL} from './sourceRepair';

/** Observe an already-promoted repair after a process restart. Never replay an external write. */
export async function readCompletedRepair(db:SupabaseClient,scope:{tenant:string;mission:string;subtask:string},fetcher:typeof fetch=fetch){
 if(!process.env.MICROFIXD_REPAIR_RUNNER_URL||!process.env.GITHUB_TOKEN)return null;
 // Only controller-written immutable events can establish a candidate. Ordinary
 // model/user knowledge assertions are context, never authority for recovery.
 const {data,error}=await db.from('spine_events').select('operation').eq('tenant_id',scope.tenant).eq('mission_id',scope.mission)
  .contains('operation',{op:'repair_checkpoint',subtask_id:scope.subtask,phase:'candidate_created'}).limit(2);
 if(error)throw new Error('REPAIR_RECOVERY_STORAGE_FAILED');if(data?.length!==1)return null;
 const entry=data[0].operation,candidate=entry.evidence?.candidate,files=entry.evidence?.files;
 if(entry.phase!=='candidate_created'||typeof candidate!=='string'||!/^[a-f0-9]{40}$/.test(candidate)||!Array.isArray(files)||!files.length||files.length>8)return null;
 for(const file of files){repairPath(file.path);if(!/^[a-f0-9]{64}$/.test(file.after))return null;}
 const runner=repairURL(process.env.MICROFIXD_REPAIR_RUNNER_URL);
 const read=async(url:string,headers?:Record<string,string>)=>{const response=await fetcher(url,{redirect:'error',cache:'no-store',headers,signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('REPAIR_RECOVERY_DEPENDENCY_UNAVAILABLE');return response.json();};
 const main=await read('https://api.github.com/repos/craighindle5-peckerwood23/100--full-AI-MICROFIXD/git/ref/heads/main',{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'});
 if(main.object?.sha!==candidate)return null;
 const receipt=await read(`${runner}/verification`);
 if(receipt.commit!==candidate||receipt.status!=='verified'||receipt.network!=='none'||receipt.productionSecrets!==false||receipt.gate!=='production+engineering+adapters')return null;
 const health=await read('https://microfixd-full-ai.onrender.com/api/health');
 if(health.commit!==candidate)return null;
 return {status:'live_verified',commit:candidate,files:files.map(file=>file.path),sandbox:receipt,recovery:'read_only_observation'};
}
export function repairRecoveryResult(raw:NonNullable<Awaited<ReturnType<typeof readCompletedRepair>>>,tenant:string,subtask:string,requestHash:string){
 return {raw,normalized:{result:raw},evidence:{tool:'repair_source_code',request_hash:requestHash,idempotency_key:`${tenant}:${subtask}`,read_only_recovery:true,completed_at:new Date().toISOString()}};
}
export async function recoverWaitingRepairs(db:SupabaseClient){
 if(!process.env.MICROFIXD_REPAIR_RUNNER_URL||!process.env.GITHUB_TOKEN)return;
 const tenant=process.env.MICROFIXD_REPAIR_OWNER_TENANT||'default';
 const {data,error}=await db.from('spine_rows').select('data').eq('tenant_id',tenant).eq('kind','missions').eq('data->>status','waiting')
  .contains('data',{constraints:{tool_approval_mode:'preauthorized',tool_permissions:['repair_source_code']}}).limit(4);
 if(error)throw new Error('REPAIR_RECOVERY_STORAGE_FAILED');
 for(const row of data??[]){
  const mission=row.data;if(!mission.constraints?.approval_actor)continue;
  const {data:runs,error:runError}=await db.from('spine_tool_runs').select('subtask_id,request_hash').eq('tenant_id',tenant).eq('mission_id',mission.mission_id).eq('request->>name','repair_source_code').in('status',['running','uncertain']).limit(1);
  if(runError)continue;
  for(const run of runs??[])try{
   const raw=await readCompletedRepair(db,{tenant,mission:mission.mission_id,subtask:run.subtask_id});if(!raw)continue;
   const result=repairRecoveryResult(raw,tenant,run.subtask_id,run.request_hash);
   const {error:failure}=await db.rpc('spine_reconcile',{p_tenant:tenant,p_mission:mission.mission_id,p_subtask:run.subtask_id,p_hash:run.request_hash,p_result:result,p_actor:'verified-render-recovery'});
   if(failure)console.error('[repair] verified completion deferred; mission lease or state changed');
  }catch{console.error('[repair] completion observation unavailable; no external action repeated');}
 }
}
