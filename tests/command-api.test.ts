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
