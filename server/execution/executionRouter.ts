import { Router }    from "express";
import {submitMission} from "../planner/plannerRouter";

export const executionRouter = Router();

// Compatibility entry point: the planner owns every submitted task.
executionRouter.post('/run',(req,res,next)=>{
 req.body={...req.body,objective:req.body?.objective??req.body?.task};
 return submitMission(req,res,next);
});

executionRouter.get(['/traces','/traces/:id'],(_req,res)=>res.status(410).json({code:'USE_DURABLE_MISSION_AUDIT',endpoint:'/api/planner/missions/:id/audit'}));
executionRouter.get('/circuit-breakers',(_req,res)=>res.json({breakers:[],retired:true,execution_engine:'durable-planner'}));
