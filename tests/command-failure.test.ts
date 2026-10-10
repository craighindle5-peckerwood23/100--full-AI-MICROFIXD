import test from 'node:test';
import assert from 'node:assert/strict';
import {recordCommandFailure} from '../server/orchestration/commandFailure';
import {completeTextWithFallback} from '../server/orchestration/llmFallback';
import {getGroqClient} from '../server/orchestration/groqRuntime';

test('input limit retains diagnosis and saves a session-scoped failure record',async()=>{
 const key=process.env.TEST_SECRET_KEY;process.env.TEST_SECRET_KEY='private-test-credential';
 try {
 const result=await recordCommandFailure(Object.assign(new Error('ITPM Limit 7000 private-test-credential'),{stage:'brain',status:413}),{cmdId:'test',session_id:'session-a',stages:['intake']},async(action,p:any)=>{
 assert.equal(action,'store');assert.equal(p.session_id,'session-a');assert.equal(p.organ,'command_failure');assert.ok(!p.content.includes('private-test-credential'));return {stored:true,id:'record-a'};
 });
 assert.equal(result.code,'INPUT_TOKEN_LIMIT');assert.equal(result.stage,'brain');assert.equal(result.status,413);assert.equal(result.persisted,true);assert.equal(result.record_id,'record-a');
 }finally{if(key===undefined)delete process.env.TEST_SECRET_KEY;else process.env.TEST_SECRET_KEY=key;}
});
test('database failure preserves original cause and never claims recording succeeded',async()=>{
 const result=await recordCommandFailure(new Error('original provider failure'),{cmdId:'test',session_id:'session',stages:['brain']},async()=>{throw new Error('database unavailable');});
 assert.equal(result.message,'original provider failure');assert.equal(result.persisted,false);assert.equal(result.persistence_error,'database unavailable');
});
test('OpenRouter is primary even with Groq configured and preserves the complete prompt',async()=>{
 const oldKey=process.env.GROQ_API_KEY,oldRouter=process.env.OPENROUTER_API_KEY,oldGemini=process.env.GEMINI_API_KEY;
 const oldFetch=globalThis.fetch;
 process.env.GROQ_API_KEY='test-key';process.env.OPENROUTER_API_KEY='router-test';delete process.env.GEMINI_API_KEY;
 const client=getGroqClient()!;const original=client.chat.completions.create;
 let groqCalls=0;client.chat.completions.create=(async()=>{groqCalls++;throw Object.assign(new Error('input tokens per minute ITPM Limit 7000'),{status:413});}) as any;
 const messages=[{role:'user' as const,content:'complete original question'}];
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://openrouter.ai/api/v1/chat/completions');assert.deepEqual(JSON.parse(String(init?.body)).messages,messages);return Response.json({model:'free-model',choices:[{message:{content:'recovered'},finish_reason:'stop'}]});};
 try{const result=await completeTextWithFallback(messages,512);assert.equal(result.provider,'openrouter');assert.equal(result.content,'recovered');assert.equal(groqCalls,0);}
 finally{client.chat.completions.create=original;globalThis.fetch=oldFetch;for(const [name,value] of [['GROQ_API_KEY',oldKey],['OPENROUTER_API_KEY',oldRouter],['GEMINI_API_KEY',oldGemini]]){if(value===undefined)delete process.env[name!];else process.env[name!]=value;}}
});
