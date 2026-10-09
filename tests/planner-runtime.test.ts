import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSchema} from '../server/planner/supabaseRuntime';
test('structured output rejects missing fields, wrong types and extra fields',()=>{
 const schema={type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false};
 assert.equal(validateSchema({answer:'verified'},schema),true);
 for(const value of [{}, {answer:3}, {answer:'ok',extra:true}, null])assert.equal(validateSchema(value,schema),false);
 assert.equal(validateSchema('unclassified',{}),false);
});
