import test from 'node:test';
import assert from 'node:assert/strict';
import {executeGroqWithRetry} from '../server/orchestration/groqRetry';
import {getGroqClient,groqConfiguration} from '../server/orchestration/groqRuntime';
import {roleForToken} from '../server/security/rbac';
const success={choices:[{message:{content:'real answer'},finish_reason:'stop'}],usage:{total_tokens:3}};
test('fallback tries every distinct model rather than cycling between two failures',async()=>{
 const seen:string[]=[];
 const client={chat:{completions:{create:async(p:any)=>{seen.push(p.model);if(p.model!=='third')throw Object.assign(new Error('model_not_found'),{status:404});return success;}}}};
 const result=await executeGroqWithRetry(client as any,{model:'first',messages:[]},{fallbackModels:['first','second','third']});
 assert.deepEqual(seen,['first','second','third']);assert.equal(result.content,'real answer');
});
test('invalid credentials fail once and preserve provider status',async()=>{
 let calls=0;const client={chat:{completions:{create:async()=>{calls++;throw Object.assign(new Error('invalid_api_key'),{status:401});}}}};
 await assert.rejects(executeGroqWithRetry(client as any,{messages:[]}),error=>(error as any).status===401);assert.equal(calls,1);
});
test('server configuration trims keys, refreshes changed clients, and never exposes credentials',()=>{
 const original=process.env.GROQ_API_KEY,admin=process.env.ADMIN_TOKEN;
 try{process.env.GROQ_API_KEY='  test-key-one  ';const first=getGroqClient();assert.equal(getGroqClient(),first);assert.equal(JSON.stringify(groqConfiguration()).includes('test-key'),false);process.env.GROQ_API_KEY='test-key-two';assert.notEqual(getGroqClient(),first);process.env.ADMIN_TOKEN='   ';assert.equal(roleForToken(''),'anonymous');process.env.ADMIN_TOKEN=' admin-test ';assert.equal(roleForToken('admin-test'),'admin');}
 finally{if(original===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=original;if(admin===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=admin;}
});
