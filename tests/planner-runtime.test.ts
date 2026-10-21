import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSchema} from '../server/planner/supabaseRuntime';
test('structured output rejects missing fields, wrong types and extra fields',()=>{
 const schema={type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false};
 assert.equal(validateSchema({answer:'verified'},schema),true);
 for(const value of [{}, {answer:3}, {answer:'ok',extra:true}, null])assert.equal(validateSchema(value,schema),false);
 assert.equal(validateSchema('unclassified',{}),false);
});
test('enum values and unsupported schemas fail closed',()=>{
 assert.equal(validateSchema('read',{type:'string',enum:['read']}),true);
 assert.equal(validateSchema('write',{type:'string',enum:['read']}),false);
 assert.equal(validateSchema({},{type:'object',properties:{answer:{bogus:true}}}),false);
 assert.equal(validateSchema([],{type:'array'}),false);
});


test('planner accepts JSON code fences and a single steps wrapper, never surrounding instructions',async()=>{
 const {parsePlanOutput,planningErrorCode}=await import('../server/planner/planOutput');
 assert.deepEqual(parsePlanOutput('```json\n[{"tool_request":null,"input":{"step":"explain"}}]\n```'),[{tool_request:null,input:{step:'explain'}}]);
 assert.deepEqual(parsePlanOutput('{"steps":["one"]}'),['one']);
 for(const text of ['Before: ["one"]','[]','{"steps":["one"],"extra":true}','null'])assert.throws(()=>parsePlanOutput(text),/INVALID_PLAN/);
 assert.equal(planningErrorCode(new Error('secret-token-value')),'PLANNING_FAILED');
 assert.equal(planningErrorCode(new SyntaxError('invalid response')),'INVALID_PLAN_JSON');
});

test('completion review requires real evidence IDs and well-formed bounded next steps',async()=>{
 const {parseCompletionOutput,completionEvidence}=await import('../server/planner/completionReview');
 const artifacts:any[]=[{artifact_id:'real',hash:'digest',content:{result:{organs:[{id:'paragon',native_executor:true}],tools:[{name:'list_system_capabilities'}]}},evidence:{tool:'list_system_capabilities'}}];
 assert.equal((completionEvidence(artifacts)[0].content_preview).includes('inventory_only'),true);
 const good={status:'complete',reason:'Inventory requested and returned',evidence_artifact_ids:['real'],next_steps:[]};
 assert.equal(parseCompletionOutput(JSON.stringify(good),artifacts).status,'complete');
 for(const bad of [{...good,evidence_artifact_ids:['forged']},{...good,evidence_artifact_ids:[]},{...good,status:'continue'},{...good,next_steps:[{}]},{...good,extra:'injected'}])assert.throws(()=>parseCompletionOutput(JSON.stringify(bad),artifacts),/INVALID_COMPLETION/);
});
