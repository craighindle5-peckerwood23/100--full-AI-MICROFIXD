import type {SupabaseClient} from '@supabase/supabase-js';
import {recallProcedures} from '../memory/knowledgeMemory';
import {contentHash, type Mission, type Subtask} from './executionSpine';

export type Probe = 'approvals' | 'runs';
type Ledger = {status:string; expires_at?:string; consumed_at?:string|null};
type ReadProbe = (probe:Probe)=>Promise<Ledger|null>;

const findings = {
  approval: ['Operator approval is pending', 'Review the exact request in Mission Control.'],
  expired: ['The approval window expired', 'Review the request and renew its approval window in Mission Control.'],
  rejected: ['An operator rejected this request', 'Review the decision before changing the mission.'],
  reconcile: ['A tool started without a confirmed outcome', 'Inspect external evidence and reconcile the original action before any retry.'],
  budget: ['The worker recorded a token budget stop', 'Review the mission budget and prior usage before resuming.'],
  provider: ['The worker exhausted its available providers', 'Inspect provider health and quota before resuming.'],
  oversight: ['Metacognitive oversight intervened', 'Inspect the oversight decision and evidence in Mission Control.'],
  unknown: ['The available records do not identify the blocker', 'Inspect the execution trace and the most recent worker event.'],
  status: ['Mission status recorded', 'Open Mission Control for task progress and artifacts.'],
} as const;
export type Finding = keyof typeof findings;
export async function inspectBlocker(status:string, code:string, hasTool:boolean, read:ReadProbe, now=Date.now()) {
  const observations:string[] = [`Mission is ${status}.`];
  const hypotheses:string[]=[];
  if(code) observations.push(`Recorded stop: ${code}.`);
  const finish=(finding:Finding)=>({finding,title:findings[finding][0],next:findings[finding][1],observations,hypotheses});
  if(!['waiting','failed'].includes(status))return finish('status');
  if(hasTool){
    // An approval hint makes its ledger the cheapest discriminator. Otherwise
    // resolve the possibility of an already-started action first.
    const order:Probe[]=code==='WAITING_APPROVAL'?['approvals','runs']:['runs','approvals'];
    const predictions={approvals:'A pending or rejected approval would explain the pause.',runs:'An unfinished tool run would require reconciliation.'};
    hypotheses.push(...order.map(p=>predictions[p]));
    for(const probe of order){
      const row=await read(probe);
      observations.push(`${probe==='approvals'?'Approval':'Tool run'} for this request: ${row?.status??'no record'}.`);
      if(probe==='runs' && (row?.status==='uncertain'||row?.status==='running'))return finish('reconcile');
      if(probe==='approvals' && row && !row.consumed_at){
        if(row.status==='rejected')return finish('rejected');
        if(row.status==='pending')return finish(Date.parse(row.expires_at??'')<=now?'expired':'approval');
      }
    }
  }
  if(code==='TOKEN_BUDGET_EXHAUSTED')return finish('budget');
  if(code==='PROVIDERS_EXHAUSTED')return finish('provider');
  if(['METACOGNITIVE_HALT','METACOGNITIVE_ESCALATE','METACOGNITIVE_QUARANTINE'].includes(code))return finish('oversight');
  return finish('unknown');
}

export function matchingStep(content:string, sub:Subtask, allowed:unknown) {
  const request=sub.tool_request;
  if(!request||!Array.isArray(allowed)||!allowed.includes(request.name))return;
  const keys=Object.keys(request.arguments??{}).sort();
  try{
    const steps=JSON.parse(content).steps;
    if(!Array.isArray(steps))return;
    return steps.find(step=>step?.tool===request.name && typeof step.subtask_id==='string' &&
      typeof step.artifact_id==='string' && Array.isArray(step.argument_names) &&
      JSON.stringify([...step.argument_names].sort())===JSON.stringify(keys));
  }catch{return;}
}

export async function diagnoseMission(db:SupabaseClient,tenant:string,id:string,{includeHistory=true}={}){
  if(!tenant)throw new Error('AUTH_REQUIRED');
  const scoped=(table:string,fields:string,mission=id)=>db.from(table).select(fields).eq('tenant_id',tenant).eq('mission_id',mission);
  const missionRow=await scoped('spine_rows','data').eq('kind','missions').eq('id',id).maybeSingle();
  if(missionRow.error)throw missionRow.error;
  if(!missionRow.data)return null;
  const mission=(missionRow.data as unknown as {data:Mission}).data;
  let sub:Subtask|undefined,code='';
  if(['waiting','failed'].includes(mission.status)){
    const rows=await scoped('spine_rows','data').eq('kind','subtasks').in('data->>status',['waiting_input','failed']).order('sequence').limit(1);
    if(rows.error)throw rows.error;
    sub=(rows.data[0] as unknown as {data:Subtask}|undefined)?.data;
    if(sub){
      const error=await scoped('spine_errors','code').eq('subtask_id',sub.subtask_id).order('id',{ascending:false}).limit(1);
      if(error.error)throw error.error;
      code=String((error.data[0] as unknown as {code:string}|undefined)?.code??'');
    }else{
      const message=await scoped('spine_rows','data').eq('kind','messages').eq('data->content->>kind','planning_error').order('sequence',{ascending:false}).limit(1);
      if(message.error)throw message.error;
      code=String((message.data[0] as unknown as {data:{content:{code:string}}}|undefined)?.data.content.code??'');
      if(!code){
        // Older message IDs omitted the mission and could collide at insertion.
        // Recover the stop from this mission's immutable event, never another
        // mission's row sharing that ID.
        const event=await scoped('spine_events','operation').contains('operation',{op:'insert',kind:'messages',data:{content:{kind:'planning_error'}}}).order('id',{ascending:false}).limit(1);
        if(event.error)throw event.error;
        const value=(event.data?.[0] as any)?.operation?.data?.content?.code;
        if(typeof value==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(value))code=value;
      }
    }
  }
  const result=await inspectBlocker(mission.status,code,Boolean(sub?.tool_request),async probe=>{
    const approval=probe==='approvals';
    const row=await scoped(approval?'spine_approvals':'spine_tool_runs',approval?'status,expires_at,consumed_at':'status')
      .eq('subtask_id',sub!.subtask_id).eq('request_hash',contentHash(sub!.tool_request!)).maybeSingle();
    if(row.error)throw row.error;
    return row.data as unknown as Ledger|null;
  });
  const precedents:{missionId:string; artifactId:string; tool:string}[]=[];
  let memory:'checked'|'unavailable'|'skipped'='skipped';
  if(includeHistory && sub?.tool_request && code && result.finding!=='unknown'){
    try{
      const past=await recallProcedures(db,{tenant_id:tenant,session_id:id},String(sub.tool_request.name),3);
      for(const candidate of past.procedures){
        if(candidate.mission_id===id)continue;
        const step=matchingStep(candidate.content,sub,mission.constraints.tool_permissions);
        if(!step)continue;
        const prior=await scoped('spine_errors','code',candidate.mission_id).eq('subtask_id',step.subtask_id).eq('code',code).limit(1);
        if(prior.error)throw prior.error;
        if(prior.data.length)precedents.push({missionId:candidate.mission_id,artifactId:step.artifact_id,tool:step.tool});
      }
      memory='checked';
    }catch{memory='unavailable';}
  }
  return {...result,subtaskId:sub?.subtask_id??null,memory,precedents};
}
