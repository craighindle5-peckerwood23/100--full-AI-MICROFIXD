import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
process.env.GROQ_API_KEY='test-groq';
process.env.SUPABASE_URL='https://memory-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-key';
process.env.ADMIN_TOKEN='test-admin';
process.env.OPERATOR_TOKEN='test-operator';
const originalFetch=globalThis.fetch;
const rows:any[]=[];let failDatabase=false, sawHistory=false, sawFullEvidence=false;
globalThis.fetch=async(input:any,init:any)=>{
  const request=input instanceof Request ? input : new Request(input,init);
  const url=new URL(request.url);
  if(url.hostname==='memory-test.supabase.co'){
    if(failDatabase)return new Response(JSON.stringify({code:'42501',message:'denied'}),{status:403});
    if(request.method==='HEAD')return new Response(null,{headers:{'content-range':`0-0/${rows.length}`}});
    if(request.method==='POST'){const row=await request.json();rows.push(row);return Response.json({id:row.id});}
    const filter=url.searchParams.get('metadata');
    const session=filter ? JSON.parse(filter.slice(3)).session_id : undefined;
    return Response.json(rows.filter(r=>!session||r.metadata.session_id===session));
  }
  if(url.hostname==='api.groq.com'){
    const body=await request.json();
    const router=body.messages[0]?.content.includes('Classify the task');
    if(body.messages.some((m:any)=>m.content.includes("EVIDENCE_END")))sawFullEvidence=true;
    if(body.messages.some((m:any)=>m.content.includes('Prior conversation data')))sawHistory=true;
    return Response.json({id:'test',object:'chat.completion',created:1,model:'qwen/qwen3.8-27b',choices:[{index:0,message:{role:'assistant',content:router?'{"intent":"execute","complexity":"medium","organs":["brain","memory"]}':body.messages.some((m:any)=>m.content.includes('Untrusted request context'))?'repair value 42 '+ 'x'.repeat(500)+'EVIDENCE_END':'repair value 42'},finish_reason:'stop'}],usage:{total_tokens:10}});
  }
  return originalFetch(input,init);
};
test('authenticated HTTP memory, sandbox approval, Playwright and websocket services',async()=>{
  const {app,server,wss}=await import('../server/index');
  const {browserManager}=await import('../server/playwright/browserManager');
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const fixture=http.createServer((_,res)=>res.end('<title>Service smoke</title><input id="field"><button id="go" onclick="document.querySelector(\'#out\').textContent=document.querySelector(\'#field\').value">Go</button><p id="out"></p>'));
  await new Promise<void>(resolve=>fixture.listen(0,'127.0.0.1',resolve));
  const fixtureURL=`http://127.0.0.1:${(fixture.address() as any).port}`;
  const call=async(path:string,body?:any,token='test-admin')=>{
    const response=await originalFetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json() as any};
  };
  try{
    assert.equal((await call('/api/sandbox/run',{code:'console.log(42)',lang:'javascript'},'')).status,403);
    const first=await call('/api/command/run',{task:'remember repair value 42',session_id:'service-session'});
    assert.equal(first.body.success,true,JSON.stringify(first.body));
    assert.ok(rows.some(r=>r.agent_id==='command'));
    assert.equal(sawFullEvidence,true);
    assert.deepEqual(first.body.diagnostics.stages.slice(-4),["verification","persistence","feedback","response"]);
    const second=await call('/api/command/run',{task:'recall repair value',session_id:'service-session'});
    assert.equal(second.body.success,true);assert.equal(sawHistory,true);
    assert.equal((await call('/api/health/deep')).status,200);
    failDatabase=true;
    assert.equal((await call('/api/health/deep')).status,503);
    assert.equal((await call('/api/command/run',{task:'test failed memory',session_id:'service-session'})).body.success,false);
    failDatabase=false;
    const code='console.log(42)';
    const submitted=await call('/api/sandbox/run',{code,lang:'javascript',session_id:'service-sandbox'},'test-operator');
    assert.equal(submitted.status,202);const id=submitted.body.approval_id;
    assert.equal((await call('/api/hitl/decide',{hitl_id:id,decision:'approved'},'test-operator')).status,403);
    assert.equal((await call('/api/hitl/decide',{hitl_id:id,decision:'approved'})).status,200);
    const execution=await call('/api/sandbox/run',{code,lang:'javascript',session_id:'service-sandbox',approval_id:id});
    assert.equal(execution.body.success,true,execution.body.stderr);assert.equal(execution.body.stdout,'42');
    const mcp=await call('/api/mcp/call',{tool_name:'sandbox_run',arguments:{code,lang:'javascript'}});
    assert.equal(mcp.body.success,false);assert.equal(mcp.body.result.approval_required,true);
    const navigation=await call('/api/playwright/navigate',{url:fixtureURL});
    assert.equal(navigation.body.success,true,JSON.stringify(navigation.body));
    assert.equal((await call('/api/playwright/fill',{selector:'#field',value:'service works'})).body.success,true);
    assert.equal((await call('/api/playwright/click',{selector:'#go'})).body.success,true);
    assert.equal((await call('/api/playwright/text?selector=%23out')).body.text,'service works');
    assert.ok((await call('/api/playwright/screenshot')).body.screenshot.length>1000);
    assert.equal((await call('/api/playwright/evaluate',{js:'typeof process'})).body.result,'undefined');
    const unauthorized=new WebSocket(base.replace('http:','ws:')+'/ws');
    await new Promise<void>((resolve,reject)=>{unauthorized.once('open',()=>unauthorized.send(JSON.stringify({type:'ping'})));unauthorized.once('close',code=>{try{assert.equal(code,1008);resolve();}catch(err){reject(err);}});unauthorized.once('error',reject);});
    const authorized=new WebSocket(base.replace('http:','ws:')+'/ws');
    await new Promise<void>((resolve,reject)=>{authorized.once('open',()=>authorized.send(JSON.stringify({type:'authenticate',payload:{token:'test-admin'}})));authorized.once('message',data=>{try{assert.equal(JSON.parse(String(data)).type,'authenticated');authorized.close();resolve();}catch(err){reject(err);}});authorized.once('error',reject);});
  } finally {
    await browserManager.stop();wss.clients.forEach(ws=>ws.terminate());
    await new Promise<void>(resolve=>wss.close(()=>resolve()));
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    await new Promise<void>(resolve=>fixture.close(()=>resolve()));
    globalThis.fetch=originalFetch;
  }
});
