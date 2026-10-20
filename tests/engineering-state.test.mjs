import test from 'node:test';
import assert from 'node:assert/strict';
import {newMission,transition,requestApproval,decideApproval,nextAfterTest,validateToolCall} from '../scripts/engineering-state.mjs';
test('repair graph retries a failed test then validates the next patch',()=>{
 const m=newMission('repair-1','fix failing unit tests',{maxAttempts:2});
 transition(m,'discovering');transition(m,'planning');transition(m,'executing');transition(m,'testing');
 assert.equal(nextAfterTest(m,{pass:false,results:[{code:1,diagnostic:'TS2345'}]}),'debugging');
 transition(m,'planning');transition(m,'executing');transition(m,'testing');
 assert.equal(nextAfterTest(m,{pass:true,results:[{code:0}]}),'verified_in_sandbox');
 assert.equal(m.attempt,2);
});
test('retry budget cannot be bypassed',()=>{
 const m=newMission('repair-2','fix',{maxAttempts:1});
 transition(m,'discovering');transition(m,'planning');transition(m,'executing');transition(m,'testing');
 assert.equal(nextAfterTest(m,{pass:false,results:[{code:1}]}),'budget_exhausted');
 assert.throws(()=>transition(m,'planning'),/INVALID_TRANSITION/);
});
test('approval interruption requires exact request hash and correct actor',()=>{
 const m=newMission('repair-3','change calendar');
 transition(m,'discovering');transition(m,'planning');
 const req=requestApproval(m,'External calendar change',[{tool:'calendar_create'}]);
 assert.equal(m.state,'awaiting_approval');
 assert.throws(()=>decideApproval(m,'different','approved','operator'),/APPROVAL_CONFLICT/);
 assert.throws(()=>decideApproval(m,req.requestHash,'approved','someone else'),/UNAUTHORIZED_DECISION/);
 decideApproval(m,req.requestHash,'approved','operator');
 assert.equal(m.state,'planning');
});
test('typed tools reject unknown operations and ungranted external writes',()=>{
 const m=newMission('repair-4','calendar');transition(m,'discovering');transition(m,'planning');transition(m,'executing');
 const args={calendarId:'primary',start:'2026-10-21',end:'2026-10-22',title:'Planning'};
 assert.throws(()=>validateToolCall(m,'calendar_create',args),/CONNECTOR_NOT_AUTHORIZED/);
 assert.equal(validateToolCall(m,'calendar_create',args,['calendar_create']).risk,'external_write');
 assert.throws(()=>validateToolCall(m,'shell_exec',{cmd:'rm'}),/UNKNOWN_TOOL/);
});
test('success requires an independently recorded passing test',()=>{
 const m=newMission('repair-5','repair');transition(m,'discovering');transition(m,'planning');transition(m,'executing');transition(m,'testing');
 assert.throws(()=>transition(m,'verified_in_sandbox'),/VERIFICATION_REQUIRED/);
});
