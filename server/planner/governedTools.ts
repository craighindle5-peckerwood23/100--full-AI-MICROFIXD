import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {JSONObject,JSONValue,ExecutionContext,ExecutionResult,Subtask} from './executionSpine';
import {getTool} from '../tools/toolRegistry';
import {getExecutor} from '../organs/executors';
import {publicPageURL} from '../tools/publicPageReader';
import {BrowserManager} from '../playwright/browserManager';
import {validateSchema} from './schema';
export const ENABLED_TOOLS=['read_public_page','get_github_repo','scan_for_security_issues','navigate_browser','scrape_url','take_screenshot','click_element','push_file_to_github'];
export const READ_TOOLS=new Set(['read_public_page','get_github_repo','scan_for_security_issues']);
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
  if(!args||typeof args!=='object'||Array.isArray(args)||!validateSchema(args,{...tool.parameters,properties:{...tool.parameters.properties,...(['navigate_browser','scrape_url','take_screenshot','click_element'].includes(name)?{url:{type:'string'}}:{})},required:[...new Set([...tool.parameters.required,...(['navigate_browser','scrape_url','take_screenshot','click_element'].includes(name)?['url']:[])])],additionalProperties:false} as any))throw new Error('INVALID_TOOL_ARGUMENTS');
  if(['navigate_browser','scrape_url','take_screenshot','click_element'].includes(name)){
   const url=new URL(publicPageURL(String((args as JSONObject).url??'')));
   if(url.protocol!=='https:'||url.username||url.password||!Array.isArray(context.constraints.browser_origins)||!context.constraints.browser_origins.includes(url.origin))throw new Error('INVALID_BROWSER_URL');
  }
  const prior=await run(context.subtask_id);
  if(prior){if(prior.request_hash!==hash)throw new Error('REQUEST_CHANGED');if(prior.status==='succeeded')return prior.result as ExecutionResult;throw new ExecutionPause('RECONCILIATION_REQUIRED');}
  const protectedAction=!READ_TOOLS.has(name);
  if(protectedAction){
   const {error}=await client.from('spine_approvals').upsert({tenant_id:tenant,mission_id:mission,subtask_id:context.subtask_id,request_hash:hash,request},{onConflict:'tenant_id,subtask_id,request_hash',ignoreDuplicates:true});if(error)throw new Error(error.code);
  }
  const {data:started,error}=await client.rpc('spine_start_tool',{p_tenant:tenant,p_mission:mission,p_subtask:context.subtask_id,p_owner:owner,p_hash:hash,p_request:request,p_protected:protectedAction});
  if(error)throw new Error(error.code);
  if(!started)throw new ExecutionPause('WAITING_APPROVAL');
  let raw:JSONValue;
  try{
  if(['navigate_browser','scrape_url','take_screenshot','click_element'].includes(name)){
   const browser=new BrowserManager();
   try{const page=await browser.getPage();await page.route('**/*',route=>{let allowed=false;try{allowed=(context.constraints.browser_origins as string[]).includes(new URL(route.request().url()).origin);}catch{}return allowed?route.continue():route.abort();});const url=String((args as JSONObject).url??'');
    if(new URL(url).protocol!=='https:')throw new Error('HTTPS_REQUIRED');
    const navigation=await browser.navigate(url);
    if(name==='click_element')raw=await browser.click(String((args as JSONObject).selector));
    else if(name==='take_screenshot')raw={screenshot:await browser.screenshot(),url:navigation.url};
    else if(name==='scrape_url')raw={text:(await browser.getText(String((args as JSONObject).selector??'body'))).slice(0,16000),url:navigation.url,title:navigation.title};
    else raw=navigation;
   }finally{await browser.stop();}
  }else raw=JSON.parse(JSON.stringify(await getExecutor(tool.organ)(tool.action,args as Record<string,unknown>))) as JSONValue;
  }catch{throw new ExecutionPause('RECONCILIATION_REQUIRED');}
  const result:ExecutionResult={raw,normalized:{result:raw},evidence:{tool:name,request_hash:hash,idempotency_key:context.idempotency_key,completed_at:new Date().toISOString()}};
  const {error:finishError}=await client.rpc('spine_finish_tool',{p_tenant:tenant,p_mission:mission,p_subtask:context.subtask_id,p_owner:owner,p_hash:hash,p_result:result});
  if(finishError)throw new Error(finishError.code);
  return result;
 };
 return {executeTool,recoverTool};
}
