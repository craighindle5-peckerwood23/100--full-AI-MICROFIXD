/**
 * server/organs/organRouter.ts
 * REST endpoints for all 22 organs.
 * Every organ action goes through this router → organRegistry tracking.
 *
 * Mounted at: /api/organs
 */
import { Router }        from "express";
import { organRegistry } from "./organRegistry";
import { getSystemSnapshot } from "./organMetrics";
import {randomUUID} from "node:crypto";
import {dispatchOrgan} from "./dispatch";
import {probeCanary} from "./probes";

export const organRouter = Router();

// ── GET /api/organs — list all ────────────────────────────────────────────
organRouter.get("/", (req, res) => {
  res.json({
    total:    organRegistry.all().length,
    organs:   organRegistry.all(),
    snapshot: getSystemSnapshot(),
  });
});

// ── GET /api/organs/all — explicit all array ─────────────────────────────
organRouter.get("/all", (req, res) => {
  res.json({
    total: organRegistry.all().length,
    organs: organRegistry.all(),
  });
});

// Read-only probes exercise routing without executing arbitrary organ actions.
organRouter.get('/probe-canary',(_req,res)=>res.json(probeCanary.snapshot()));
organRouter.post('/load-all',async(req,res)=>{
 const started=performance.now();
 const request_id=typeof req.body?.request_id==='string'?req.body.request_id:randomUUID();
 const results=await Promise.all(organRegistry.all().map(async organ=>{try{return {id:organ.id,success:true,result:await dispatchOrgan(organ.id,'probe',{request_id},(req as any).microfixdTenantId)};}catch{return {id:organ.id,success:false,error:'PROBE_FAILED'};}}));
 const byLayer:Record<string,number>={};for(const organ of organRegistry.all())byLayer[organ.layer]=(byLayer[organ.layer]??0)+1;
 res.json({success:results.every(r=>r.success),totalLoaded:results.length,durationMs:Math.round(performance.now()-started),byLayer,systemHealth:organRegistry.systemHealth(),organs:organRegistry.all().map(organ=>({id:organ.id,name:organ.name,layer:organ.layer,status:organ.status})),request_id,probe_only:true,results});
});
organRouter.post('/batch',async(req,res)=>{
 const calls=req.body?.calls;if(!Array.isArray(calls)||!calls.length||calls.length>256||calls.some(c=>!c||typeof c.id!=='string'||typeof c.action!=='string'))return res.status(400).json({code:'INVALID_BATCH'});
 const results=await Promise.all(calls.map(async c=>{try{return {id:c.id,success:true,result:await dispatchOrgan(c.id,c.action,c.payload??{},(req as any).microfixdTenantId)};}catch{return {id:c.id,success:false,error:'EXECUTION_FAILED'};}}));
 res.json({success:results.every(r=>r.success),totalCalls:calls.length,results});
});
organRouter.post('/broadcast',async(req,res)=>{
 const ids=req.body?.organ_ids;if(!Array.isArray(ids)||!ids.length||ids.length>256||ids.some(id=>typeof id!=='string')||typeof req.body.action!=='string')return res.status(400).json({code:'INVALID_BROADCAST'});
 const results=await Promise.all(ids.map(async id=>{try{return {id,success:true,result:await dispatchOrgan(id,req.body.action,req.body.payload??{},(req as any).microfixdTenantId)};}catch{return {id,success:false,error:'EXECUTION_FAILED'};}}));
 res.json({success:results.every(r=>r.success),results});
});

// ── GET /api/organs/snapshot — system snapshot ────────────────────────────
organRouter.get("/snapshot", (req, res) => {
  res.json(getSystemSnapshot());
});

// ── GET /api/organs/:id/status ────────────────────────────────────────────
organRouter.get("/:id/status", (req, res) => {
  const organ = organRegistry.get(req.params.id);
  if (!organ) return res.status(404).json({ error: `Organ '${req.params.id}' not found` });
  res.json({ id: organ.id, name: organ.name, status: organ.status, error_count: organ.error_count, isolated: organ.isolated });
});

// ── GET /api/organs/:id/metrics ───────────────────────────────────────────
organRouter.get("/:id/metrics", (req, res) => {
  const organ = organRegistry.get(req.params.id);
  if (!organ) return res.status(404).json({ error: `Organ '${req.params.id}' not found` });
  res.json({ id: organ.id, metrics: organ.metrics, exec_count: organ.exec_count, last_exec: organ.last_exec });
});

// ── GET /api/organs/:id/log ───────────────────────────────────────────────
organRouter.get("/:id/log", (req, res) => {
  const organ = organRegistry.get(req.params.id);
  if (!organ) return res.status(404).json({ error: `Organ '${req.params.id}' not found` });
  const limit = Number(req.query.limit ?? 20);
  res.json({ id: organ.id, log: organ.log.slice(-limit) });
});

// ── GET /api/organs/:id — full organ record ──────────────────────────────
organRouter.get("/:id", (req, res) => {
  const organ = organRegistry.get(req.params.id);
  if (!organ) return res.status(404).json({ error: `Organ '${req.params.id}' not found` });
  res.json({
    organ,
    capabilities: {
      executable: true,
      isolated: organ.isolated,
      status: organ.status,
      layer: organ.layer,
    }
  });
});

const execute:import('express').RequestHandler=async(req,res)=>{
 const id=req.params.id,action=req.body?.action??'execute';
 if(typeof action!=='string')return void res.status(400).json({code:'INVALID_ACTION'});
 if(!organRegistry.get(id))return void res.status(404).json({code:'UNKNOWN_ORGAN'});
 if(organRegistry.get(id)?.isolated)return void res.status(503).json({code:'ORGAN_ISOLATED'});
 try{res.json({success:true,organ:id,action,result:await dispatchOrgan(id,action,req.body?.payload??{},(req as any).microfixdTenantId)});}catch{res.status(500).json({success:false,code:'ORGAN_EXECUTION_FAILED'});}
};
organRouter.post('/:id',execute);
organRouter.post('/:id/execute',execute);

// ── POST /api/organs/:id/reset ────────────────────────────────────────────
organRouter.post("/:id/reset", (req, res) => {
  const success = organRegistry.reset(req.params.id);
  res.json({ success, id: req.params.id });
});

// ── POST /api/organs/:id/isolate ──────────────────────────────────────────
organRouter.post("/:id/isolate", (req, res) => {
  const success = organRegistry.isolate(req.params.id);
  res.json({ success, id: req.params.id });
});

