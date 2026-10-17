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
