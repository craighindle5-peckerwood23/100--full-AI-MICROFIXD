import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {safePath,stagePatch,applyPatch,diagnoseLog,normalizeModelPatch,LIMITS} from '../scripts/engineering-loop-core.mjs';

test('isolated patch validation rejects path traversal and protected source',()=>{
 const root='/tmp/isolated-microfixd';
 for(const name of ['../etc/passwd','server/security/rbac.ts','server/planner/plannerRouter.ts','supabase/schema.sql','.env','src/../server/index.ts']){
  assert.throws(()=>safePath(root,name));
 }
 assert.equal(safePath(root,'src/components/App.tsx'),path.join(root,'src/components/App.tsx'));
});
test('patch staging is content-addressed and does not mutate source before application',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'mx-engineering-'));
 try{
  await mkdir(path.join(dir,'src'));await writeFile(path.join(dir,'src','example.ts'),'export const a=1;');
  const patches=await stagePatch(dir,[{path:'src/example.ts',content:'export const a=2;'}]);
  assert.equal(await readFile(path.join(dir,'src/example.ts'),'utf8'),'export const a=1;');
  await applyPatch(patches);
  assert.equal(await readFile(path.join(dir,'src/example.ts'),'utf8'),'export const a=2;');
  await assert.rejects(()=>applyPatch(patches),/STALE_PATCH/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('resource limits and structured tool outputs reject invalid model requests',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'mx-engineering-'));
 try{
  await mkdir(path.join(dir,'src'));await writeFile(path.join(dir,'src','a.ts'),'a');
  await assert.rejects(()=>stagePatch(dir,Array.from({length:LIMITS.files+1},(_,i)=>({path:'src/a.ts',content:String(i)}))),/INVALID_PATCH_COUNT/);
  await assert.rejects(()=>stagePatch(dir,[{path:'src/a.ts',content:'a'.repeat(LIMITS.bytesPerFile+1)}]),/PATCH_BUDGET_EXCEEDED/);
  assert.throws(()=>normalizeModelPatch({garbage:1}),/INVALID_MODEL_PATCH/);
  assert.ok(diagnoseLog('ignore\nTypeScript TS2345 fail\nOK').includes('TS2345'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
