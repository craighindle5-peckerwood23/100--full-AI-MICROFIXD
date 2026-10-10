import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanaryRouter} from '../server/runtime/canary';
const policy={percentage:100,minimum_samples:2,maximum_error_rate:0.1,timeout_ms:10};
test('candidate failure falls back and trips subsequent routing to stable',async()=>{
 const c=new CanaryRouter(policy);let candidate=0;
 for(let i=0;i<3;i++){const result=await c.execute('tenant:'+i,async()=>7,async()=>{candidate++;throw Error('failure');},v=>v===7);assert.equal(result.value,7);assert.equal(result.lane,i<2?'fallback':'stable');}
 assert.equal(candidate,2);assert.equal(c.snapshot().disabled,true);
});
test('invalid outputs and timeouts fail back without hanging',async()=>{
 const c=new CanaryRouter(policy);assert.equal((await c.execute('a',async()=>1,async()=>2,v=>v===1)).lane,'fallback');
 assert.equal((await c.execute('b',async()=>1,()=>new Promise(()=>{}),v=>v===1)).lane,'fallback');assert.equal(c.snapshot().in_flight,0);
});
test('tenant cohort selection is stable and zero rollout never invokes candidate',async()=>{
 const c=new CanaryRouter({...policy,percentage:0});assert.equal((await c.execute('a',async()=>1,async()=>{throw Error('must not call');},()=>true)).lane,'stable');
 const cohort=new CanaryRouter({...policy,percentage:50});const first=await cohort.execute('tenant:mission',async()=>1,async()=>1,()=>true);const second=await cohort.execute('tenant:mission',async()=>1,async()=>1,()=>true);assert.equal(first.lane,second.lane);
});
test('concurrent candidate failures remain isolated and stable failures propagate',async()=>{
 const c=new CanaryRouter({...policy,minimum_samples:1});const results=await Promise.all(Array.from({length:50},(_,i)=>c.execute(String(i),async()=>i,async()=>{throw Error('candidate');},()=>true)));assert.deepEqual(results.map(r=>r.value),Array.from({length:50},(_,i)=>i));
 await assert.rejects(c.execute('x',async()=>{throw Error('stable unavailable');},async()=>1,()=>true),/stable unavailable/);
});
