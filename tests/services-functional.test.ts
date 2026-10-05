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
const rows:any[]=[];let failDatabase=false, sawHistory=false, sawFullEvidence=false, truncateBrain=false, dynamicRoute=false, toolScenario=false;
globalThis.fetch=async(input:any,init:any)=>{
  const request=input instanceof Request ? input : new Request(input,init);
  const url=new URL(request.url);
  if(url.hostname==='memory-test.supabase.co'){
    if(failDatabase)return new Response(JSON.stringify({code:'42501',message:'denied'}),{status:403});
    if(request.method==='HEAD')return new Response(null,{headers:{'content-range':`0-0/${rows.length}`}});
    if(request.method==='POST'){const row=await request.json();if(!rows.some(r=>r.id===row.id))rows.push(row);return Response.json({id:row.id});}
    const filter=url.searchParams.get('metadata');
    const session=filter ? JSON.parse(filter.slice(3)).session_id : undefined;
    const id=url.searchParams.get('id')?.slice(3);
    const selected=rows.filter(r=>(!session||r.metadata.session_id===session)&&(!id||r.id===id)).reverse().slice(0,Number(url.searchParams.get('limit')||100));
    if(request.headers.get('accept')?.includes('vnd.pgrst.object'))return selected.length?Response.json(selected[0]):new Response(JSON.stringify({code:'PGRST116',message:'JSON object requested, multiple (or no) rows returned',details:'The result contains 0 rows'}),{status:406});
    return Response.json(selected);
  }
  if(url.hostname==='api.groq.com'){
    const body=await request.json();
    const router=body.messages[0]?.content.includes('Classify the task');
    if(toolScenario && body.tools){
      const results=body.messages.filter((m:any)=>m.role==='tool');
      if(!results.length)return Response.json({id:'tool-test',model:'test-model',choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'bad',type:'function',function:{name:'store_memory',arguments:'invalid-json'}},{id:'recall',type:'function',function:{name:'recall_memory',arguments:JSON.stringify({query:'repair value'})}}]},finish_reason:'tool_calls'}]});
      assert.equal(results.length,2);assert.ok(results.some((m:any)=>m.tool_call_id==='bad'&&m.content.includes('error')));
      assert.ok(results.some((m:any)=>m.tool_call_id==='recall'&&m.content.includes('repair value')));
      return Response.json({id:'tool-final',model:'test-model',choices:[{message:{role:'assistant',content:'Recall succeeded; invalid storage request failed.'},finish_reason:'stop'}]});
    }
    if(!router && body.messages[0]?.content!=='Reply with OK.')assert.equal(body.max_tokens,10000);
    if(body.messages.some((m:any)=>m.content.includes("EVIDENCE_END")))sawFullEvidence=true;
    if(body.messages.some((m:any)=>m.content.includes('Prior conversation data')))sawHistory=true;
    return Response.json({id:'test',object:'chat.completion',created:1,model:'qwen/qwen3.8-27b',choices:[{index:0,message:{role:'assistant',content:router?JSON.stringify({intent:'execute',complexity:'medium',organs:dynamicRoute?['memory',...Array.from({length:6},(_,i)=>`review_test_${i}`),'brain']:['brain','memory']}):body.messages.some((m:any)=>m.content.includes('Untrusted request context'))?'repair value 42 '+ 'x'.repeat(500)+'EVIDENCE_END':'repair value 42'},finish_reason:truncateBrain&&!router?'length':'stop'}],usage:{total_tokens:10}});
  }
  return originalFetch(input,init);
};
test('authenticated HTTP memory, sandbox approval, Playwright and websocket services',async()=>{
  const {app,server,wss}=await import('../server/index');
  const {setCustomBroadcaster}=await import('../server/events');
  const events:{type:string;payload:any}[]=[];setCustomBroadcaster((type,payload)=>events.push({type,payload}));
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
    assert.equal((await call('/api/groq/check',{},'')).status,403);
    const status=await call('/api/groq/status');assert.equal(status.body.configured,true);assert.equal(JSON.stringify(status.body).includes('test-groq'),false);
    const probe=await call('/api/groq/check',{});assert.equal(probe.body.connected,true);assert.equal(rows.length,0,'Provider check must work independently of memory');
    const first=await call('/api/command/run',{task:'remember repair value 42',session_id:'service-session'});
    assert.equal(first.body.success,true,JSON.stringify(first.body));
    assert.ok(rows.some(r=>r.agent_id==='command'));
    assert.equal(sawFullEvidence,true);
    assert.deepEqual(first.body.diagnostics.stages.slice(-4),["verification","persistence","feedback","response"]);
    const second=await call('/api/command/run',{task:'recall repair value',session_id:'service-session'});
    assert.equal(second.body.success,true);assert.equal(sawHistory,true);
    toolScenario=true;
    const toolRun=await call('/api/tools/run',{message:'recall repair value',session_id:'service-session'});
    toolScenario=false;
    assert.equal(toolRun.body.success,true,JSON.stringify(toolRun.body));
    assert.ok(rows.some(r=>r.agent_id==='tools'&&r.metadata.session_id==='service-session'));
    assert.ok(rows.some(r=>r.agent_id==='feedback'&&r.metadata.session_id==='service-session'));
    dynamicRoute=true;
    const dynamic=await call('/api/command/run',{task:'test sequential dynamic routing',session_id:'dynamic-session'});
    assert.equal(dynamic.body.success,true,JSON.stringify(dynamic.body));dynamicRoute=false;
    assert.equal(dynamic.body.organs_used.filter((id:string)=>id.startsWith('review_test_')).length,6);
    for(let repeat=0;repeat<4;repeat++)assert.equal((await call('/api/command/run',{task:'recall repair value',session_id:'service-session'})).body.success,true);
    const brainRows=rows.filter(r=>r.agent_id==='brain');
    for(const row of brainRows){assert.equal(JSON.parse(row.content).messages.length,1);assert.ok(!row.content.includes('Untrusted request context'));}
    truncateBrain=true;
    const truncated=await call('/api/command/run',{task:'test truncated explanation',session_id:'truncated-session'});
    assert.equal(truncated.body.success,false);assert.match(truncated.body.output,/output truncated/);assert.ok(truncated.body.output.length<500);truncateBrain=false;
    const spoken=await call('/api/command/run',{task:'explain repair completely',session_id:'spoken-session',source:'voice'});
    assert.equal(spoken.body.delivery_state,'awaiting_playback');assert.ok(spoken.body.response_id);
    assert.ok(events.some(e=>e.type==='response_complete'&&e.payload.response_id===spoken.body.response_id));
    assert.equal(events.filter(e=>e.type==='command:complete'&&e.payload.session_id==='spoken-session').length,0);
    const ack={response_id:spoken.body.response_id,session_id:'spoken-session',status:'played'};
    assert.equal((await call('/api/command/output/ack',ack,'')).status,403);
    assert.equal((await call('/api/command/output/ack',{...ack,session_id:'wrong-session'})).status,400);
    assert.equal((await call('/api/command/output/ack',{...ack,status:'failed'})).body.state,'failed');
    assert.equal(events.filter(e=>e.type==='mission:completed').length,0);
    assert.equal((await call('/api/command/output/ack',ack)).body.state,'completed');
    assert.equal((await call('/api/command/output/ack',ack)).body.state,'completed');
    assert.equal(rows.filter(r=>r.id===`playback:${ack.response_id}`).length,1);
    assert.equal(events.filter(e=>e.type==='mission:completed'&&e.payload.response_id===ack.response_id).length,1);
    const window=await call('/api/organs/memory/execute',{action:'context',payload:{session_id:'spoken-session',limit:30,max_chars:60000}});
    assert.equal(window.status,200);assert.ok(JSON.stringify(window.body).includes('explain repair completely'));
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
    globalThis.fetch=originalFetch;setCustomBroadcaster(null as any);
  }
});
