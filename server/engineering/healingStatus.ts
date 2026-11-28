import type {SupabaseClient} from '@supabase/supabase-js';
import {repairPath,repairURL,repairIsReady} from './sourceRepair';

export function healingConfiguration() {
  let runnerValid=false;
  try {repairURL(process.env.MICROFIXD_REPAIR_RUNNER_URL??'');runnerValid=true;} catch {}
  return {configured:Boolean(process.env.GITHUB_TOKEN?.trim()&&runnerValid),
    automatic_enabled:process.env.MICROFIXD_AUTOMATIC_SOURCE_REPAIR==='1',
    policy:'bounded-source-repair-v1',limits:{per_hour:2,per_day:6},
    architecture:{repository:'craighindle5-peckerwood23/100--full-AI-MICROFIXD',
      controller:'main_application',sandbox:'isolated_verification_component',
      candidate_branch:'repair/candidate',separate_repository_required:false,
      production_revision:/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT??'')?process.env.RENDER_GIT_COMMIT:null},
    protects_architecture:true,requires_owner_preauthorization:true};
}

/** Construct an explicit mission, never execute a user-supplied script. */
export function healingMissionRequest(input:unknown) {
  const p=input as {objective?:unknown;paths?:unknown};
  if(!p||typeof p.objective!=='string'||!p.objective.trim()||p.objective.length>4000
    ||!Array.isArray(p.paths)||!p.paths.length||p.paths.length>8||new Set(p.paths).size!==p.paths.length)throw new Error('INVALID_REPAIR_REQUEST');
  if(!/Regression case: (tests\/[a-z0-9_-]+\.test\.ts)#([^\n]{1,220})/i.test(p.objective))throw new Error('REGRESSION_CASE_REQUIRED');
  for(const path of p.paths){if(typeof path!=='string')throw new Error('INVALID_REPAIR_REQUEST');repairPath(path);}
  return {objective:p.objective.trim(),tool_permissions:['repair_source_code'],tool_approval_mode:'preauthorized',
    max_tokens:24000,
    plan:[{agent_id:null,tool_permissions:['repair_source_code'],input_context:{},
      expected_output_schema:{type:'object',required:['result'],properties:{result:{type:'object'}},additionalProperties:false},
      subtasks:[{agent_id:null,input:{},tool_request:{name:'repair_source_code',arguments:{objective:p.objective.trim(),paths_json:JSON.stringify(p.paths)}}}]}]};
}

/** Same-tenant controller checkpoints, not simulated repair cards or memory assertions. */
export async function readHealingStatus(db:SupabaseClient,tenant:string) {
  if(!tenant?.trim())throw new Error('AUTH_REQUIRED');
  const signal=AbortSignal.timeout(10000);
  const {data,error}=await db.from('spine_rows').select('data').eq('tenant_id',tenant).eq('kind','missions')
    .contains('data',{constraints:{tool_permissions:['repair_source_code']}}).order('sequence',{ascending:false}).limit(50).abortSignal(signal);
  if(error)throw new Error('HEALING_STORAGE_UNAVAILABLE');
  const missions=(data??[]).map(row=>row.data).filter(m=>m.tenant_id===tenant
    &&Array.isArray(m.constraints?.plan)&&m.constraints.plan.some(t=>Array.isArray(t.subtasks)&&t.subtasks.some(s=>s.tool_request?.name==='repair_source_code')));
  const ids=missions.map(m=>m.mission_id);
  let events:any[]=[],errors:any[]=[];
  if(ids.length){
    const [checkpoints,stops]=await Promise.all([
      db.from('spine_events').select('id,mission_id,operation,created_at').eq('tenant_id',tenant).in('mission_id',ids)
        .contains('operation',{op:'repair_checkpoint'}).order('id',{ascending:false}).limit(200).abortSignal(signal),
      db.from('spine_errors').select('mission_id,code').eq('tenant_id',tenant).in('mission_id',ids).order('id',{ascending:false}).limit(100).abortSignal(signal)
    ]);
    if(checkpoints.error||stops.error)throw new Error('HEALING_STORAGE_UNAVAILABLE');
    events=checkpoints.data??[];errors=stops.data??[];
  }
  const phases=new Set(['candidate_created','sandbox_verified','promoted','live_verified','rollback_created','rollback_promoted','rollback_verified']);
  const repairs=missions.map(m=>{
    const checkpoints=events.filter(e=>e.mission_id===m.mission_id&&phases.has(e.operation?.phase));
    const candidate=checkpoints.find(e=>e.operation.phase==='candidate_created')?.operation.evidence?.candidate;
    const verified=checkpoints.find(e=>e.operation.phase==='live_verified'&&e.operation.evidence?.candidate===candidate&&repairIsReady(e.operation.evidence?.health,candidate));
    const rollback=checkpoints.find(e=>e.operation.phase==='rollback_verified'&&e.operation.evidence?.candidate===candidate
      &&/^[a-f0-9]{40}$/.test(e.operation.evidence?.rollback??'')&&repairIsReady(e.operation.evidence?.health,e.operation.evidence.rollback));
    const rollingBack=checkpoints.some(e=>e.operation.phase.startsWith('rollback_'));
    return {mission_id:m.mission_id,mission_status:m.status,phase:checkpoints[0]?.operation.phase??'queued',
      candidate:typeof candidate==='string'&&/^[a-f0-9]{40}$/.test(candidate)?candidate:null,
      healed:Boolean(verified&&!rollingBack&&m.status==='succeeded'),rolled_back:Boolean(rollback),
      recorded_live_verification:Boolean(verified),last_stop:errors.find(e=>e.mission_id===m.mission_id)?.code??null,
      status_url:`/api/planner/missions/${m.mission_id}`,created_at:m.created_at,
      checkpoints:checkpoints.map(e=>({phase:e.operation.phase,at:e.created_at}))};
  });
  return {...healingConfiguration(),can_request_repair:tenant===(process.env.MICROFIXD_REPAIR_OWNER_TENANT||'default'),
    repairs,source:'supabase_controller_ledger',mission_window_full:data?.length===50,
    checkpoint_window_full:events.length===200,limitations:['Recorded recovery is historical evidence, not a current health probe.','Source faults require a reproduced baseline failure; credentials, billing and protected architecture are not automatic source repairs.']};
}
