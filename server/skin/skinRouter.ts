import {submitMission} from '../planner/plannerRouter';
import { Router }   from "express";
import { skinLayer } from "./skinLayer";
import { sensorMesh } from "./sensorMesh";

export const skinRouter = Router();

skinRouter.post('/receive',(req,res,next)=>{
 const payload=req.body?.payload;req.body={...req.body,objective:typeof payload==='string'?payload:JSON.stringify(payload)};
 return submitMission(req,res,next);
});

skinRouter.get("/stats",   (req, res) => res.json(skinLayer.getStats()));
skinRouter.get("/sensors", (req, res) => res.json({ log: sensorMesh.recent(50), stats: sensorMesh.stats() }));
