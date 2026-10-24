import {auditMission} from './missionAudit';
import {contentHash, EXECUTION_POLICY_VERSION, type Mission, type Task, type Subtask, type Artifact} from './executionSpine';

export const EVALUATION_VERSION='mission-evaluation-v1';
/** Structural assurance, not a truth detector or calibrated intelligence score. No model calls. */
export function evaluateMission(mission:Mission,tasks:Task[],subtasks:Subtask[],artifacts:Artifact[]) {
 const audit=auditMission(mission,tasks,subtasks,artifacts);
 const checks=[
  {id:'evidence_integrity',status:audit.verified?'passed':'failed',issues:audit.issues},
  {id:'execution_complete',status:tasks.length>0&&subtasks.length>0&&tasks.every(t=>t.status==='succeeded')&&subtasks.every(s=>s.status==='succeeded')?'passed':'pending',issues:[]},
  {id:'objective_review',status:mission.constraints.completion_policy&&mission.result_artifact_id&&artifacts.some(a=>a.artifact_id===mission.result_artifact_id&&a.evidence.completion_review)?'passed':'unknown',issues:[]}
 ];
 const verdict=checks.some(c=>c.status==='failed')?'failed':mission.status==='succeeded'&&checks.every(c=>c.status==='passed')?'passed':'incomplete';
 const snapshot=contentHash({mission,tasks,subtasks,artifacts});
 return {version:EVALUATION_VERSION,execution_policy:EXECUTION_POLICY_VERSION,mission_id:mission.mission_id,
  snapshot,verdict,checks,counts:audit.counts,
  limitations:['Structural evidence does not establish factual truth, external outcomes, or calibrated model quality.'],
  reflection:checks.filter(c=>c.status!=='passed').map(c=>({check:c.id,action:c.status==='failed'?'Resolve recorded integrity issues before completion.':'Collect missing execution or objective-review evidence.'}))};
}
