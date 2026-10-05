import test from 'node:test';
import assert from 'node:assert/strict';
process.env.ADMIN_TOKEN='website-test-admin';
process.env.OPERATOR_TOKEN='website-test-operator';
test('website and assets are public while operational APIs require authentication',async()=>{
  const {server,wss}=await import('../server/index');
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  try{
    const root=await fetch(base+'/');assert.equal(root.status,200);assert.match(root.headers.get('content-type')||'',/text\/html/);
    const html=await root.text();const asset=html.match(/src="(\/assets\/[^\"]+\.js)"/);assert.ok(asset,'Built frontend asset missing');
    const js=await fetch(base+asset[1]);assert.equal(js.status,200);assert.match(js.headers.get('content-type')||'',/javascript/);
    assert.equal((await fetch(base+'/settings')).status,200);
    assert.equal((await fetch(base+'/api/health')).status,200);
    assert.equal((await fetch(base+'/api/organs')).status,403);
    assert.equal((await fetch(base+'/api/command/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'unauthorized'})})).status,403);
    assert.equal((await fetch(base+'/api/classification/map',{headers:{Authorization:'Bearer website-test-admin'}})).status,200);
    assert.equal((await fetch(base+'/api/autonomy/approvals',{headers:{Authorization:'Bearer website-test-admin'}})).status,200);
    assert.equal((await fetch(base+'/api/autonomy/approvals',{headers:{'x-microfixd-admin-key':'website-test-admin'}})).status,200);
    assert.equal((await fetch(base+'/api/autonomy/approvals',{headers:{Authorization:'Bearer website-test-operator'}})).status,403);
    assert.equal((await fetch(base+'/api/autonomy/approvals',{headers:{'x-microfixd-admin-key':'invalid'}})).status,403);
    assert.equal((await fetch(base+'/api/organs',{headers:{'x-microfixd-admin-key':'website-test-admin'}})).status,403);
    delete process.env.ADMIN_TOKEN;
    assert.equal((await fetch(base+'/api/autonomy/approvals',{headers:{Authorization:'Bearer website-test-operator'}})).status,403);
    process.env.ADMIN_TOKEN='website-test-admin';
    const unknown=await fetch(base+'/api/missing',{headers:{Authorization:'Bearer website-test-admin'}});assert.equal(unknown.status,404);
  }finally{
    wss.clients.forEach(ws=>ws.terminate());await new Promise<void>(resolve=>wss.close(()=>resolve()));await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});
