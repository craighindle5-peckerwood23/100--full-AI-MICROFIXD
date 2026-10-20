import test from 'node:test';
import assert from 'node:assert/strict';
import {computeAvatar} from '../cognitive-shell/src/hio/sync/CognitionSync';
import {mapTelemetry} from '../cognitive-shell/src/hio/sync/TelemetrySync';
import {mapViseme} from '../cognitive-shell/src/hio/animation/VisemeMapper';
import {AnimationEngine} from '../cognitive-shell/src/hio/animation/AnimationEngine';
import {selectShaderProfile} from '../cognitive-shell/src/hio/renderer/ShaderProfiles';
import {chooseGraphicsQuality} from '../cognitive-shell/src/hio/renderer/GraphicsQuality';
import {fragmentShader,auraFragmentShader} from '../cognitive-shell/src/hio/renderer/shaders/hologramShader';
import {createShellStore} from '../cognitive-shell/src/core/shellState';

test('HIO leaves missing cognition unknown and bounds adversarial telemetry',()=>{
 const unknown=computeAvatar({});assert.equal(unknown.confidence,null);assert.equal(unknown.policyMode,'unknown');
 const s=computeAvatar({cognition:{confidence:9,uncertainty:-2},telemetry:{systemLoad:Infinity,errorRate:-99,packetLoss:500}});
 assert.equal(s.confidence,1);assert.equal(s.uncertainty,0);assert.ok(s.distortion<=.012);assert.ok(Number.isFinite(s.flicker));assert.equal(mapTelemetry({environment:'offline-mode'}).alpha,.5);
});
test('visemes follow the playback clock and gaps close the mouth',()=>{
 const frame={utteranceId:'a',speaking:true,playbackMs:100,visemes:[{atMs:0,durationMs:80,value:'PP'},{atMs:100,durationMs:90,value:'aa'}]};
 assert.equal(mapViseme(frame)?.jawOpen,.85);assert.equal(mapViseme({...frame,playbackMs:95})?.jawOpen,0);assert.equal(mapViseme({...frame,speaking:false}),null);
});
test('dropout closes the jaw immediately and reduced motion suppresses distortion',()=>{
 const engine=new AnimationEngine(),audio={utteranceId:'a',speaking:true,playbackMs:0,visemes:[{atMs:0,durationMs:1000,value:'aa'}]};
 assert.ok(engine.update({audio},.1,3,false).blendshapes.jawOpen>0);
 const stopped=engine.update({audio,telemetry:{audioDropout:true,systemLoad:1}},.01,4,true);
 assert.equal(stopped.blendshapes.jawOpen,0);assert.equal(stopped.distortion,0);assert.equal(stopped.flicker,0);assert.equal(stopped.blink,0);
});
test('operator profile takes precedence and reset resumes automatic selection',()=>{
 assert.equal(selectShaderProfile({}, {systemLoad:1},'minimal'),'minimal');
 assert.equal(selectShaderProfile({}, {systemLoad:1}),'error');
 assert.equal(selectShaderProfile({reflectionState:'thinking'}, {}),'full');
 assert.equal(selectShaderProfile({policyMode:'strict'}, {}),'diagnostic');
});
test('health updates do not interrupt speaking and idle voice never reopens the jaw',()=>{
 const store=createShellStore();store.getState().ingest({type:'voice.state',state:'speaking'});
 store.getState().ingest({type:'system.deep-health',state:'ok',agents:12});assert.equal(store.getState().vm.mouth,'speaking');
 store.getState().ingest({type:'voice.state',state:'idle'});assert.equal(store.getState().vm.mouth,'idle');assert.equal(store.getState().vm.indicators.agents,12);
 store.getState().ingest({type:'hio.cognition',data:{confidence:.82,policyMode:'safe'}});assert.equal(store.getState().vm.hio?.cognition?.confidence,.82);
});

test('real assurance bus signals reach HIO without inventing confidence from health',async()=>{
 const {hostSignals}=await import('../cognitive-shell/src/hio/sync/HostSignals');
 assert.equal(hostSignals({type:'system.readiness',signal:100}).cognition,undefined);
 const measured=hostSignals({type:'assurance:complete',data:{confidence:.81,uncertainty:.19}});
 assert.equal(measured.cognition?.confidence,.81);
 assert.equal(hostSignals({type:'command:started'},measured).cognition?.confidence,undefined);
 assert.equal(hostSignals({type:'hitl:review_required'}).cognition?.policyMode,'defer');
});

test('cinematic detail scales safely from desktop to mobile',()=>{
 const desktop=chooseGraphicsQuality(1536,960,2);
 const mobile=chooseGraphicsQuality(390,844,3);
 assert.equal(desktop.tier,'cinematic');
 assert.equal(desktop.pixelRatio,1.8);
 assert.equal(desktop.particleCount,2600);
 assert.equal(mobile.tier,'efficient');
 assert.ok(mobile.pixelRatio<=1.25);
 assert.ok(mobile.particleCount<desktop.particleCount);
 assert.equal(chooseGraphicsQuality(NaN,NaN,Infinity).tier,'efficient');
});
test('hologram materials preserve boot, expression, neural and halo uniforms',()=>{
 for(const uniform of ['reveal','blink','activity','profileColor','opacity'])assert.ok(fragmentShader.includes('uniform float '+uniform)||fragmentShader.includes('uniform vec3 '+uniform));
 assert.ok(fragmentShader.includes('fwidth('));
 assert.ok(auraFragmentShader.includes('haloStrength'));
});
