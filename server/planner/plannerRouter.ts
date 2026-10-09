import { Router } from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { createPlannerRuntime, plannerClient } from './supabaseRuntime';
import type { Mission } from './executionSpine';
export const plannerRouter=Router();
const uuid=(text:string)=>{const h=createHash('sha256').update(text).digest('hex').slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
plannerRouter.post('/missions',async(req,res)=>{
 try{
  const tenant=(req as any).microfixdTenantId;
  const key=req.header('Idempotency-Key');
  if(!tenant||!key||key.length>200||typeof req.body.objective!=='string'||!req.body.objective.trim()||req.body.objective.length>16000)return res.status(400).json({code:'INVALID_MISSION'});
  const mission:Mission={mission_id:uuid(`${tenant}:${key}`),tenant_id:tenant,created_by:(req as any).microfixdUserId??'operator',created_at:new Date().toISOString(),objective:req.body.objective.trim(),constraints:{tool_permissions:[]},status:'queued',result_artifact_id:null};
  const client=plannerClient(),owner=randomUUID();
  const {data:claimed,error}=await client.rpc('spine_lease',{p_tenant:tenant,p_mission:mission.mission_id,p_owner:owner,p_release:false});
  if(error)throw error;
  if(claimed){try{const {error}=await client.rpc('spine_commit',{p_tenant:tenant,p_mission:mission.mission_id,p_owner:owner,p_operations:[{op:'insert',kind:'missions',id:mission.mission_id,data:mission}]});if(error)throw error;}finally{await client.rpc('spine_lease',{p_tenant:tenant,p_mission:mission.mission_id,p_owner:owner,p_release:true});}}
  const {data,error:readError}=await client.from('spine_rows').select('data').eq('tenant_id',tenant).eq('kind','missions').eq('id',mission.mission_id).single();
  if(readError)throw readError;
  if(data.data.objective!==mission.objective)return res.status(409).json({code:'IDEMPOTENCY_CONFLICT'});
  res.status(202).json(data.data);
 }catch{res.status(503).json({code:'PLANNER_STORAGE_UNAVAILABLE'});}
});
plannerRouter.get('/missions',async(req,res)=>{
 try{const {data,error}=await plannerClient().from('spine_rows').select('data').eq('tenant_id',(req as any).microfixdTenantId).eq('kind','missions').order('sequence',{ascending:false}).limit(50);if(error)throw error;res.json({missions:data.map(r=>r.data)});}catch{res.status(503).json({code:'PLANNER_STORAGE_UNAVAILABLE'});}
});
plannerRouter.get('/missions/:id',async(req,res)=>{
 try{const tenant=(req as any).microfixdTenantId;const {repository}=createPlannerRuntime(plannerClient(),tenant,req.params.id);res.json({mission:await repository.getMission(req.params.id),tasks:await repository.getTasks(req.params.id),artifacts:await repository.getArtifacts(req.params.id)});}catch{res.status(404).json({code:'MISSION_NOT_FOUND'});}
});
export function startPlannerWorker():()=>void {
 let busy=false,stopped=false;
 const tick=async()=>{
  if(busy||stopped)return;busy=true;
  try{const client=plannerClient();const {data,error}=await client.from('spine_rows').select('data').eq('kind','missions').in('data->>status',['queued','running']).order('sequence').limit(10);
   if(error)throw error;
   for(const row of data){if(stopped)break;const m=row.data as Mission;try{await createPlannerRuntime(client,m.tenant_id,m.mission_id).planner.planAndExecuteMission(m);}catch(error){console.error('[planner] work deferred',error instanceof Error?error.message:'storage error');}}
  }catch{console.error('[planner] durable storage unavailable');}finally{busy=false;}
 };
 const timer=setInterval(()=>{void tick();},5000);void tick();
 return ()=>{stopped=true;clearInterval(timer);};
}
