/** Deterministic execution-state graph for engineering missions. */
import {createHash} from 'node:crypto';
export const STATES=Object.freeze(['created','discovering','planning','executing','testing','debugging','awaiting_approval','verified_in_sandbox','failed','budget_exhausted','cancelled']);
const ROUTES=Object.freeze({created:['discovering','cancelled'],discovering:['planning','failed','cancelled'],planning:['executing','awaiting_approval','failed','cancelled'],executing:['testing','debugging','awaiting_approval','failed','cancelled'],testing:['verified_in_sandbox','debugging','failed','cancelled'],debugging:['planning','budget_exhausted','failed','cancelled'],awaiting_approval:['planning','cancelled'],verified_in_sandbox:[],failed:[],budget_exhausted:[],cancelled:[]});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function newMission(id,objective,limits={maxAttempts:5}) {
 if(typeof id!=='string'||!id||typeof objective!=='string'||!objective.trim())throw Error('INVALID_MISSION');
 return {id,objective:objective.trim(),state:'created',attempt:0,limits:{maxAttempts:Math.max(1,Math.min(5,limits.maxAttempts||5))},events:[],toolCalls:[],artifacts:[],approval:null,context:{},createdAt:new Date().toISOString()};
}
export function transition(m,state,details={}) {
 if(!STATES.includes(state)||!ROUTES[m.state]?.includes(state))throw Error('INVALID_TRANSITION:'+m.state+'->'+state);
 if(state==='verified_in_sandbox'&&!m.artifacts.some(a=>a.kind==='test_verification'&&a.data.passed===true))throw Error('VERIFICATION_REQUIRED');
 if(state==='planning'&&m.state==='awaiting_approval'&&m.approval?.status!=='approved')throw Error('APPROVAL_REQUIRED');
 if(state==='executing'&&m.state==='planning'){if(m.attempt>=m.limits.maxAttempts)throw Error('ATTEMPT_BUDGET_EXHAUSTED');m.attempt++;}
 m.events.push({sequence:m.events.length+1,from:m.state,to:state,details,at:new Date().toISOString()});m.state=state;return m;
}
export function recordToolCall(m,name,args,result){
 if(!['discovering','executing','testing','debugging'].includes(m.state))throw Error('TOOL_CALL_OUTSIDE_ACTIVE_STATE');
 if(typeof name!=='string'||!name)throw Error('INVALID_TOOL_NAME');
 const entry={name,argsHash:hash(args),resultHash:hash(result),success:result?.success===true,at:new Date().toISOString()};m.toolCalls.push(entry);return entry;
}
export function addArtifact(m,kind,data){
 if(typeof kind!=='string'||!kind)throw Error('INVALID_ARTIFACT');
 if(kind==='test_verification'&&m.state!=='testing')throw Error('TEST_NOT_RUN');
 const entry={kind,hash:hash(data),data,at:new Date().toISOString()};m.artifacts.push(entry);return entry;
}
export function requestApproval(m,reason,changes,actor='operator'){
 if(!['planning','executing'].includes(m.state))throw Error('APPROVAL_NOT_ACTIONABLE');
 if(!Array.isArray(changes)||changes.length===0)throw Error('APPROVAL_ACTION_REQUIRED');
 const requestHash=hash({id:m.id,reason,changes});m.approval={requestHash,reason,changes,actor,status:'pending',requestedAt:new Date().toISOString()};
 transition(m,'awaiting_approval',{requestHash});return m.approval;
}
export function decideApproval(m,requestHash,decision,actor){
 if(m.state!=='awaiting_approval'||m.approval?.requestHash!==requestHash)throw Error('APPROVAL_CONFLICT');
 if(!['approved','rejected'].includes(decision)||!actor||actor!==m.approval.actor)throw Error('UNAUTHORIZED_DECISION');
 m.approval={...m.approval,status:decision,decidedAt:new Date().toISOString()};
 if(decision==='rejected')transition(m,'cancelled',{reason:'approval_rejected'});
 else transition(m,'planning',{reason:'approval_accepted'});
 return m;
}
export function nextAfterTest(m,test){
 if(m.state!=='testing')throw Error('NOT_TESTING');
 const passed=test?.pass===true&&Array.isArray(test.results)&&test.results.length>0&&test.results.every(r=>r.code===0);
 addArtifact(m,'test_verification',{passed,results:test.results||[]});
 transition(m,passed?'verified_in_sandbox':'debugging',{passed});
 if(!passed&&m.attempt>=m.limits.maxAttempts)transition(m,'budget_exhausted');
 return m.state;
}
export const TOOL_CONTRACTS=Object.freeze({
 inspect_context:{risk:'read',required:['paths'],allowedStates:['discovering','planning']},
 stage_patch:{risk:'isolated_write',required:['files'],allowedStates:['executing']},
 execute_tests:{risk:'isolated_execution',required:['suite'],allowedStates:['testing']},
 propose_tool:{risk:'proposal_only',required:['name','schema'],allowedStates:['planning']},
 calendar_freebusy:{risk:'connected_read',required:['calendarId','from','to'],allowedStates:['executing']},
 calendar_create:{risk:'external_write',required:['calendarId','start','end','title'],allowedStates:['executing']},
 send_notification:{risk:'external_write',required:['recipient','message'],allowedStates:['executing']},
});
export function validateToolCall(m,tool,args,grants=[]){
 const c=TOOL_CONTRACTS[tool];if(!c)throw Error('UNKNOWN_TOOL');
 if(!c.allowedStates.includes(m.state))throw Error('TOOL_STATE_MISMATCH');
 if(!args||typeof args!=='object'||Array.isArray(args)||c.required.some(k=>typeof args[k]!=='string'&&!Array.isArray(args[k])))throw Error('INVALID_TOOL_ARGUMENTS');
 if(['external_write','connected_read'].includes(c.risk)&&!grants.includes(tool))throw Error('CONNECTOR_NOT_AUTHORIZED');
 return {tool,args,risk:c.risk};
}
