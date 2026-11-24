import type {SupabaseClient} from '@supabase/supabase-js';

export function asksForMissionReview(task:string){
  return /^(?:review|summarize|show)(?: me)? (?:my |our |the )?(?:recent mission performance|mission performance|mission outcomes)[.!?]*$/i.test(task.trim());
}

/** Rebuild the legacy introspection report from durable tenant records. */
export async function reviewMissionPerformance(db:SupabaseClient,tenant:string){
  if(!tenant)throw new Error('Sign in to read mission performance.');
  const snapshot=await db.from('spine_rows').select('id,status:data->>status')
    .eq('tenant_id',tenant).eq('kind','missions').order('sequence',{ascending:false}).limit(50);
  if(snapshot.error)throw new Error('Mission outcomes could not be read.');
  const rows=snapshot.data;
  if(!rows.length)return {output:'There are no recorded missions in your workspace yet.',missions:[]};
  const ids=rows.map(row=>row.id);
  const [errors,calls,repairs]=await Promise.all([
    db.from('spine_errors').select('mission_id,code').eq('tenant_id',tenant).in('mission_id',ids).order('id',{ascending:false}).limit(100),
    db.from('spine_model_runs').select('run_id',{count:'exact',head:true}).eq('tenant_id',tenant).in('mission_id',ids),
    db.from('spine_events').select('mission_id').eq('tenant_id',tenant).in('mission_id',ids)
      .contains('operation',{op:'repair_checkpoint',phase:'live_verified'}).limit(100),
  ]);
  const statuses=new Map<string,number>();
  for(const row of rows){const status=String(row.status);statuses.set(status,(statuses.get(status)??0)+1);}
  const summary=[...statuses].map(([status,n])=>`${n} ${status}`).join(', ');
  const lines=[`Latest ${rows.length} missions by creation order: ${summary}.`];
  if(errors.error)lines.push('Failure history unavailable.');
  else{
    const affected=new Map<string,Set<string>>();
    for(const row of errors.data){const ids=affected.get(row.code)??new Set<string>();ids.add(row.mission_id);affected.set(row.code,ids);}
    const ranked=[...affected].sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0])).slice(0,3);
    lines.push(ranked.length?'Most frequent recorded stops in the latest '+errors.data.length+' error records: '+ranked.map(([code,ids])=>`${code} (${ids.size} distinct missions)`).join(', ')+'.':'No error records found for these missions.');
  }
  lines.push(calls.error||calls.count===null?'Model usage records unavailable.':`Recorded model call reservations: ${calls.count}.`);
  lines.push(repairs.error?'Repair evidence unavailable.':`Missions with a live-verified repair checkpoint in the sampled evidence (up to 100 checkpoints): ${new Set(repairs.data.map(r=>r.mission_id)).size}.`);
  return {output:lines.join('\n'),missions:[]};
}
