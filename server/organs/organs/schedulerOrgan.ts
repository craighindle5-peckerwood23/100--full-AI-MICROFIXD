/** Legacy job descriptors are not a functioning durable scheduler. */
export async function executeSchedulerOrgan(action:string,_payload:unknown):Promise<unknown>{
 if(action==='status'||action==='health')return {running:false,durable:false,job_count:0,code:'DURABLE_SCHEDULER_NOT_CONFIGURED'};
 if(action==='list_jobs')return {jobs:[],running:false,code:'DURABLE_SCHEDULER_NOT_CONFIGURED'};
 throw new Error('DURABLE_SCHEDULER_NOT_CONFIGURED');
}
