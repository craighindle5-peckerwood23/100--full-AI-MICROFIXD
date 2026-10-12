import test from'node:test';
import assert from'node:assert/strict';
import{telemetryToEmotion}from'../cognitive-shell/src/core/mapping/telemetryToEmotion';
import{telemetryToIndicators}from'../cognitive-shell/src/core/mapping/telemetryToIndicators';
import{createShellStore}from'../cognitive-shell/src/core/shellState';
import{createCommandBus}from'../cognitive-shell/src/core/commandBus';

test('cognitive shell maps backend states deterministically',()=>{
 assert.equal(telemetryToEmotion({type:'command.error',severity:'error'}),'error');
 assert.equal(telemetryToEmotion({type:'approval.pending',state:'waiting'}),'waiting');
 assert.equal(telemetryToEmotion({type:'tool.execute',state:'executing'}),'executing');
 assert.equal(telemetryToEmotion({type:'planner',state:'thinking'}),'thinking');
});

test('cognitive shell indicators use measured telemetry and clamp signal',()=>{
 assert.deepEqual(telemetryToIndicators({type:'system.deep-health',state:'degraded',agents:42,signal:140,severity:'warn'}),{status:'degraded',agents:42,signal:100,severity:'warn'});
 assert.deepEqual(telemetryToIndicators({type:'system.deep-health',agents:-2,signal:-20}),{status:'system.deep-health',agents:0,signal:0,severity:'info'});
});

test('shell store translates voice telemetry into facial speaking state',()=>{
 const store=createShellStore();
 store.getState().ingest({type:'voice.speaking',state:'active',signal:90});
 assert.equal(store.getState().vm.mouth,'speaking');
 assert.equal(store.getState().vm.indicators.signal,90);
});

test('command bus forwards one JSON-safe command unchanged',async()=>{
 const seen:any[]=[];const bus=createCommandBus(async command=>{seen.push(command)});
 const command={kind:'user.command',requestId:'req-1',payload:{text:'inspect system'}};
 await bus.send(command);
 assert.deepEqual(seen,[command]);
});
