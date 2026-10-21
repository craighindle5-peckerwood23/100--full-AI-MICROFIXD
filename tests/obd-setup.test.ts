import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import express from 'express';
import {bridgePackage,BRIDGE_PACKAGE_FILES} from '../server/automotive/obd/bridgePackage';
import {createOBDRouter} from '../server/automotive/obd/obdRouter';
import {executeAutomotiveOrgan} from '../server/organs/organs/automotiveOrgan';
import {getTool} from '../server/tools/toolRegistry';
import {READ_TOOLS} from '../server/planner/governedTools';

test('connector package contains the exact deployed runnable source and no credentials or DLLs',()=>{
 const bundle=bridgePackage(),zip=Buffer.from(bundle.archiveBase64,'base64');
 assert.equal(createHash('sha256').update(zip).digest('hex'),bundle.sha256);
 const files=unzipSync(zip);assert.equal(Object.keys(files).length,BRIDGE_PACKAGE_FILES.length);
 for(const name of BRIDGE_PACKAGE_FILES)assert.deepEqual(Buffer.from(files[`microfixd-obd-bridge/${name}`]),readFileSync(`integrations/obd-bridge/${name}`));
 assert.ok(strFromU8(files['microfixd-obd-bridge/START-WINDOWS.cmd']).includes('bridge.py --setup'));
 assert.ok(!Object.keys(files).some(name=>/\.env|\.dll|session|secret/i.test(name)));
});
test('setup is a registered callable read tool that works without database initialization',async()=>{
 const tool=getTool('obd_connection_setup');assert.equal(tool?.action,'obd_setup');assert.ok(READ_TOOLS.has(tool!.name));
 const result:any=await executeAutomotiveOrgan('obd_setup',{tenant_id:'test-tenant'});
 assert.equal(result.localBridgeRequired,true);assert.equal(result.capabilities.hardwareCompatibilityVerified,false);assert.equal(result.capabilities.ecuProgramming,false);
 assert.deepEqual(result.guidedCommand,['python','bridge.py','--setup']);
});
test('authenticated setup/download need no DB; readiness distinguishes reachable storage from hardware',async()=>{
 let calls=0;
 const app=express();app.use((req:any,_res,next)=>{if(req.header('x-fixture-auth')){req.microfixdRole='observer';req.microfixdTenantId='fixture-tenant';}next();});
 app.use('/obd',createOBDRouter(()=>{calls++;return {list:async()=>[]} as any;}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}/obd`,headers={'x-fixture-auth':'yes'};
 try{
  assert.equal((await fetch(base+'/bridge-package')).status,403);
  const capabilities=await (await fetch(base+'/capabilities',{headers})).json();assert.equal(capabilities.version,2);
  const archive=await (await fetch(base+'/bridge-package',{headers})).json();assert.equal(archive.filename,'microfixd-obd-bridge.zip');assert.equal(calls,0);
  const readiness=await (await fetch(base+'/readiness',{headers})).json();assert.equal(readiness.cloudStorageReachable,true);assert.equal(readiness.hardwareReady,false);assert.equal(calls,1);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
