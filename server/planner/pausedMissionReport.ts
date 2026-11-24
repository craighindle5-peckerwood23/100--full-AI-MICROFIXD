import type {SupabaseClient} from '@supabase/supabase-js';
import {diagnoseMission} from './missionDiagnosis';

const pause = '(?:paused|waiting|blocked|on hold)';
const owner = "(?:(?:my|our|the|any|all|current|microfixd(?:'s)?) )*";
const noun = owner + '(?:' + pause + ' missions?|missions? (?:that are |are |currently )?' + pause + ')';
const reportQuestion = new RegExp('^(?:please )?(?:(?:tell me about|show(?: me)?|list|check|summarize|what about|do (?:i|we) have|are there|how many) )?' + noun + '(?: (?:right now|do (?:i|we) have|are there|please))?$');
const reasonQuestion = new RegExp('^(?:which(?: of)?|what|why (?:are|is)|are) ' + owner + 'missions? (?:are |is )?(?:currently )?' + pause + '(?: right now)?$');

export function asksAboutPausedMissions(task:string) {
  const question=task.trim().toLowerCase().replace(/[’]/g,"'").replace(/[?!.]+$/,'').trim().replace(/\s+/g,' ');
  return reportQuestion.test(question)||reasonQuestion.test(question);
}

export async function pausedMissionReport(db:SupabaseClient,tenant:string){
  if(!tenant)throw new Error('Sign in to read the mission registry.');
  const {data,count,error}=await db.from('spine_rows')
    .select('id,objective:data->>objective',{count:'exact'})
    .eq('tenant_id',tenant).eq('kind','missions').eq('data->>status','waiting')
    .order('sequence',{ascending:false}).limit(3);
  if(error||!Array.isArray(data)||count===null)throw new Error('The mission registry is unavailable. The number of paused missions is unknown.');
  if(!count)return {output:'No paused missions were found in your workspace. A paused mission is one the planner has marked as waiting.',missions:[]};

  const missions=await Promise.all(data.map(async row=>{
    const id=String(row.id);
    const title=String(row.objective??'').replace(/\s+/g,' ').trim().slice(0,160)||'Untitled mission';
    try{
      const diagnosis=await diagnoseMission(db,tenant,id,{includeHistory:false});
      const detail=!diagnosis?'The mission record is no longer available.':
        diagnosis.finding==='status'?diagnosis.observations[0]:diagnosis.title+'. '+diagnosis.next;
      return {id,title,detail};
    }catch{return {id,title,detail:'The registry recorded a pause. Its cause could not be read.'};}
  }));
  const heading=`The mission registry returned ${count} paused mission${count===1?'':'s'} in your workspace.`;
  const scope=count>missions.length?` Showing the ${missions.length} newest by creation order.`:'';
  const lines=missions.map(m=>`• ${m.title} (${m.id}) — ${m.detail}`);
  return {output:[heading+scope,...lines].join('\n'),missions};
}
