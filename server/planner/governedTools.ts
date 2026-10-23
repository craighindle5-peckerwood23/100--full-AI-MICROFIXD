import {executeAutomotiveOrgan} from '../organs/organs/automotiveOrgan';
import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {JSONObject,JSONValue,ExecutionContext,ExecutionResult,Subtask} from './executionSpine';
import {dispatchOrgan} from '../organs/dispatch';
import {organRegistry} from '../organs/organRegistry';
import {probeOrgan} from '../organs/probes';
import {EXECUTORS} from '../organs/executors';
import {TOOL_REGISTRY,getTool} from '../tools/toolRegistry';
import {getExecutor} from '../organs/executors';
import {publicPageURL} from '../tools/publicPageReader';
import {BrowserManager} from '../playwright/browserManager';
import {validateSchema} from './schema';
export const ENABLED_TOOLS=TOOL_REGISTRY.map(tool=>tool.name);
export const BROWSER_TOOLS=new Set(['navigate_browser','scrape_url','take_screenshot','click_element','crawl_website']);
export const READ_TOOLS=new Set(['recall_knowledge','recall_procedures','obd_connection_setup','list_obd_sessions','read_obd_status','list_automotive_cases','read_automotive_case','list_system_capabilities','probe_system_organ','read_public_page','get_github_repo','scan_for_security_issues']);
export function requestHash(value:JSONValue):string {
 const canonical=(v:JSONValue):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
 return createHash('sha256').update(canonical(value)).digest('hex');
}
export class ExecutionPause extends Error {constructor(public code:'WAITING_APPROVAL'|'RECONCILIATION_REQUIRED'){super(code);}}
export function createGovernedTools(client:SupabaseClient,tenant:string,mission:string,owner:string) {
 const run=async(subtask:string)=>{const {data,error}=await client.from('spine_tool_runs').select('*').eq('tenant_id',tenant).eq('mission_id',mission).eq('subtask_id',subtask).maybeSingle();if(error)throw new Error(error.code);return data;};
 const recoverTool=async(sub:Subtask,context:ExecutionContext):Promise<ExecutionResult|null>=>{
  const prior=await run(sub.subtask_id);
  if(!prior)return null;
  if(context.tenant_id!==tenant||context.mission_id!==mission)throw new Error('TENANT_MISMATCH');
  if(prior.request_hash!==requestHash(sub.tool_request))throw new Error('REQUEST_CHANGED');
  if(prior.status!=='succeeded')throw new ExecutionPause('RECONCILIATION_REQUIRED');
  return prior.result as ExecutionResult;
 };
 const executeTool=async(request:JSONObject,context:ExecutionContext):Promise<ExecutionResult>=>{
  if(context.tenant_id!==tenant||context.mission_id!==mission)throw new Error('TENANT_MISMATCH');
  const name=String(request.name),tool=getTool(name),hash=requestHash(request);
  if(!tool||!ENABLED_TOOLS.includes(name)||!context.tool_permissions.includes(name))throw new Error('TOOL_NOT_PERMITTED');
  const args=request.arguments;
  if(!args||typeof args!=='object'||Array.isArray(args)||!validateSchema(args,{...tool.parameters,properties:{...tool.parameters.properties,...(BROWSER_TOOLS.has(name)?{url:{type:'string'}}:{})},required:[...new Set([...tool.parameters.required,...(BROWSER_TOOLS.has(name)?['url']:[])])],additionalProperties:false} as any))throw new Error('INVALID_TOOL_ARGUMENTS');
  if(BROWSER_TOOLS.has(name)){
   const url=new URL(publicPageURL(String((args as JSONObject).url??'')));
   if(url.protocol!=='https:'||url.username||url.password||!Array.isArray(context.constraints.browser_origins)||!context.constraints.browser_origins.includes(url.origin))throw new Error('INVALID_BROWSER_URL');
  }
  let organPayload:Record<string,unknown>|undefined;
  if(name==='invoke_system_organ'){
   organPayload=organInvocationPayload(args as JSONObject,tenant,mission);
  }
  if(name==='push_file_to_github'&&!process.env.GITHUB_TOKEN?.trim())throw new Error('MISSING_GITHUB_CREDENTIALS');
  const prior=await run(context.subtask_id);
  if(prior){if(prior.request_hash!==hash)throw new Error('REQUEST_CHANGED');if(prior.status==='succeeded')return prior.result as ExecutionResult;throw new ExecutionPause('RECONCILIATION_REQUIRED');}
  // The database's immutable allowlist contains only these three read tools.
  // Other read tools still need an automatically recorded exact-action receipt.
  const protectedAction=!['read_public_page','get_github_repo','scan_for_security_issues'].includes(name);
  if(protectedAction){
   const automatic=READ_TOOLS.has(name)||(context.constraints.tool_approval_mode==='preauthorized'&&typeof context.constraints.approval_actor==='string'&&context.constraints.approval_actor.length>0);
   const receipt={tenant_id:tenant,mission_id:mission,subtask_id:context.subtask_id,request_hash:hash,request,
    ...(automatic?{status:'approved',decided_by:READ_TOOLS.has(name)?'read-only-policy':String(context.constraints.approval_actor),decided_at:new Date().toISOString()}:{} )};
   // Ignore duplicates: never overwrite an operator rejection or consumed receipt.
   const {error}=await client.from('spine_approvals').upsert(receipt,{onConflict:'tenant_id,subtask_id,request_hash',ignoreDuplicates:true});
   if(error)throw new Error(error.code);
  }
  const {data:started,error}=await client.rpc('spine_start_tool',{p_tenant:tenant,p_mission:mission,p_subtask:context.subtask_id,p_owner:owner,p_hash:hash,p_request:request,p_protected:protectedAction});
  if(error)throw new Error(error.code);
  if(!started)throw new ExecutionPause('WAITING_APPROVAL');
  let raw:JSONValue;
  try{
  if(BROWSER_TOOLS.has(name)){
   const browser=new BrowserManager();
   try{const page=await browser.getPage();await page.route('**/*',route=>{let allowed=false;try{allowed=(context.constraints.browser_origins as string[]).includes(new URL(route.request().url()).origin);}catch{}return allowed?route.continue():route.abort();});const url=String((args as JSONObject).url??'');
    if(new URL(url).protocol!=='https:')throw new Error('HTTPS_REQUIRED');
    const navigation=name==='crawl_website'?null:await browser.navigate(url);
    if(name==='crawl_website'){
     const options=args as JSONObject,maxDepth=Math.max(0,Math.min(2,Number(options.maxDepth??1))),maxPages=Math.max(1,Math.min(10,Number(options.maxPages??5)));
     const queue=[{url,depth:0}],seen=new Set<string>(),pages:JSONValue[]=[];
     while(queue.length&&pages.length<maxPages){
      const next=queue.shift()!;if(seen.has(next.url))continue;seen.add(next.url);
      const nav=await browser.navigate(next.url);pages.push({...nav,text:(await browser.getText()).slice(0,16000)});
      if(next.depth<maxDepth)for(const link of await browser.findLinks()){try{const safe=publicPageURL(link);if(new URL(safe).origin===new URL(url).origin&&!seen.has(safe)&&queue.length<100)queue.push({url:safe,depth:next.depth+1});}catch{}}
     }
     raw={pages,count:pages.length,maxDepth,maxPages};
    }else if(name==='click_element')raw=await browser.click(String((args as JSONObject).selector));
    else if(name==='take_screenshot')raw={screenshot:await browser.screenshot(),url:navigation!.url};
    else if(name==='scrape_url')raw={text:(await browser.getText(String((args as JSONObject).selector??'body'))).slice(0,16000),url:navigation!.url,title:navigation!.title};
    else raw=navigation!;
   }finally{await browser.stop();}
  }else if(name==='invoke_system_organ')raw=JSON.parse(JSON.stringify(await dispatchOrgan(String((args as JSONObject).organ_id),String((args as JSONObject).action),organPayload,tenant)));
  else if(['obd_connection_setup','list_automotive_cases','read_automotive_case','list_obd_sessions','read_obd_status'].includes(name)){
   raw=JSON.parse(JSON.stringify(await executeAutomotiveOrgan(tool.action,{...args as JSONObject,tenant_id:tenant},client)));
  }
  else if(name==='list_system_capabilities')raw=JSON.parse(JSON.stringify(systemCapabilities()));
  else if(name==='probe_system_organ')raw=JSON.parse(JSON.stringify(await probeOrgan(String((args as JSONObject).organ_id),context.idempotency_key,tenant)));
  else {
   const structured=['remember_knowledge','recall_knowledge','recall_procedures'].includes(name);
   const payload=tool.organ==='memory'?{...args as JSONObject,tenant_id:tenant,session_id:structured?`${tenant}:${mission}`:`${tenant}:tools`,event_id:context.subtask_id,tags:typeof (args as JSONObject).tags==='string'?String((args as JSONObject).tags).split(',').map(t=>t.trim()).filter(Boolean):[]}:args;
   raw=JSON.parse(JSON.stringify(await getExecutor(tool.organ)(tool.action,payload as Record<string,unknown>))) as JSONValue;
  }
  }catch(error){if(protectedAction)throw new ExecutionPause('RECONCILIATION_REQUIRED');throw error;}
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&('error' in raw||raw.success===false))throw new Error('TOOL_EXECUTION_FAILED');
  const result:ExecutionResult={raw,normalized:{result:raw},evidence:{tool:name,request_hash:hash,idempotency_key:context.idempotency_key,completed_at:new Date().toISOString()}};
  const {error:finishError}=await client.rpc('spine_finish_tool',{p_tenant:tenant,p_mission:mission,p_subtask:context.subtask_id,p_owner:owner,p_hash:hash,p_result:result});
  if(finishError)throw new Error(finishError.code);
  return result;
 };
 return {executeTool,recoverTool};
}

