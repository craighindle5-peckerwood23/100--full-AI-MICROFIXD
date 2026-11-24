import type {Mission,Task} from '../../server/planner/executionSpine';

/** Standard cockpit progress text, also used as the control in the diagnostic pilot. */
export function missionStatusSummary(status:Mission['status'], approvals:{status:string}[], errors:{code:string}[], tasks:Pick<Task,'status'>[]){
  if(approvals.some(a=>a.status==='pending'))return 'Waiting for approval. Open this mission to review the exact action.';
  if(status==='waiting')return `Mission paused: ${errors.map(e=>e.code).join(', ') || 'see mission details'}. Open this mission for recovery details.`;
  if(status==='failed')return `Mission failed: ${errors.map(e=>e.code).join(', ') || 'see mission details'}. Open this mission for persisted results and recovery details.`;
  return `${status}: ${tasks.filter(t=>t.status==='succeeded').length}/${tasks.length} tasks completed.`;
}
