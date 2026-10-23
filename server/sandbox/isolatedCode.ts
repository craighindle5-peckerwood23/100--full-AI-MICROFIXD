import {Sandbox,type SandboxOpts} from '@e2b/code-interpreter';
import {createHash} from 'node:crypto';
import type {JSONObject} from '../planner/executionSpine';
export interface IsolatedRequest {language:'python'|'javascript'|'typescript'|'bash';code:string;files:Record<string,string>;outputs:string[];allow_network:boolean}
const validPath=(p:string)=>p.length<=180&&/^[a-zA-Z0-9_.\/-]+$/.test(p)&&!p.startsWith('/')&&!p.split('/').some(part=>!part||part==='.'||part==='..');
export function parseIsolatedRequest(args:JSONObject):IsolatedRequest {
 if(!['python','javascript','typescript','bash'].includes(String(args.language))||typeof args.code!=='string'||!args.code.trim()||Buffer.byteLength(args.code)>64000)throw new Error('INVALID_ISOLATED_CODE');
 let files:unknown={},outputs:unknown=[];
 try{if(args.files_json!==undefined)files=JSON.parse(String(args.files_json));if(args.outputs_json!==undefined)outputs=JSON.parse(String(args.outputs_json));}catch{throw new Error('INVALID_SANDBOX_FILES');}
 if(!files||typeof files!=='object'||Array.isArray(files)||Object.keys(files).length>8||Object.entries(files).some(([p,v])=>!validPath(p)||typeof v!=='string')||Buffer.byteLength(JSON.stringify(files))>128000||!Array.isArray(outputs)||outputs.length>8||outputs.some(p=>typeof p!=='string'||!validPath(p))||args.allow_network!==undefined&&typeof args.allow_network!=='boolean')throw new Error('INVALID_SANDBOX_FILES');
 return {language:args.language as IsolatedRequest['language'],code:args.code,files:files as Record<string,string>,outputs:outputs as string[],allow_network:args.allow_network===true};
}
export type SandboxFactory=(options:SandboxOpts)=>Promise<Pick<Sandbox,'sandboxId'|'files'|'commands'|'runCode'|'kill'>>;
let active=0;
export function sandboxConfigured(){return !!process.env.E2B_API_KEY?.trim();}
export async function runIsolatedCode(request:IsolatedRequest,scope:{tenant:string;mission:string;subtask:string},create:SandboxFactory=options=>Sandbox.create(options)):Promise<JSONObject>{
 if(!sandboxConfigured())throw new Error('ISOLATED_SANDBOX_NOT_CONFIGURED');
 if(active>=2)throw new Error('ISOLATED_SANDBOX_CAPACITY');
 active++;let sandbox:Awaited<ReturnType<SandboxFactory>>|undefined;
 try{
  sandbox=await create({apiKey:process.env.E2B_API_KEY!.trim(),timeoutMs:120000,requestTimeoutMs:30000,allowInternetAccess:request.allow_network,network:{allowPublicTraffic:false},metadata:{scope_hash:createHash('sha256').update(JSON.stringify(scope)).digest('hex')}});
  const root='/home/user/microfixd';await sandbox.commands.run(`mkdir -p ${root}`,{timeoutMs:5000});
  for(const [path,content] of Object.entries(request.files))await sandbox.files.write(`${root}/${path}`,content);
  const contextCode=request.language==='python'?`import os\nos.chdir(${JSON.stringify(root)})\n${request.code}`:request.language==='bash'?`cd ${root}\n${request.code}`:request.code;
  // JS/TS output paths are absolute below; callers may use /home/user/microfixd.
  let logBytes=0;const onLog=(message:{line:string})=>{logBytes+=Buffer.byteLength(message.line);if(logBytes>128000)throw new Error('SANDBOX_LOG_LIMIT');};
  const execution=await sandbox.runCode(contextCode,{onStdout:onLog,onStderr:onLog,language:request.language,timeoutMs:60000,requestTimeoutMs:65000,envs:{}});
  const clip=(text:string)=>({text:Array.from(text).slice(0,16000).join(''),total_characters:Array.from(text).length,truncated:Array.from(text).length>16000});
  const files:JSONObject[]=[];let bytes=0;
  for(const path of request.outputs){const info=await sandbox.files.getInfo(`${root}/${path}`);if(info.size>128000||bytes+info.size>256000)throw new Error('SANDBOX_OUTPUT_TOO_LARGE');const stream=await sandbox.files.read(`${root}/${path}`,{format:'stream',requestTimeoutMs:10000,streamIdleTimeoutMs:5000});const reader=stream.getReader();const chunks:Uint8Array[]=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>128000||bytes+size>256000)throw new Error('SANDBOX_OUTPUT_TOO_LARGE');chunks.push(value);}}catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}const data=Buffer.concat(chunks);bytes+=data.length;files.push({path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),encoding:'base64',content:Buffer.from(data).toString('base64')});}
  const result:JSONObject={provider:'e2b',sandbox_id:sandbox.sandboxId,language:request.language,network_enabled:request.allow_network,stdout:clip(execution.logs.stdout.join('\n')),stderr:clip(execution.logs.stderr.join('\n')),execution_error:execution.error?{name:execution.error.name,value:String(execution.error.value).slice(0,2000)}:null,files,authority:'isolated_execution_observation',cleanup:'terminated'};
  // Cleanup is part of success. On uncertain teardown the existing tool ledger requires reconciliation; TTL remains a backstop.
  await sandbox.kill();sandbox=undefined;return result;
 }finally{if(sandbox)try{await sandbox.kill();}catch{console.error('[sandbox] teardown uncertain; sandbox TTL is 120 seconds');}active--;}
}
