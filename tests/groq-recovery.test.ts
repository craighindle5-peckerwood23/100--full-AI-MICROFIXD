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

test('oversized input switches models without discarding prompt content',async()=>{
 const seen:any[]=[];const messages=[{role:'user' as const,content:'complete evidence'}];
 const client={chat:{completions:{create:async(p:any)=>{seen.push(p);if(p.model==='first')throw Object.assign(new Error('Request too large on input tokens per minute (ITPM): Limit 7000, Requested 7288'),{status:413});return success;}}}};
 await executeGroqWithRetry(client as any,{model:'first',messages},{fallbackModels:['first','second']});
 assert.deepEqual(seen.map(p=>p.model),['first','second']);assert.deepEqual(seen[1].messages,messages);
});
test('input cooldown switches to a distinct model instead of abandoning the command',async()=>{
 const seen:string[]=[];const client={chat:{completions:{create:async(p:any)=>{seen.push(p.model);if(p.model==='first')throw Object.assign(new Error('Rate limit on input tokens per minute (ITPM)'),{status:429,headers:{'retry-after':'28'}});return success;}}}};
 await executeGroqWithRetry(client as any,{model:'first',messages:[]},{fallbackModels:['first','second']});assert.deepEqual(seen,['first','second']);
});
test('output quota retries below the provider reported limit',async()=>{
 const seen:number[]=[];const client={chat:{completions:{create:async(p:any)=>{seen.push(p.max_tokens);if(seen.length===1)throw Object.assign(new Error('Request too large on output tokens per minute (OTPM): Limit 1000, Requested 10000'),{status:429,headers:{'retry-after':'0'}});return success;}}}};
 await executeGroqWithRetry(client as any,{messages:[],max_tokens:10000},{baseDelayMs:0});assert.deepEqual(seen,[10000,900]);
});
