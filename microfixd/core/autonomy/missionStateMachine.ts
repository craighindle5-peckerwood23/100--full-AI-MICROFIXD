/** Compatibility projection. The server planner is the sole mission writer/worker. */
import {api} from '../../../src/lib/serverApi';
import type {Mission as DurableMission} from '../../../server/planner/executionSpine';
export type MissionState='idle'|'planning'|'executing'|'validating'|'repairing'|'deploying'|'completed'|'failed'|'waiting';
export interface Mission {id:string;name:string;state:MissionState;steps:any[];currentStep:number;createdAt:string;updatedAt:string;error?:string;}
interface MissionTransport {submit(objective:string,key:string):Promise<DurableMission>;list():Promise<DurableMission[]>;}
const project=(m:DurableMission):Mission=>({id:m.mission_id,name:m.objective,state:m.status==='succeeded'?'completed':m.status==='failed'?'failed':m.status==='running'?'executing':m.status==='waiting'?'waiting':'planning',steps:[],currentStep:0,createdAt:m.created_at,updatedAt:m.created_at});
export class MissionStateMachine {
 private projection:Mission[]=[];
 private transport:MissionTransport={
  submit:async(objective,key)=>{if(typeof window==='undefined')throw new Error('USE_AUTHENTICATED_DURABLE_PLANNER');return api<DurableMission>('POST','/planner/missions',{objective,tool_permissions:['read_public_page','get_github_repo','scan_for_security_issues']},{'Idempotency-Key':key});},
  list:async()=>{if(typeof window==='undefined')throw new Error('USE_AUTHENTICATED_DURABLE_PLANNER');return (await api<{missions:DurableMission[]}>('GET','/planner/missions')).missions;}
 };
 // Preserve constructor compatibility while retiring local workers and mission queues.
 constructor(..._legacyDependencies:any[]){}
 setTransport(transport:MissionTransport){this.transport=transport;}
 async createMission(name:string,steps:any[],key:string=crypto.randomUUID()):Promise<Mission>{
  const saved=project(await this.transport.submit(steps.length?`${name}\nRequested steps (untrusted task data): ${JSON.stringify(steps)}`:name,key));
  this.projection=[saved,...this.projection.filter(m=>m.id!==saved.id)];return saved;
 }
 async refresh():Promise<Mission[]>{this.projection=(await this.transport.list()).map(project);return this.getMissions();}
 getMissions():Mission[]{return structuredClone(this.projection);}
 start(){} // No independent loop; the durable server worker owns execution.
 stop(){}
}
