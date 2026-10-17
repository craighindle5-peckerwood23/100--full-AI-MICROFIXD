/** Compatibility facade. No browser-owned watchdog, task worker, fake history or deployments. */
import type {FallbackAlertState} from '../types';
import {api} from '../lib/serverApi';
class AutonomousCore {
 private listeners=new Set<()=>void>();
 private fallback:FallbackAlertState={active:false,primaryProvider:'not_reported',primaryModel:'not_reported',fallbackProvider:'not_reported',fallbackModel:'not_reported',reason:'No measured provider failover reported.',switchedAt:'',timestampMs:0,manualOverrideActive:false,dismissed:false};
 getFallbackAlert(){return {...this.fallback};}
 dismissFallbackAlert(){this.fallback.dismissed=true;this.notify();}
 undoFallback(){throw new Error('PROVIDER_ROUTING_CHANGE_REQUIRES_SERVER_EXECUTOR');}
 toggleManualOverride(_provider?:string):boolean{throw new Error('PROVIDER_ROUTING_CHANGE_REQUIRES_SERVER_EXECUTOR');}
 async addSchedulerTask(_type:string,prompt:string){return api('POST','/planner/missions',{objective:prompt,tool_permissions:['read_public_page','get_github_repo','scan_for_security_issues']},{'Idempotency-Key':crypto.randomUUID()});}
 async triggerSelfRepairOrgan(){throw new Error('REPAIR_EXECUTOR_NOT_CONFIGURED');}
 async triggerAutoDeployment(_message?:string){throw new Error('DEPLOYMENT_EXECUTOR_NOT_CONFIGURED');}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 private notify(){for(const listener of this.listeners)listener();}
}
export const autonomousCore=new AutonomousCore();
