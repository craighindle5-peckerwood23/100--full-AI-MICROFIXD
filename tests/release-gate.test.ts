import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRelease} from '../server/evolution/releaseGate';
const policy={version:'v1',required_cases:['security','recovery'],maximum_failures:0};
test('complete passing evaluation permits release with stable provenance',()=>{
 const a=evaluateRelease(policy,[{id:'security',passed:true},{id:'recovery',passed:true}]);
 assert.equal(a.approved,true);assert.match(a.hash,/^[a-f0-9]{64}$/);
 assert.equal(a.hash,evaluateRelease(policy,[{id:'recovery',passed:true},{id:'security',passed:true}]).hash);
});
test('failed, missing, duplicate and unexpected cases reject release',()=>{
 for(const results of [[{id:'security',passed:false},{id:'recovery',passed:true}],[{id:'security',passed:true}],[{id:'security',passed:true},{id:'security',passed:true},{id:'recovery',passed:true}],[{id:'security',passed:true},{id:'recovery',passed:true},{id:'extra',passed:true}]])assert.equal(evaluateRelease(policy,results).approved,false);
});
test('malformed policy and forged result types fail closed',()=>{
 assert.throws(()=>evaluateRelease({...policy,maximum_failures:1},[]));
 assert.throws(()=>evaluateRelease({...policy,required_cases:['security','security']},[]));
 assert.throws(()=>evaluateRelease(policy,[{id:'security',passed:'true'}] as any));
});

test('evolution refuses fabricated proposals and unverified application',async()=>{
 const {executeEvolutionOrgan}=await import('../server/organs/organs/evolutionOrgan');
 const previous=process.env.GROQ_API_KEY,legacy=process.env.VITE_GROQ_API_KEY;
 delete process.env.GROQ_API_KEY;delete process.env.VITE_GROQ_API_KEY;
 try{
  await assert.rejects(executeEvolutionOrgan('propose',{}),/EVOLUTION_PROPOSAL_UNAVAILABLE/);
  await assert.rejects(executeEvolutionOrgan('apply_proposal',{id:'unverified'}),/GOVERNED_RELEASE_REQUIRED/);
  const status=await executeEvolutionOrgan('status',{}) as any;assert.equal(status.auto_apply,false);
 }finally{if(previous!==undefined)process.env.GROQ_API_KEY=previous;if(legacy!==undefined)process.env.VITE_GROQ_API_KEY=legacy;}
});
