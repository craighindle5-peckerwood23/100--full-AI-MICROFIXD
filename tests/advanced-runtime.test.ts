import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateSkill,compileSkill,saveWorkflowSkill,listWorkflowSkills,readWorkflowSkill} from '../server/planner/workflowSkills';
import {SPECIALISTS,checkSpecialistBudget,specialistAgent} from '../server/planner/specialists';
import {parseBrowserWorkflow,runBrowserWorkflow} from '../server/playwright/browserWorkflow';
import {BrowserManager} from '../server/playwright/browserManager';
import {parseIsolatedRequest,runIsolatedCode} from '../server/sandbox/isolatedCode';
import {completeTextWithFallback} from '../server/orchestration/llmFallback';
import {getTool} from '../server/tools/toolRegistry';
import {BROWSER_TOOLS,READ_TOOLS,systemCapabilities} from '../server/planner/governedTools';
const definition={id:'inspect-repair',description:'Observe a repair page',inputs:{type:'object',properties:{url:{type:'string'}},required:['url'],additionalProperties:false},steps:[{tool:'inspect_browser_page',arguments:{url:{$input:'url'}}}]};
test('typed workflow templates compile into existing exact governed actions without expanding permissions',()=>{
 const skill=validateSkill(definition);const plan=compileSkill(skill,{url:'https://example.com'},['inspect_browser_page']);
 assert.deepEqual(plan[0].subtasks[0].tool_request,{name:'inspect_browser_page',arguments:{url:'https://example.com'}});
 assert.deepEqual(plan[0].tool_permissions,['inspect_browser_page']);
 assert.throws(()=>compileSkill(skill,{url:3},['inspect_browser_page']),/INVALID_SKILL_INPUTS/);
 assert.throws(()=>compileSkill(skill,{url:'https://example.com'},[]),/SKILL_TOOL_NOT_PERMITTED/);
 assert.throws(()=>validateSkill({...definition,steps:[{tool:'made_up',arguments:{}}]}),/INVALID_SKILL_STEP/);
 assert.throws(()=>validateSkill({...definition,steps:[{tool:'inspect_browser_page',arguments:{url:{$input:'missing'}}}]}),/INVALID_SKILL_INPUT_REFERENCE/);
});
test('workflow versions survive cold reads, retain old revisions and exclude other tenants',async()=>{
 const rows:any[]=[];
 const db=createClient('https://skills-test.supabase.co','test-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const req=new Request(input,init),url=new URL(req.url);
  if(req.method==='POST'){const row=await req.json();if(!rows.some(r=>r.id===row.id))rows.push(row);return new Response(null,{status:201});}
  let result=rows.filter(row=>[...url.searchParams].every(([k,v])=>!v.startsWith('eq.')||String(k.startsWith('metadata->>')?row.metadata[k.slice(11)]:row[k])===v.slice(3))).slice().reverse();
  result=result.slice(0,Number(url.searchParams.get('limit'))||100);
  return Response.json(req.headers.get('accept')?.includes('vnd.pgrst.object')?result[0]??null:result);
 }}});
 const saved=await saveWorkflowSkill(db,'tenant-a','one',definition);await saveWorkflowSkill(db,'tenant-a','one',definition);
 assert.equal(rows.length,1);assert.equal((await listWorkflowSkills(db,'tenant-a')).skills.length,1);
 assert.deepEqual((await readWorkflowSkill(db,'tenant-a',definition.id,saved.revision)).skill,definition);
 await saveWorkflowSkill(db,'tenant-a','two',{...definition,description:'New revision'});
 assert.equal((await listWorkflowSkills(db,'tenant-a')).skills[0].skill.description,'New revision');
 assert.equal((await readWorkflowSkill(db,'tenant-a',definition.id,saved.revision)).skill.description,definition.description);
 assert.equal((await listWorkflowSkills(db,'tenant-b')).skills.length,0);
 await assert.rejects(()=>readWorkflowSkill(db,'tenant-b',definition.id,saved.revision),/SKILL_NOT_FOUND/);
 rows[0].content=JSON.stringify({...definition,description:'tampered'});
 await assert.rejects(()=>readWorkflowSkill(db,'tenant-a',definition.id,saved.revision),/INVALID_SKILL_REVISION/);
});
test('specialist budgets and tool restrictions cover task and overridden subtask assignments',()=>{
 const task:any={agent_id:SPECIALISTS.reviewer.agent_id,tool_permissions:['read_mission_artifact'],subtasks:[{agent_id:null}]};
 checkSpecialistBudget([task]);assert.throws(()=>checkSpecialistBudget(Array(5).fill(task)),/SPECIALIST_TURN_LIMIT/);
 assert.throws(()=>checkSpecialistBudget([{...task,agent_id:null,tool_permissions:['push_file_to_github'],subtasks:[{agent_id:SPECIALISTS.reviewer.agent_id}]}]),/SPECIALIST_TOOL_NOT_PERMITTED/);
 assert.throws(()=>specialistAgent('invented'),/UNKNOWN_SPECIALIST/);
});
test('unsupported browser strategies and malformed action requests fail before navigation',()=>{
 assert.throws(()=>parseBrowserWorkflow('[]','visual-grounding'),/UNSUPPORTED_BROWSER_STRATEGY/);
 for(const steps of [[],Array(9).fill({action:'scroll',direction:'down'}),[{action:'evaluate',value:'process.env'}],[{action:'press',selector:'input',value:'Control+O'}]])assert.throws(()=>parseBrowserWorkflow(JSON.stringify(steps)));
 assert.equal(BROWSER_TOOLS.has('run_browser_workflow'),true);assert.equal(READ_TOOLS.has('run_browser_workflow'),false);
 assert.equal(systemCapabilities().browser_control.visual_grounding_configured,false);
});
test('real Chromium browser workflow retains form state across approved actions and observes the result',async()=>{
 const previous=process.env.NODE_ENV;if(!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)process.env.NODE_ENV='production';
 const browser=new BrowserManager();
 try{const page=await browser.getPage();await page.setContent('<label>Case<input id="case"></label><select id="status"><option>Pending</option><option>Reviewed</option></select><button onclick="document.querySelector(\'h1\').textContent=document.querySelector(\'input\').value+\' \'+document.querySelector(\'select\').value">Save</button><h1>Draft</h1>');
 const actions=parseBrowserWorkflow(JSON.stringify([{action:'fill',selector:'#case',value:'Case 42'},{action:'select',selector:'#status',value:'Reviewed'},{action:'click',selector:'button'},{action:'wait',selector:'h1'}]));
 const result=await runBrowserWorkflow(browser,actions);assert.equal((result.steps as any[]).length,4);assert.match((result.observation as any).snapshot,/Case 42 Reviewed/);
 }finally{await browser.stop();if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
test('isolated execution validates paths, disables network, bounds artifacts and always tears down',async()=>{
 const old=process.env.E2B_API_KEY;process.env.E2B_API_KEY='fixture-only';let killed=0;const writes:any[]=[];
 const fake:any={sandboxId:'fixture-vm',commands:{run:async()=>({})},files:{write:async(...args:any[])=>writes.push(args),getInfo:async()=>({size:2}),read:async()=>new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('42'));c.close();}})},runCode:async(_code:string,options:any)=>{assert.equal(options.envs&&Object.keys(options.envs).length,0);return {logs:{stdout:['42'],stderr:[]},error:null};},kill:async()=>{killed++;}};
 try{
 const request=parseIsolatedRequest({language:'python',code:'print(42)',files_json:'{"input.txt":"data"}',outputs_json:'["answer.txt"]'});
 const result=await runIsolatedCode(request,{tenant:'a',mission:'m',subtask:'s'},async options=>{assert.equal(options?.allowInternetAccess,false);assert.equal(options?.timeoutMs,120000);return fake;});
 assert.equal(killed,1);assert.equal((result.files as any[])[0].content,'NDI=');assert.equal(writes[0][0],'/home/user/microfixd/input.txt');
 fake.runCode=async()=>{throw new Error('PROVIDER_FAILURE');};
 await assert.rejects(()=>runIsolatedCode(request,{tenant:'a',mission:'m',subtask:'s'},async()=>fake),/PROVIDER_FAILURE/);assert.equal(killed,2);
 assert.throws(()=>parseIsolatedRequest({language:'python',code:'x',outputs_json:'["../secret"]'}),/INVALID_SANDBOX_FILES/);
 delete process.env.E2B_API_KEY;await assert.rejects(()=>runIsolatedCode(request,{tenant:'a',mission:'m',subtask:'s'},async()=>fake),/NOT_CONFIGURED/);
 assert.ok(getTool('run_isolated_code'));assert.equal(READ_TOOLS.has('run_isolated_code'),false);
 }finally{if(old===undefined)delete process.env.E2B_API_KEY;else process.env.E2B_API_KEY=old;}
});
test('cancelled specialist provider calls do not dispatch or invent an answer',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(()=>completeTextWithFallback([{role:'user',content:'task'}],100,0,undefined,{signal:controller.signal}),/abort/i);
});
