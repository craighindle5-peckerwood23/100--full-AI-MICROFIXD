import test from 'node:test';
import assert from 'node:assert/strict';
import {runSystemCommand,commandSession} from '../src/lib/commandApi';
test('commands reuse session and surface backend failure without a fabricated reply',async()=>{
  const saved=new Map<string,string>();
  const originalWindow=(globalThis as any).window,originalFetch=globalThis.fetch;
  (globalThis as any).window={sessionStorage:{getItem:(key:string)=>saved.get(key),setItem:(key:string,value:string)=>saved.set(key,value)}};
  const oldStorage=(globalThis as any).localStorage;
  (globalThis as any).localStorage={getItem:()=>JSON.stringify({retrieval:{limit:50,max_chars:80000}})};
  const sessions:string[]=[];let failing=false;
  globalThis.fetch=async(url:any,init:any)=>{
    assert.equal(url,'/api/command/run');assert.deepEqual(JSON.parse(init.body).context.retrieval,{limit:50,max_chars:80000});sessions.push(JSON.parse(init.body).session_id);
    return Response.json(failing?{success:false,output:'Stage brain failed: invalid API key'}:{success:true,output:'verified answer'});
  };
  try{
    assert.equal((await runSystemCommand('first')).output,'verified answer');
    await runSystemCommand('second');assert.equal(sessions[0],sessions[1]);
    failing=true;await assert.rejects(runSystemCommand('third'),/invalid API key/);
  } finally {(globalThis as any).window=originalWindow;globalThis.fetch=originalFetch;(globalThis as any).localStorage=oldStorage;}
});

test('unauthenticated commands open access and retry only after verified login',async()=>{
 const oldWindow=(globalThis as any).window,oldFetch=globalThis.fetch;
 const events=new EventTarget();let token='',calls=0;
 (globalThis as any).window=Object.assign(events,{sessionStorage:{getItem:()=>token}});
 events.addEventListener('microfixd:auth-required',()=>{token='verified-token';events.dispatchEvent(new Event('microfixd:auth-changed'));});
 globalThis.fetch=async(_url,init)=>{calls++;if(calls===1)return Response.json({code:'AUTH_REQUIRED',error:"Forbidden: role 'anonymous' cannot 'execute'"},{status:403});assert.equal((init?.headers as any).Authorization,'Bearer verified-token');return Response.json({success:true,output:'completed after login'});};
 try{assert.equal((await runSystemCommand('retained task',{},'auth-session')).output,'completed after login');assert.equal(calls,2);}
 finally{(globalThis as any).window=oldWindow;globalThis.fetch=oldFetch;}
});

test('cancelled access never retries an unauthenticated command',async()=>{
 const oldWindow=(globalThis as any).window,oldFetch=globalThis.fetch;let calls=0;
 const events=new EventTarget();(globalThis as any).window=Object.assign(events,{sessionStorage:{getItem:()=>''}});
 events.addEventListener('microfixd:auth-required',()=>events.dispatchEvent(new Event('microfixd:auth-cancelled')));
 globalThis.fetch=async()=>{calls++;return Response.json({code:'AUTH_REQUIRED'},{status:403});};
 try{await assert.rejects(runSystemCommand('retain',{},'auth-session'),/not executed/);assert.equal(calls,1);}
 finally{(globalThis as any).window=oldWindow;globalThis.fetch=oldFetch;}
});
