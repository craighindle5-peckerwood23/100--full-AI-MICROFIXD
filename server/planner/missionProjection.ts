import type {Mission,Task,Artifact} from './executionSpine';
export function projectMission(m:Mission,tasks:Task[]=[],artifacts:Artifact[]=[]){
 const completed=tasks.filter(t=>t.status==='succeeded').length;
 return {id:m.mission_id,tenantId:m.tenant_id,agentId:'durable-planner',goal:m.objective,requestedBy:m.created_by,
 status:m.status,currentStep:completed,
 progress:m.status==='succeeded'?100:tasks.length?Math.round(100*completed/tasks.length):0,
 plan:tasks.map(t=>({id:t.task_id,kind:'durable_task',title:String(t.input_context.objective??m.objective),input:t.input_context,risk:'governed'})),
 workingMemory:{},createdAt:m.created_at,updatedAt:null,
 ...(m.result_artifact_id?{outcome:artifacts.find(a=>a.artifact_id===m.result_artifact_id)?.content}:{}),
 status_url:`/api/planner/missions/${m.mission_id}`};
}
