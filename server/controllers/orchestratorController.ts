import type {Request,Response,NextFunction} from 'express';
import type {OrchestratorApp} from '../core/orchestratorApp';
import type {MissionTask} from '../core/missionDispatcher';

export class OrchestratorController {
  constructor(private readonly orchestratorApp:OrchestratorApp) {}
  handleBatchDispatch=async(req:Request,res:Response,_next:NextFunction):Promise<void>=>{
    const body=req.body;
    if(!body || typeof body!=='object' || Array.isArray(body) || !Array.isArray(body.tasks) || body.tasks.length<1 || body.tasks.length>1000){
      res.status(400).json({success:false,error:'Expected a nonempty tasks array of at most 1000 entries'});return;
    }
    const tasks:MissionTask[]=[];
    const seen=new Set<string>();
    for(let i=0;i<body.tasks.length;i++){
      const t=body.tasks[i];
      if(!t || typeof t!=='object' || Array.isArray(t) ||
        typeof t.taskId!=='string' || !t.taskId.trim() || t.taskId.length>255 ||
        typeof t.missionId!=='string' || !t.missionId.trim() || t.missionId.length>255 ||
        typeof t.endpoint!=='string' || !t.endpoint.trim() ||
        !t.payload || typeof t.payload!=='object' || Array.isArray(t.payload) ||
        !Number.isSafeInteger(t.maxRetries) || t.maxRetries<0 || t.maxRetries>5 ||
        !Number.isSafeInteger(t.timeoutMs) || t.timeoutMs<100 || t.timeoutMs>120000 ||
        (t.retrySafety!==undefined && t.retrySafety!=='read-only' && t.retrySafety!=='idempotent') ||
        seen.has(t.missionId+':'+t.taskId)){
        res.status(400).json({success:false,error:`Invalid or duplicate task at index ${i}`});return;
      }
      seen.add(t.missionId+':'+t.taskId);
      tasks.push({taskId:t.taskId.trim(),missionId:t.missionId.trim(),endpoint:t.endpoint.trim(),payload:t.payload,maxRetries:t.maxRetries,timeoutMs:t.timeoutMs});
    }
    try{
      const results=await this.orchestratorApp.processOrchestrationPipeline(tasks);
      res.status(200).json({success:true,batchSizeProcessed:results.length,results});
    }catch(error){
      console.error('Orchestrator pipeline failed',error);
      res.status(503).json({success:false,error:'Orchestrator execution or audit persistence unavailable'});
    }
  };
}
