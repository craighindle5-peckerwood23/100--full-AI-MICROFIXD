/** Capability-free WASM execution; every entry point enforces the same approval. */
import { randomUUID, createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { trigger, getAll } from '../hitl/hitlManager';
import { broadcast } from '../events';
import fs from 'node:fs';
import path from 'node:path';
const logPath=path.join(process.cwd(),'server/sandbox/session_log.jsonl');
function audit(record:unknown):void {fs.mkdirSync(path.dirname(logPath),{recursive:true});fs.appendFileSync(logPath,JSON.stringify(record)+'\n');}
export interface CodeRunResult {
  success: boolean; stdout: string; stderr: string; exit_code: number;
  elapsed_ms: number; lang: string; session_id: string; exec_id: string;
  approval_id?: string; approval_required?: boolean;
}
const consumed=new Set<string>();
let active=0;
export async function runCode(code: string, lang: string, sessionId: string, approvalId?: string): Promise<CodeRunResult> {
  const start=Date.now(), exec_id=randomUUID();
  const base={stdout:'',elapsed_ms:0,lang,session_id:sessionId,exec_id};
  const reject=(stderr:string,exit_code=126):CodeRunResult=>({ ...base,success:false,stderr,exit_code });
  if(typeof code!=='string'||!code.trim()||Buffer.byteLength(code)>65536||typeof lang!=='string'||typeof sessionId!=='string') return reject('Invalid sandbox input',2);
  lang=lang.trim().toLowerCase();
  if(!['javascript','typescript'].includes(lang)) return reject('Only JavaScript and TypeScript are supported by the isolated WASM runtime',2);
  const digest=createHash('sha256').update(JSON.stringify({code,lang,sessionId})).digest('hex');
  if(!approvalId){
    const approval=trigger(sessionId,{name:'Sandbox code execution',type:'sandbox_execution',digest,code,lang},'sandbox_execution');
    const pending={...reject('Human approval required'),approval_required:true,approval_id:approval.hitl_id};audit(pending);return pending;
  }
  const approval=getAll().find(r=>r.hitl_id===approvalId);
  if(!approval||approval.status!=='approved'||approval.trigger!=='sandbox_execution'||approval.session_id!==sessionId||approval.artifact.digest!==digest||consumed.has(approvalId)) return reject('Missing, mismatched or already consumed approval');
  if(active>=2)return reject('Sandbox capacity reached',75);
  consumed.add(approvalId);active++;
  audit({type:'sandbox:exec_start',exec_id,approval_id:approvalId,digest});
  broadcast('sandbox:exec_start',{exec_id,approval_id:approvalId,digest});
  try {
    const result=await new Promise<CodeRunResult>((resolve)=>{
      const worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{code,lang},env:{},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16,stackSizeMb:2}});
      let settled=false;
      const finish=(value:CodeRunResult)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate().finally(() => resolve({...value,elapsed_ms:Date.now()-start,approval_id:approvalId}));};
      const timer=setTimeout(()=>finish(reject('Sandbox timed out after 3000ms',124)),3000);
      worker.once('message',value=>finish({...base,...value}));
      worker.once('error',err=>finish(reject(String(err),1)));
      worker.once('exit',()=>{if(!settled)finish(reject('Sandbox worker exited without a result',1));});
    });
    audit(result);broadcast('sandbox:exec_result',result);return result;
  } finally {active--;}
}
