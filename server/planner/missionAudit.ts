import {validateSchema} from './schema';
import {contentHash, type Mission, type Task, type Subtask, type Artifact} from './executionSpine';
export interface AuditIssue {code:string; id:string}
export function auditMission(mission:Mission,tasks:Task[],subtasks:Subtask[],artifacts:Artifact[]) {
 const issues:AuditIssue[]=[];
 const add=(code:string,id:string)=>issues.push({code,id});
 const taskIds=new Set(tasks.map(t=>t.task_id));
 const subIds=new Set(subtasks.map(s=>s.subtask_id));
 const artifactIds=new Set<string>();
 for(const task of tasks)if(task.tenant_id!==mission.tenant_id||task.mission_id!==mission.mission_id)add('TASK_SCOPE_MISMATCH',task.task_id);
 for(const sub of subtasks)if(sub.tenant_id!==mission.tenant_id||!taskIds.has(sub.task_id))add('SUBTASK_SCOPE_MISMATCH',sub.subtask_id);
 for(const artifact of artifacts){
  if(artifactIds.has(artifact.artifact_id))add('DUPLICATE_ARTIFACT',artifact.artifact_id);artifactIds.add(artifact.artifact_id);
  if(artifact.tenant_id!==mission.tenant_id||artifact.mission_id!==mission.mission_id)add('ARTIFACT_SCOPE_MISMATCH',artifact.artifact_id);
  if(artifact.hash!==contentHash(artifact.content))add('CONTENT_HASH_MISMATCH',artifact.artifact_id);
  if(artifact.task_id&&!taskIds.has(artifact.task_id))add('UNKNOWN_ARTIFACT_TASK',artifact.artifact_id);
  if(artifact.subtask_id){const task=tasks.find(t=>t.task_id===artifact.task_id);if(!task||!validateSchema(artifact.content,task.expected_output_schema))add('ARTIFACT_SCHEMA_INVALID',artifact.artifact_id);const sub=subtasks.find(s=>s.subtask_id===artifact.subtask_id);if(!subIds.has(artifact.subtask_id)||sub?.task_id!==artifact.task_id)add('INVALID_ARTIFACT_PARENT',artifact.artifact_id);}
  if(artifact.evidence.constraints_hash!==contentHash(mission.constraints)||artifact.evidence.objective_hash!==contentHash(mission.objective)||typeof artifact.evidence.policy_version!=='string')add('POLICY_PROVENANCE_MISSING_OR_CHANGED',artifact.artifact_id);
 }
 for(const sub of subtasks)if(sub.status==='succeeded'&&!artifacts.some(a=>a.subtask_id===sub.subtask_id))add('SUCCEEDED_SUBTASK_MISSING_ARTIFACT',sub.subtask_id);
 const final=artifacts.find(a=>a.artifact_id===mission.result_artifact_id);
 if(mission.status==='succeeded'){
  if(!tasks.length||tasks.some(t=>t.status!=='succeeded')||!subtasks.length||subtasks.some(s=>s.status!=='succeeded'))add('INCOMPLETE_SUCCESS',mission.mission_id);
  if(!final||final.type!=='mission_result'||final.task_id!==null||final.subtask_id!==null)add('INVALID_FINAL_ARTIFACT',mission.mission_id);
  const output=final?.content as any;
  const sourcesForOutput=artifacts.filter(a=>a.subtask_id!==null);
  if(!Array.isArray(output?.outputs)||output.outputs.length!==sourcesForOutput.length||sourcesForOutput.some(source=>output.outputs.filter((entry:any)=>entry?.artifact_id===source.artifact_id&&contentHash(entry.content)===source.hash).length!==1))add('FINAL_OUTPUT_LINK_MISMATCH',mission.mission_id);
  if(!Array.isArray(output?.canonical_artifacts)||output.canonical_artifacts.length!==tasks.length||tasks.some(task=>output.canonical_artifacts.filter((id:any)=>artifacts.some(a=>a.artifact_id===id&&a.task_id===task.task_id)).length!==1))add('CANONICAL_TASK_LINK_MISMATCH',mission.mission_id);
  const provenance=final?.evidence.provenance;
  if(!Array.isArray(provenance))add('FINAL_PROVENANCE_MISSING',mission.mission_id);
  else {
   const sources=artifacts.filter(a=>a.subtask_id!==null);
   if(provenance.length!==sources.length)add('PROVENANCE_COUNT_MISMATCH',mission.mission_id);
   for(const source of sources){const entries=provenance.filter(p=>p&&typeof p==='object'&&!Array.isArray(p)&&p.artifact_id===source.artifact_id);const p=entries[0] as any;
    if(entries.length!==1||p.content_hash!==source.hash||p.evidence_hash!==contentHash(source.evidence)||p.task_id!==source.task_id||p.subtask_id!==source.subtask_id)add('PROVENANCE_LINK_MISMATCH',source.artifact_id);
   }
  }
 }
 return {verified:issues.length===0,mission_id:mission.mission_id,counts:{tasks:tasks.length,subtasks:subtasks.length,artifacts:artifacts.length},issues};
}
