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
