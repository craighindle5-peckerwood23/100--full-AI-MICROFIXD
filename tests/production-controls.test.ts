import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routePermission} from '../server/security/routePermission';
import {auditMission} from '../server/planner/missionAudit';
import {deadlineExceeded,contentHash,type Mission,type Task,type Subtask,type Artifact} from '../server/planner/executionSpine';
const mission:Mission={mission_id:'m',tenant_id:'t',created_at:new Date().toISOString(),created_by:'u',objective:'verified work',constraints:{},status:'succeeded',result_artifact_id:'final'};
function fixture(){
 const task:Task={task_id:'task',mission_id:'m',tenant_id:'t',agent_id:null,tool_permissions:[],input_context:{},expected_output_schema:{type:'object'},status:'succeeded',attempts:1};
 const sub:Subtask={subtask_id:'sub',task_id:'task',tenant_id:'t',agent_id:null,tool_request:null,input:{},status:'succeeded',attempts:1,raw_output:{ok:true},normalized_output:{ok:true}};
 const evidence={policy_version:'v1',constraints_hash:contentHash(mission.constraints),objective_hash:contentHash(mission.objective)};
 const source:Artifact={artifact_id:'source',mission_id:'m',tenant_id:'t',task_id:'task',subtask_id:'sub',type:'json',content:{ok:true},evidence,hash:contentHash({ok:true})};
 const final:Artifact={artifact_id:'final',mission_id:'m',tenant_id:'t',task_id:null,subtask_id:null,type:'mission_result',content:{outputs:[{artifact_id:'source',content:{ok:true}}],canonical_artifacts:['source']},evidence:{...evidence,provenance:[{artifact_id:'source',task_id:'task',subtask_id:'sub',content_hash:source.hash,evidence_hash:contentHash(evidence)}]},hash:contentHash({outputs:[{artifact_id:'source',content:{ok:true}}],canonical_artifacts:['source']})};
 return {tasks:[task],subs:[sub],artifacts:[source,final]};
}
test('execution writes require execute permission while reads allow monitoring',()=>{
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(routePermission('/api/execution/missions',method,'monitor'),'execute');
 assert.equal(routePermission('/api/execution/missions','GET','monitor'),'monitor');assert.equal(routePermission('/api/hitl/decide','POST','monitor'),'approve');
});
test('complete mission audit verifies evidence lineage',()=>{const f=fixture();assert.equal(auditMission(mission,f.tasks,f.subs,f.artifacts).verified,true);});
test('audit detects content tampering, scope violations and missing outputs',()=>{
 const f=fixture();f.artifacts[0].content={ok:false};f.artifacts[0].tenant_id='other';f.subs.push({...f.subs[0],subtask_id:'lost'});
 const codes=auditMission(mission,f.tasks,f.subs,f.artifacts).issues.map(i=>i.code);
 assert.ok(codes.includes('CONTENT_HASH_MISMATCH'));assert.ok(codes.includes('ARTIFACT_SCOPE_MISMATCH'));assert.ok(codes.includes('SUCCEEDED_SUBTASK_MISSING_ARTIFACT'));
});
test('audit detects modified evidence and changed mission constraints',()=>{
 const f=fixture();f.artifacts[0].evidence={...f.artifacts[0].evidence,confidence:1};
 assert.ok(auditMission(mission,f.tasks,f.subs,f.artifacts).issues.some(i=>i.code==='PROVENANCE_LINK_MISMATCH'));
 assert.ok(auditMission({...mission,constraints:{max_tokens:99}},f.tasks,f.subs,f.artifacts).issues.some(i=>i.code==='POLICY_PROVENANCE_MISSING_OR_CHANGED'));
});
test('deadline handles expiry and fails closed for invalid persisted values',()=>{
 assert.equal(deadlineExceeded(mission),false);assert.equal(deadlineExceeded({...mission,constraints:{deadline_at:'invalid'}}),true);
 assert.equal(deadlineExceeded({...mission,constraints:{deadline_at:'2026-01-01T00:00:00Z'}},Date.parse('2026-01-01T00:00:00Z')),true);
 assert.equal(deadlineExceeded({...mission,constraints:{deadline_at:'2026-01-01T00:00:00Z'}},Date.parse('2025-01-01T00:00:00Z')),false);
});

test('audit rejects a final answer disconnected from verified source outputs',()=>{
 const f=fixture();f.artifacts[1].content={outputs:[],canonical_artifacts:[]};f.artifacts[1].hash=contentHash(f.artifacts[1].content);
 const issues=auditMission(mission,f.tasks,f.subs,f.artifacts).issues;
 assert.ok(issues.some(i=>i.code==='FINAL_OUTPUT_LINK_MISMATCH'));assert.ok(issues.some(i=>i.code==='CANONICAL_TASK_LINK_MISMATCH'));
});
