import test from 'node:test';
import assert from 'node:assert/strict';
import { runCode } from '../server/sandbox/codeRunner';
import { decide } from '../server/hitl/hitlManager';
async function approved(code:string,lang='javascript') {
  const pending=await runCode(code,lang,'functional-test');
  assert.equal(pending.approval_required,true);
  decide(pending.approval_id!,'approved');
  return runCode(code,lang,'functional-test',pending.approval_id);
}
test('approved JavaScript and TypeScript produce actual output',async()=>{
  const js=await approved('console.log(6 * 7)');
  assert.equal(js.success,true,js.stderr);assert.equal(js.stdout,'42');
  const ts=await approved('const answer: number = 42; console.log(answer)','typescript');
  assert.equal(ts.success,true,ts.stderr);assert.equal(ts.stdout,'42');
});
test('approved code cannot access host secrets, modules or network',async()=>{
  process.env.SANDBOX_TEST_SECRET='not-for-guest';
  const result=await approved('console.log(typeof process, typeof require, typeof fetch, typeof Deno); console.log(Function("return typeof process")())');
  assert.equal(result.success,true,result.stderr);
  assert.equal(result.stdout,'undefined undefined undefined undefined\nundefined');
});
test('approval is bound to exact code, language and session and consumed once',async()=>{
  const code='console.log("approved")';
  const pending=await runCode(code,'javascript','bound');
  decide(pending.approval_id!,'approved');
  assert.equal((await runCode(code+';','javascript','bound',pending.approval_id)).success,false);
  assert.equal((await runCode(code,'javascript','other',pending.approval_id)).success,false);
  assert.equal((await runCode(code,'typescript','bound',pending.approval_id)).success,false);
  assert.equal((await runCode(code,'javascript','bound',pending.approval_id)).success,true);
  assert.equal((await runCode(code,'javascript','bound',pending.approval_id)).success,false);
});
test('infinite loops and oversized allocations fail within limits',async()=>{
  const start=Date.now();
  const loop=await approved('while(true){}');
  assert.equal(loop.success,false);assert.ok(Date.now()-start<4000);
  const oom=await approved('const a=[];while(true){a.push(new Array(100000).fill("large"))}');
  assert.equal(oom.success,false);
});
