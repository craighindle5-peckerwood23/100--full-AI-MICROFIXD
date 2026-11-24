import type {SupabaseClient} from '@supabase/supabase-js';
import {canonicalJSON,type Mission,type Task,type Subtask,type Artifact} from './executionSpine';

export async function verifyResume(db:SupabaseClient,m:Mission,tasks:Task[],subs:Subtask[],artifacts:Artifact[]){
 const query=()=>db.from('spine_events').select('operation').eq('tenant_id',m.tenant_id).eq('mission_id',m.mission_id);
 const [inserts,resume]=await Promise.all([
  query().eq('operation->>op','insert').in('operation->>kind',['missions','tasks','subtasks']).order('id').limit(1000),
  query().eq('operation->>op','admin_resume').order('id',{ascending:false}).limit(1),
 ]);
 if(inserts.error||resume.error)throw Error('RESUME_EVIDENCE_UNAVAILABLE');
 const originals=new Map<string,any>();
 for(const {operation:o} of inserts.data){const key=o.kind+'/'+o.id;if(!originals.has(key))originals.set(key,o.data);}
 const registeredTasks=[...originals.keys()].filter(k=>k.startsWith('tasks/'));
 const registeredSteps=[...originals.keys()].filter(k=>k.startsWith('subtasks/'));
 if(registeredTasks.length!==tasks.length||registeredSteps.length!==subs.length)return false;
 const original=originals.get('missions/'+m.mission_id);
 if(!original||inserts.data.length===1000)return false;
 const constraints={...original.constraints};
 if(resume.data.length)constraints.max_tokens=resume.data[0].operation.max_tokens;
 if(original.objective!==m.objective||canonicalJSON(constraints)!==canonicalJSON(m.constraints))return false;
 const equal=(a:any,b:any,keys:string[])=>a&&keys.every(k=>canonicalJSON(a[k]??null)===canonicalJSON(b[k]??null));
 if(!tasks.every(t=>equal(originals.get('tasks/'+t.task_id),t,['mission_id','tenant_id','agent_id','input_context','expected_output_schema','tool_permissions'])))return false;
 return subs.every(s=>equal(originals.get('subtasks/'+s.subtask_id),s,['task_id','tenant_id','agent_id','input','tool_request'])
   && (s.status==='succeeded')===artifacts.some(a=>a.subtask_id===s.subtask_id));
}
