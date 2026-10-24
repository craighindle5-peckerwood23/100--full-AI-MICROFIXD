import {projectMission} from './missionProjection';
import { Router } from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { validatePlan, validateSchema, createPlannerRuntime, plannerClient } from './supabaseRuntime';
import { getTool } from '../tools/toolRegistry';
import { ENABLED_TOOLS, systemCapabilities } from './governedTools';
import {canonicalJSON} from './executionSpine';
import type { Mission } from './executionSpine';
import {evaluateMission} from './evaluationEngine';
import {auditMission} from './missionAudit';
import {readMissionArtifact, loadMissionNotes} from './taskContinuity';
import {readWorkflowSkill,compileSkill,listWorkflowSkills} from './workflowSkills';
import {recoverWaitingRepairs} from '../engineering/repairRecovery';
export const plannerRouter=Router();
const uuid=(text:string)=>{const h=createHash('sha256').update(text).digest('hex').slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
plannerRouter.get('/capabilities',(_req,res)=>res.json(systemCapabilities()));
plannerRouter.get('/skills',async(req,res)=>{try{res.json(await listWorkflowSkills(plannerClient(),(req as any).microfixdTenantId));}catch{res.status(503).json({code:'SKILL_STORAGE_UNAVAILABLE'});}});
plannerRouter.get('/tools',(_req,res)=>res.json({tools:ENABLED_TOOLS.map(name=>getTool(name)).filter(Boolean)}));
export const submitMission:import('express').RequestHandler=async(req,res)=>{
 try{
  const tenant=(req as any).microfixdTenantId;
  const key=req.header('Idempotency-Key');
  if(!tenant||!key||key.length>200||typeof req.body.objective!=='string'||!req.body.objective.trim()||req.body.objective.length>16000)return res.status(400).json({code:'INVALID_MISSION'});
  if(req.body.deadline_at!==undefined&&(typeof req.body.deadline_at!=='string'||!Number.isFinite(Date.parse(req.body.deadline_at))||Date.parse(req.body.deadline_at)<=Date.now()))return res.status(400).json({code:'INVALID_DEADLINE'});
  const admin=(req as any).microfixdRole==='admin';
  const mission:Mission={mission_id:uuid(`${tenant}:${key}`),tenant_id:tenant,created_by:(req as any).microfixdUserId??'operator',created_at:new Date().toISOString(),objective:req.body.objective.trim(),constraints:{completion_policy:'objective-v1',tool_approval_mode:admin&&req.body.tool_approval_mode!=='manual'?'preauthorized':'manual',approval_actor:admin?((req as any).microfixdUserId??'admin'):null,...(req.body.deadline_at?{deadline_at:req.body.deadline_at}:{}),max_tokens:Number.isInteger(req.body.max_tokens)?Math.max(1,Math.min(100000,req.body.max_tokens)):32000,browser_origins:Array.isArray(req.body.browser_origins)?req.body.browser_origins.filter((v:unknown)=>{try{return typeof v==='string'&&new URL(v).origin===v&&v.startsWith('https://');}catch{return false;}}):[],tool_permissions:Array.isArray(req.body.tool_permissions)?req.body.tool_permissions.filter((t:unknown)=>typeof t==='string'&&ENABLED_TOOLS.includes(t)):[...ENABLED_TOOLS],...(req.body.plan?{plan:req.body.plan}:{})},status:'queued',result_artifact_id:null};
  if(req.body.skill_id!==undefined){
   if(req.body.plan||typeof req.body.skill_id!=='string'||typeof req.body.skill_revision!=='string'||!req.body.skill_inputs||typeof req.body.skill_inputs!=='object'||Array.isArray(req.body.skill_inputs))return res.status(400).json({code:'INVALID_SKILL_REQUEST'});
   try{const selected=await readWorkflowSkill(plannerClient(),tenant,req.body.skill_id,req.body.skill_revision);mission.constraints.plan=JSON.parse(JSON.stringify(compileSkill(selected.skill,req.body.skill_inputs,mission.constraints.tool_permissions as string[])));mission.constraints.workflow_skill={id:selected.skill.id,revision:selected.revision};}
   catch(error){return res.status(400).json({code:error instanceof Error?error.message:'INVALID_SKILL_REQUEST'});}
  }
  if(admin&&!(mission.constraints.browser_origins as string[]).length){
   const urls=[...mission.objective.matchAll(/https:\/\/[^\s<>"']+/g)].map(m=>m[0].replace(/[),.;!?]+$/,''));
   for(const task of Array.isArray(mission.constraints.plan)?mission.constraints.plan:[])for(const sub of Array.isArray((task as any)?.subtasks)?(task as any).subtasks:[])if(typeof sub.tool_request?.arguments?.url==='string')urls.push(sub.tool_request.arguments.url);
   mission.constraints.browser_origins=[...new Set(urls.flatMap(url=>{try{const parsed=new URL(url);return parsed.protocol==='https:'?[parsed.origin]:[];}catch{return [];}}))];
  }
  if(req.body.plan){try{validatePlan(req.body.plan,mission);}catch{return res.status(400).json({code:'INVALID_PLAN'});}}
  const client=plannerClient(),owner=randomUUID();
  const {data:claimed,error}=await client.rpc('spine_lease',{p_tenant:tenant,p_mission:mission.mission_id,p_owner:owner,p_release:false});
  if(error)throw error;
  if(claimed){try{const {error}=await client.rpc('spine_commit',{p_tenant:tenant,p_mission:mission.mission_id,p_owner:owner,p_operations:[{op:'insert',kind:'missions',id:mission.mission_id,data:mission}]});if(error)throw error;}finally{await client.rpc('spine_lease',{p_tenant:tenant,p_mission:mission.mission_id,p_owner:owner,p_release:true});}}
  const {data,error:readError}=await client.from('spine_rows').select('data').eq('tenant_id',tenant).eq('kind','missions').eq('id',mission.mission_id).single();
  if(readError)throw readError;
  if(data.data.objective!==mission.objective||canonicalJSON(data.data.constraints)!==canonicalJSON(mission.constraints))return res.status(409).json({code:'IDEMPOTENCY_CONFLICT'});
  res.status(202).json({...data.data,status_url:`/api/planner/missions/${mission.mission_id}`,...(res.locals.legacyMission?{run:projectMission(data.data),reply:'Mission queued; follow status_url for execution evidence.'}:{})});
 }catch{res.status(503).json({code:'PLANNER_STORAGE_UNAVAILABLE'});}
};
plannerRouter.post('/missions',submitMission);
plannerRouter.get('/missions/:id/artifacts/:artifact',async(req,res)=>{
 try{res.json(await readMissionArtifact(plannerClient(),(req as any).microfixdTenantId,req.params.id,
  {artifact_id:req.params.artifact,offset:req.query.offset===undefined?0:Number(req.query.offset),limit:req.query.limit===undefined?4000:Number(req.query.limit)}));}
 catch(error){const code=error instanceof Error?error.message:'';
  res.status(code==='INVALID_ARTIFACT_PAGE'?400:code==='ARTIFACT_NOT_FOUND'?404:code==='INVALID_ARTIFACT_EVIDENCE'?409:503).json({code:code.startsWith('CONTINUITY_STORAGE_ERROR')?'CONTINUITY_STORAGE_UNAVAILABLE':code||'CONTINUITY_UNAVAILABLE'});}
});
plannerRouter.get('/missions/:id/notes',async(req,res)=>{
 try{res.json({notes:await loadMissionNotes(plannerClient(),(req as any).microfixdTenantId,req.params.id)});}
 catch{res.status(503).json({code:'CONTINUITY_STORAGE_UNAVAILABLE'});}
});
plannerRouter.get('/missions',async(req,res)=>{
 try{const {data,error}=await plannerClient().from('spine_rows').select('data').eq('tenant_id',(req as any).microfixdTenantId).eq('kind','missions').order('sequence',{ascending:false}).limit(50);if(error)throw error;res.json({missions:data.map(r=>r.data)});}catch{res.status(503).json({code:'PLANNER_STORAGE_UNAVAILABLE'});}
});
plannerRouter.get(['/missions/:id/audit','/missions/:id/evaluation'],async(req,res)=>{
 try{const tenant=(req as any).microfixdTenantId;if(!tenant)return res.status(403).json({code:'AUTH_REQUIRED'});
 const {repository}=createPlannerRuntime(plannerClient(),tenant,req.params.id);
 const mission=await repository.getMission(req.params.id),tasks=await repository.getTasks(req.params.id);
 const subtasks=(await Promise.all(tasks.map(t=>repository.getSubtasks(t.task_id)))).flat();
 const artifacts=await repository.getArtifacts(req.params.id);
 res.json(req.path.endsWith('/evaluation')?evaluateMission(mission,tasks,subtasks,artifacts):auditMission(mission,tasks,subtasks,artifacts));
 }catch{res.status(503).json({code:'AUDIT_UNAVAILABLE'});}
});
plannerRouter.get('/missions/:id',async(req,res)=>{
 try{const tenant=(req as any).microfixdTenantId,client=plannerClient();const {repository}=createPlannerRuntime(client,tenant,req.params.id);
 const approvals=await client.from('spine_approvals').select('*').eq('tenant_id',tenant).eq('mission_id',req.params.id);
 const runs=await client.from('spine_tool_runs').select('*').eq('tenant_id',tenant).eq('mission_id',req.params.id);
 const messages=await client.from('spine_rows').select('data').eq('tenant_id',tenant).eq('mission_id',req.params.id).eq('kind','messages').order('sequence').limit(200);
 if(approvals.error||runs.error||messages.error)throw new Error('STORAGE_UNAVAILABLE');
 const errors=await client.from('spine_errors').select('code,subtask_id,attempt').eq('tenant_id',tenant).eq('mission_id',req.params.id).limit(50);if(errors.error)throw errors.error;
 const tasks=await repository.getTasks(req.params.id);const subtasks=(await Promise.all(tasks.map(t=>repository.getSubtasks(t.task_id)))).flat();
 const budget=await client.from('spine_budgets').select('reserved_tokens').eq('tenant_id',tenant).eq('mission_id',req.params.id).maybeSingle();
 if(budget.error)throw budget.error;
 res.json({errors:[...errors.data,...messages.data.filter(r=>r.data.content?.kind==='planning_error').map(r=>({code:r.data.content.code,stage:'planning'}))],completion_reviews:messages.data.filter(r=>r.data.content?.kind==='completion_review').map(r=>r.data.content),subtasks,budget:budget.data,mission:await repository.getMission(req.params.id),tasks:await repository.getTasks(req.params.id),artifacts:await repository.getArtifacts(req.params.id),approvals:approvals.data,tool_runs:runs.data,messages:messages.data.map(r=>r.data)});}catch{res.status(404).json({code:'MISSION_NOT_FOUND'});}
});
plannerRouter.post('/missions/:id/approvals/:subtask/decide',async(req,res)=>{
 if((req as any).microfixdRole!=='admin')return res.status(403).json({code:'ADMIN_REQUIRED'});
 if(!['approved','rejected'].includes(req.body.decision)||typeof req.body.request_hash!=='string')return res.status(400).json({code:'INVALID_DECISION'});
 try{const {error}=await plannerClient().rpc('spine_decide',{p_tenant:(req as any).microfixdTenantId,p_mission:req.params.id,p_subtask:req.params.subtask,p_hash:req.body.request_hash,p_decision:req.body.decision,p_actor:(req as any).microfixdUserId??'admin'});
 if(error)return res.status(409).json({code:'DECISION_CONFLICT'});res.json({success:true});}catch{res.status(503).json({code:'STORAGE_UNAVAILABLE'});}
});
plannerRouter.post('/missions/:id/approvals/:subtask/renew',async(req,res)=>{
 if((req as any).microfixdRole!=='admin')return res.status(403).json({code:'ADMIN_REQUIRED'});
 if(typeof req.body.request_hash!=='string')return res.status(400).json({code:'INVALID_HASH'});
 try{const {error}=await plannerClient().rpc('spine_renew_approval',{p_tenant:(req as any).microfixdTenantId,p_mission:req.params.id,p_subtask:req.params.subtask,p_hash:req.body.request_hash,p_actor:(req as any).microfixdUserId??'admin'});
 if(error)return res.status(409).json({code:'RENEWAL_CONFLICT'});res.json({success:true});}catch{res.status(503).json({code:'STORAGE_UNAVAILABLE'});}
});
plannerRouter.post('/missions/:id/resume',async(req,res)=>{
 if((req as any).microfixdRole!=='admin')return res.status(403).json({code:'ADMIN_REQUIRED'});
 if(!Number.isInteger(req.body.max_tokens)||req.body.max_tokens<1||req.body.max_tokens>100000)return res.status(400).json({code:'INVALID_BUDGET'});
 try{const {error}=await plannerClient().rpc('spine_resume',{p_tenant:(req as any).microfixdTenantId,p_mission:req.params.id,p_max_tokens:req.body.max_tokens,p_actor:(req as any).microfixdUserId??'admin'});
 if(error)return res.status(409).json({code:'RESUME_CONFLICT'});res.json({success:true});}catch{res.status(503).json({code:'STORAGE_UNAVAILABLE'});}
});
plannerRouter.post('/missions/:id/reconcile/:subtask',async(req,res)=>{
 if((req as any).microfixdRole!=='admin')return res.status(403).json({code:'ADMIN_REQUIRED'});
 try{const client=plannerClient(),tenant=(req as any).microfixdTenantId;
 const {data,error}=await client.from('spine_rows').select('data').eq('tenant_id',tenant).eq('mission_id',req.params.id).eq('kind','subtasks').eq('id',req.params.subtask).single();if(error)throw error;
 const {data:task,error:taskError}=await client.from('spine_rows').select('data').eq('tenant_id',tenant).eq('kind','tasks').eq('id',data.data.task_id).single();if(taskError)throw taskError;
 const result=req.body.result;
 if(!result||!validateSchema(result.normalized,task.data.expected_output_schema)||!result.evidence||typeof result.evidence.confirmation!=='string'||!result.evidence.confirmation.trim())return res.status(400).json({code:'VERIFIED_RESULT_REQUIRED'});
 const {error:failure}=await client.rpc('spine_reconcile',{p_tenant:tenant,p_mission:req.params.id,p_subtask:req.params.subtask,p_hash:req.body.request_hash,p_result:{...result,evidence:{...result.evidence,reconciled_by:(req as any).microfixdUserId??'admin'}},p_actor:(req as any).microfixdUserId??'admin'});if(failure)throw failure;
 res.json({success:true});}catch{res.status(409).json({code:'RECONCILIATION_CONFLICT'});}
});
plannerRouter.get('/agents',async(req,res)=>{
 try{const {data,error}=await plannerClient().from('spine_agents').select('*').eq('tenant_id',(req as any).microfixdTenantId);
 if(error)throw error;res.json({agents:data});}catch{res.status(503).json({code:'STORAGE_UNAVAILABLE'});}
});
export function startPlannerWorker():()=>void {
 let busy=false,stopped=false,cursor=0;
 const tick=async()=>{
  if(busy||stopped)return;busy=true;
  try{const client=plannerClient();try{await recoverWaitingRepairs(client);}catch{console.error('[repair] completion recovery deferred');}const {data,error}=await client.from('spine_rows').select('data,sequence').eq('kind','missions').in('data->>status',['queued','running']).gt('sequence',cursor).order('sequence').limit(10);
   if(error)throw error;
   if(!data.length)cursor=0;
   for(const row of data){if(stopped)break;cursor=Number(row.sequence);const m=row.data as Mission;try{await createPlannerRuntime(client,m.tenant_id,m.mission_id).planner.planAndExecuteMission(m);}catch(error){console.error('[planner] work deferred',error instanceof Error?error.message:'storage error');}}
  }catch{console.error('[planner] durable storage unavailable');}finally{busy=false;}
 };
 const timer=setInterval(()=>{void tick();},5000);void tick();
 return ()=>{stopped=true;clearInterval(timer);};
}
