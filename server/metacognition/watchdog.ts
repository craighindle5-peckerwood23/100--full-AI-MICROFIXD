import {randomUUID} from 'node:crypto';
import {metacognitiveContext} from './context';
const active=new Map<string,{tenant:string;agent:string;started:number;timeout:number}>();
export async function executeWatchdogOrgan(action:string):Promise<unknown>{
  if(!['status','health','evaluate'].includes(action))throw new Error('UNSUPPORTED_WATCHDOG_ACTION');
  const tenant=metacognitiveContext.getStore()?.subject.tenant_id;if(!tenant)throw new Error('METACOGNITIVE_CONTEXT_REQUIRED');
  return {scope:'current_process_current_tenant',active:[...active.values()].filter(v=>v.tenant===tenant).map(v=>({agent_id:v.agent,elapsed_ms:Math.max(0,performance.now()-v.started),timeout_ms:v.timeout})),timers_enforced:true};
}
/** Separate instances per call/tenant: timers and cancellation never leak between agents. */
export async function watchedAgent<T>(timeoutMs:number,parent:AbortSignal|undefined,work:(signal:AbortSignal)=>Promise<T>):Promise<T>{
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000)throw new Error('INVALID_AGENT_DEADLINE');
  const controller=new AbortController();
  const id=randomUUID(),subject=metacognitiveContext.getStore()?.subject;
  active.set(id,{tenant:subject?.tenant_id??'standalone',agent:subject?.agent_id??'standalone',started:performance.now(),timeout:timeoutMs});
  const signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal;
  const timer=setTimeout(()=>controller.abort(Object.assign(new Error('AGENT_WATCHDOG_TIMEOUT'),{code:'AGENT_WATCHDOG_TIMEOUT'})),timeoutMs);
  let abortListener:()=>void;
  try{
    signal.throwIfAborted();
    const interrupted=new Promise<never>((_,reject)=>{abortListener=()=>reject(signal.reason);signal.addEventListener('abort',abortListener,{once:true});});
    return await Promise.race([Promise.resolve().then(()=>work(signal)),interrupted]);
  }finally{clearTimeout(timer);active.delete(id);if(abortListener!)signal.removeEventListener('abort',abortListener);}
}