export function systemCapabilities(){
 return {tools:TOOL_REGISTRY.map(tool=>({...tool,durable:ENABLED_TOOLS.includes(tool.name),endpoint:'/api/planner/missions',required_credentials:tool.organ==='github_connector'?['GITHUB_TOKEN']:[],credentials_configured:tool.organ==='github_connector'?Boolean(process.env.GITHUB_TOKEN?.trim()):null})),organs:organRegistry.all().map(organ=>({id:organ.id,name:organ.name,layer:organ.layer,isolated:organ.isolated,native_executor:Object.hasOwn(EXECUTORS,organ.id),status_endpoint:`/api/organs/${organ.id}/status`,execution_endpoint:`/api/organs/${organ.id}/execute`,durable_tools:TOOL_REGISTRY.filter(tool=>tool.organ===organ.id&&ENABLED_TOOLS.includes(tool.name)).map(tool=>tool.name),note:Object.hasOwn(EXECUTORS,organ.id)?'Concrete executor; supported actions and credentials still required.':'Routing probe available; arbitrary task execution is not verified.'}))};
}

export function organInvocationPayload(args:JSONObject,tenant:string,mission:string):Record<string,unknown>{
 const id=String(args.organ_id);
 if(!organRegistry.get(id)||!Object.hasOwn(EXECUTORS,id))throw new Error('UNSUPPORTED_ORGAN_CAPABILITY');
 if(['playwright','crawl_engine','github_connector','sandbox','core.tools'].includes(id))throw new Error('USE_DEDICATED_GOVERNED_TOOL');
 const payload=JSON.parse(String(args.payload_json));
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('INVALID_ORGAN_PAYLOAD');
 return {...payload,tenant_id:tenant,session_id:`${tenant}:${mission}`};
}
