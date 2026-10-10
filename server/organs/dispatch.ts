import {organRegistry} from './organRegistry';
import {getExecutor} from './executors';
import {probeOrgan} from './probes';
const active=new Map<string,number>();
export async function dispatchOrgan(id:string,action:string,payload:unknown,tenant:string){
 const organ=organRegistry.get(id);if(!organ)throw Error('UNKNOWN_ORGAN');if(organ.isolated)throw Error('ORGAN_ISOLATED');
 const start=performance.now();active.set(id,(active.get(id)??0)+1);organRegistry.setStatus(id,'busy');let succeeded=false;
 try{const result=action==='probe'?await probeOrgan(id,String((payload as any)?.request_id??''),tenant):await getExecutor(id)(action,payload);succeeded=true;organRegistry.recordExec(id,true,performance.now()-start,action);return result;}
 catch{organRegistry.recordExec(id,false,performance.now()-start,action,'ORGAN_EXECUTION_FAILED');throw Error('ORGAN_EXECUTION_FAILED');}
 finally{const remaining=(active.get(id)??1)-1;if(remaining)active.set(id,remaining);else active.delete(id);organRegistry.setStatus(id,organ.isolated?'disabled':remaining?'busy':succeeded?'active':'error');}
}
