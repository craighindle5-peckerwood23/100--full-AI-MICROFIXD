import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BackoffEngine} from '../server/utils/backoffEngine';

test('full jitter remains within exponential and configured bounds',()=>{
  for(let attempt=0;attempt<15;attempt++) for(let i=0;i<20;i++){
    const delay=BackoffEngine.calculateJitter({baseDelayMs:100,maxDelayMs:3000,attempt});
    assert.ok(delay>=0&&delay<=Math.min(3000,100*2**attempt));
  }
});
test('zero window and invalid values',()=>{
  assert.equal(BackoffEngine.calculateJitter({baseDelayMs:0,maxDelayMs:0,attempt:5}),0);
  assert.throws(()=>BackoffEngine.calculateJitter({baseDelayMs:100,maxDelayMs:20,attempt:0}),RangeError);
  assert.throws(()=>BackoffEngine.calculateJitter({baseDelayMs:NaN,maxDelayMs:100,attempt:0}),RangeError);
});
test('abortable asynchronous wait',async()=>{
  const controller=new AbortController();
  controller.abort(new Error('cancelled'));
  await assert.rejects(BackoffEngine.executeWait({baseDelayMs:10,maxDelayMs:100,attempt:2},controller.signal),/cancelled/);
});
