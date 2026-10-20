#!/usr/bin/env node
// Offline-first autonomous engineering cycle. All edits happen in a temporary
// git worktree and tests execute in a network-isolated Docker container.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {LIMITS,ALLOWED_TESTS,stagePatch,applyPatch,diagnoseLog,normalizeModelPatch,normalizeTask,digest} from './engineering-loop-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),objective=normalizeTask(args.join(' '));
const model=process.env.MICROFIXD_ENGINEER_MODEL||'openai/gpt-4.1-mini';
const MAX=LIMITS.iterations;
function command(bin,argv,cwd=root,timeoutMs=120000){
 return new Promise(resolve=>{
  let stdout='',stderr='',done=false;
  const child=spawn(bin,argv,{cwd,env:{PATH:process.env.PATH||''},stdio:['ignore','pipe','pipe']});
  const settle=(code,extra='')=>{if(done)return;done=true;clearTimeout(timer);resolve({code,stdout,stderr:stderr+extra});};
  const timer=setTimeout(()=>{child.kill('SIGKILL');settle(124,' TIMEOUT');},timeoutMs);
  child.stdout.on('data',c=>{stdout=(stdout+String(c)).slice(-LIMITS.logBytes);});
  child.stderr.on('data',c=>{stderr=(stderr+String(c)).slice(-LIMITS.logBytes);});
  child.on('error',e=>settle(127,String(e)));child.on('close',c=>settle(c??1));
 });
}
function requireSuccess(result,stage){if(result.code!==0)throw Error(stage+': '+diagnoseLog(result.stderr+'\n'+result.stdout));}
async function plan(messages){
 const token=process.env.OPENROUTER_API_KEY;
 if(!token)throw Error('OPENROUTER_API_KEY_REQUIRED');
 const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({model,messages,temperature:0,max_tokens:5500,response_format:{type:'json_object'}}),
  signal:AbortSignal.timeout(90000)});
 if(!r.ok)throw Error('LLM_HTTP_'+r.status);
 const data=await r.json(),choice=data.choices?.[0];
 if(choice?.finish_reason==='length')throw Error('TRUNCATED_PLAN');
 return JSON.parse(choice?.message?.content||'null');
}
async function verify(workspace){
 const tests=['npm run lint','npm run test:spine'];
 const results=[];
 for(const test of tests){
  if(!ALLOWED_TESTS.includes(test))throw Error('COMMAND_NOT_ALLOWED');
  const parts=test.split(' ');
  const options=['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
   '--memory','1024m','--cpus','1.5','--pids-limit','160','--tmpfs','/tmp:rw,nosuid,nodev,size=96m',
   '-v',workspace+':/work:rw','-v',root+'/node_modules:/work/node_modules:ro','-w','/work','node:22',
   ...parts];
  const result=await command('docker',options,root,120000);
  results.push({test,code:result.code,diagnostic:diagnoseLog(result.stdout+'\n'+result.stderr)});
  if(result.code!==0)break;
 }
 return {pass:results.every(r=>r.code===0),results};
}
async function main(){
 const id=randomUUID(),temp=await mkdtemp(path.join(tmpdir(),'microfixd-engineering-'));
 const workspace=path.join(temp,'workspace');
 const journal={id,objective,state:'discovering',iterations:[],startedAt:new Date().toISOString(),limits:LIMITS};
 const save=async()=>writeFile(path.join(root,'engineering-last-run.json'),JSON.stringify(journal,null,2)+'\n');
 try{
  requireSuccess(await command('git',['worktree','add','--detach',workspace,'HEAD']),'WORKTREE_CREATE');
  const tracked=await command('git',['ls-files'],workspace);
  requireSuccess(tracked,'DISCOVER_FILES');
  const files=tracked.stdout.split('\n').filter(Boolean);
  const recent=await command('git',['log','-5','--oneline'],workspace);
  const docs=[];
  for(const file of ['README.md','package.json','docs/execution-spine.md']){
   if(files.includes(file))docs.push({path:file,text:(await readFile(path.join(workspace,file),'utf8')).slice(0,3500)});
  }
  journal.discovery={trackedFiles:files.length,recentCommits:recent.stdout,docs:docs.map(d=>d.path)};
  journal.state='planning';await save();
  const messages=[
   {role:'system',content:'You are Microfixd engineering planner. Output ONLY JSON of shape {"files":[{"path":"existing/path.ts","content":"complete new file contents"}],"reason":"short","question":null}. Do not invent changes or paths. Make minimal changes, never touch infra/secrets/security/governance, never write code that disables approval. If requirements conflict, emit {"files":[],"question":"specific conflict","choices":["A","B"]}. The runner validates paths and tests independently. Do not claim tests passed.'},
   {role:'user',content:JSON.stringify({objective,files:files.filter(p=>p.startsWith('server/')||p.startsWith('src/')||p.startsWith('microfixd/')||p.startsWith('tests/')).slice(0,350),docs,recent:recent.stdout}).slice(0,LIMITS.contextBytes)}
  ];
  for(let iteration=1;iteration<=MAX;iteration++){
   journal.state='reasoning';await save();
   const proposed=await plan(messages);
   if(proposed?.question){journal.state='needs_clarification';journal.question=proposed.question;journal.choices=proposed.choices;break;}
   const files=normalizeModelPatch(proposed);
   const staged=await stagePatch(workspace,files);
   await applyPatch(staged);
   journal.state='testing';await save();
   const checked=await verify(workspace);
   journal.iterations.push({iteration,paths:staged.map(f=>f.path),hashes:staged.map(f=>({path:f.path,before:f.shaBefore,after:digest(f.after)})),tests:checked.results});
   await save();
   if(checked.pass){journal.state='verified_in_sandbox';break;}
   messages.push({role:'assistant',content:JSON.stringify({reason:proposed.reason,paths:files.map(f=>f.path)})});
   messages.push({role:'user',content:JSON.stringify({result:'TEST_FAILED',diagnostics:checked.results,task:objective})});
   // The next model proposal may only edit the worktree, never the source checkout.
  }
  if(journal.state==='testing'||journal.state==='reasoning')journal.state='budget_exhausted';
  journal.finishedAt=new Date().toISOString();await save();
  console.log(JSON.stringify({id,state:journal.state,iterations:journal.iterations.length,report:'engineering-last-run.json'}));
  if(journal.state!=='verified_in_sandbox')process.exitCode=1;
 }finally{
  await command('git',['worktree','remove','--force',workspace],root,20000);
  await rm(temp,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error('ENGINEERING_LOOP_FAILED:',String(e));process.exitCode=1;});
