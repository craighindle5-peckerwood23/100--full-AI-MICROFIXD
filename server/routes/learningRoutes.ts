/**
 * server/routes/learningRoutes.ts
 * Dedicated REST API for Evaluation Engine, Real Learning Loop, and Self-Healing Pipeline
 */

import { Router } from "express";
import { evaluationOrgan } from "../../microfixd/organs/evaluation/evaluator";
import { evaluationMemory } from "../../microfixd/organs/evaluation/evaluation_memory";
import { realLearningPipeline } from "../../microfixd/learning/learning_loop";
import { selfHealingPipeline } from "../../learning/self_healing";
import { experienceMemory } from "../../microfixd/memory/experiences/patterns";
import {healingConfiguration,healingMissionRequest,readHealingStatus} from '../engineering/healingStatus';
import {plannerClient} from '../planner/supabaseRuntime';
import {submitMission} from '../planner/plannerRouter';

export const learningRouter = Router();

// 1. Direct Evaluation Engine
learningRouter.post("/evaluate", (req, res) => {
  const { task, candidate, expectedContains, mustNotContain } = req.body || {};
  if (!candidate || typeof candidate !== "string") {
    return res.status(400).json({ error: "Candidate string is required for evaluation." });
  }

  const tenant_id = (req as any).microfixdTenantId || "global";
  const result = evaluationOrgan.evaluate({
    task: task || "Evaluated Task",
    candidate,
    expectedContains,
    mustNotContain,
    tenant_id,
  });

  res.json(result);
});

// 2. Evaluation Memory & Stats
learningRouter.get("/evaluations", (req, res) => {
  const tenant_id = (req as any).microfixdTenantId || "global";
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const records = evaluationMemory.getRecent(limit, tenant_id);
  res.json({ count: records.length, records });
});

learningRouter.get("/evaluations/stats", (req, res) => {
  const tenant_id = (req as any).microfixdTenantId || "global";
  const stats = evaluationMemory.getSummary(tenant_id);
  res.json(stats);
});

// 3. Real Learning Cycle (Observe -> Evaluate -> Reflect -> Adapt -> Verify -> Remember)
learningRouter.post("/cycle", async (req, res) => {
  const { task, initialOutput, expectedContains, mustNotContain, context } = req.body || {};
  if (!task || !initialOutput) {
    return res.status(400).json({ error: "Both 'task' and 'initialOutput' are required to run a learning cycle." });
  }

  try {
    const tenant_id = (req as any).microfixdTenantId || "global";
    const report = await realLearningPipeline.executeLearningCycle({
      task,
      initialOutput,
      expectedContains,
      mustNotContain,
      tenant_id,
      context,
    });
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// 4. Self-Healing Pipeline
learningRouter.get('/self-healing/status',async(req,res)=>{
  const tenant=(req as any).microfixdTenantId;
  if(!tenant)return res.status(403).json({code:'AUTH_REQUIRED'});
  try{res.set('Cache-Control','no-store');const status=await readHealingStatus(plannerClient(),tenant);
    res.json({...status,can_request_repair:status.can_request_repair&&(req as any).microfixdRole==='admin'});
  }catch{res.status(503).json({code:'HEALING_STORAGE_UNAVAILABLE'});}
});
learningRouter.post('/self-healing/repair',async(req,res,next)=>{
  if((req as any).microfixdRole!=='admin'||(req as any).microfixdTenantId!==(process.env.MICROFIXD_REPAIR_OWNER_TENANT||'default'))return res.status(403).json({code:'REPAIR_OWNER_ADMIN_REQUIRED'});
  if(!req.header('Idempotency-Key'))return res.status(400).json({code:'IDEMPOTENCY_KEY_REQUIRED'});
  if(!healingConfiguration().configured)return res.status(503).json({code:'REPAIR_RUNNER_UNCONFIGURED'});
  try{req.body=healingMissionRequest(req.body);}catch{return res.status(400).json({code:'INVALID_REPAIR_REQUEST',error:'Provide allowed source paths and an objective ending in Regression case: tests/file.test.ts#exact test name.'});}
  return submitMission(req,res,next);
});
learningRouter.post("/self-healing", async (req, res) => {
  const { source = "api_request", error = "Simulated fault test" } = req.body || {};
  try {
    const report = await selfHealingPipeline.runHealingCycle(source, error, (req as any).microfixdTenantId ?? 'default');
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

learningRouter.get("/self-healing/history", (req, res) => {
  res.json({ history: selfHealingPipeline.getHistory((req as any).microfixdTenantId ?? 'default') });
});

// 5. Memory Experiences & Patterns
learningRouter.get("/experiences", (req, res) => {
  const tenant_id = (req as any).microfixdTenantId || "global";
  const lessons = experienceMemory.getRecentLessons(20, tenant_id);
  const corrections = experienceMemory.getRecentCorrections(20, tenant_id);
  const stats = experienceMemory.getAllStats(tenant_id);

  res.json({ stats, lessons, corrections });
});
