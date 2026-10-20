import {Router} from 'express';
import {OrchestratorController} from '../controllers/orchestratorController';
import {OrchestratorApp} from '../core/orchestratorApp';
import {GovernedAdapterRuntime} from '../tools/governedAdapterRuntime';
import {plannerClient} from '../planner/supabaseRuntime';
import {systemCapabilities} from '../planner/governedTools';
import type {DatabaseConnection} from '../core/dispatcherTrackingHook';

export const orchestratorRouter=Router();
orchestratorRouter.post('/orchestrator/dispatch-batch',async(req,res,next)=>{
  // The parent /api middleware has already authenticated the bearer token.
  if((req as typeof req & {microfixdRole?:string}).microfixdRole!=='admin'){
    res.status(403).json({success:false,error:'ADMIN_REQUIRED'});return;
  }
  try{
    const client=plannerClient();
    const db:DatabaseConnection={async execute(query,params){
      if(query.startsWith('INSERT INTO public.mission_dispatch_logs')){
        const {data,error}=await client.from('mission_dispatch_logs').insert({
          task_id:params[0] as string,mission_id:params[1] as string,status:params[2] as string,
          response_payload:params[3] ? JSON.parse(params[3] as string):null,
          error_message:params[4] as string|null,executed_at:params[5] as string
        }).select('id');
        if(error)throw error;
        return {rowCount:data?.length??0,rows:data??[]};
      }
      if(query.includes('FROM public.mission_dispatch_logs WHERE mission_id=$1')){
        const {data,error}=await client.from('mission_dispatch_logs').select('status').eq('mission_id',params[0] as string);
        if(error)throw error;
        const rows=data??[];
        return {rowCount:1,rows:[{total:rows.length,successes:rows.filter(r=>r.status==='SUCCESS').length,failures:rows.filter(r=>r.status==='FAILED').length}]};
      }
      throw new Error('Unsupported audit query');
    }};
    const runtime=new GovernedAdapterRuntime(async envelope=>envelope.tool==='list_system_capabilities',async()=>{});
    runtime.register({name:'list_system_capabilities',async execute(){return systemCapabilities();}});
    const app=new OrchestratorApp();
    app.bootstrap({maxConcurrency:10},db,runtime);
    await new OrchestratorController(app).handleBatchDispatch(req,res,next);
  }catch(nextError){next(nextError);}
});
