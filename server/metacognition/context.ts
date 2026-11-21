import {AsyncLocalStorage} from 'node:async_hooks';
import type {MetacognitiveSupervisor, Subject} from './supervisor';

export const metacognitiveContext=new AsyncLocalStorage<{supervisor:MetacognitiveSupervisor;subject:Subject}>();
export function supervisedOperation<T>(agent:string,action:string,input:unknown,work:()=>Promise<T>):Promise<T>{
  const scope=metacognitiveContext.getStore();
  if(!scope)return work(); // Standalone tests/probes have no authenticated request. Workers supply their own supervisor.
  return scope.supervisor.run({...scope.subject,agent_id:agent,action,input},work);
}
