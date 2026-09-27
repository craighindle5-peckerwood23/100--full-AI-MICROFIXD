/**
 * server/orchestration/orchestratorRouter.ts
 * REST endpoints for command center.
 *
 * POST /api/command/run           — Run a command through full pipeline
 * GET  /api/command/feedback      — Get feedback history
 * GET  /api/command/metrics       — System performance metrics
 * POST /api/command/broadcast     — Broadcast message to all organs
 */
import { Router }     from "express";
import { runCommand } from "./commandCenter";
import { feedbackLoop } from "./feedbackLoop";
import { getSystemSnapshot } from "../organs/organMetrics";

export const orchestratorRouter = Router();

orchestratorRouter.post("/run", async (req, res) => {
  const { task, session_id = crypto.randomUUID(), source = "api", priority = "normal", context } = req.body;
  if (!task) return res.status(400).json({ error: "task required" });
  try {
    const result = await runCommand({ task, session_id, source, priority, context });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

orchestratorRouter.get("/feedback", (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  res.json({ reports: feedbackLoop.getHistory(limit), avg_latency_ms: feedbackLoop.getAverageLatency() });
});

orchestratorRouter.get("/metrics", (req, res) => {
  res.json(getSystemSnapshot());
});
