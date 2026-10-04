/**
 * server/orchestration/orchestratorRouter.ts
 * REST endpoints for command center.
 *
 * POST /api/command/run           — Run a command through full pipeline
 * GET  /api/command/feedback      — Get feedback history
 * GET  /api/command/metrics       — System performance metrics
 * POST /api/command/broadcast     — Broadcast message to all organs
 */
import { executeMemoryOrgan } from "../organs/organs/memoryOrgan";
import { broadcast } from "../events";
import { Router }     from "express";
import { runCommand, runSystemLoadTest } from "./commandCenter";
import { feedbackLoop } from "./feedbackLoop";
import { getSystemSnapshot } from "../organs/organMetrics";
import { worldThinkingEngine } from "./worldThinkingEngine";
import { orchestrationOversight } from "./orchestrationOversight";

export const orchestratorRouter = Router();

orchestratorRouter.post("/output/ack", async (req,res) => {
  try {
    const result = await executeMemoryOrgan("ack_output",req.body);
    if(!result.duplicate && result.state === "completed")broadcast("mission:completed",{missionId:result.cmdId,response_id:result.response_id,session_id:req.body.session_id,outcome:"succeeded",event_id:`playback:${result.response_id}`});
    if(!result.duplicate)broadcast(result.state === "completed" ? "command:complete" : "command:playback_failed",{...result,session_id:req.body.session_id});
    res.json(result);
  } catch(err) {res.status(400).json({success:false,error:String(err)});}
});

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

orchestratorRouter.post("/load-test", async (req, res) => {
  const factor = Number(req.body?.concurrencyFactor ?? 2.0);
  try {
    const report = await runSystemLoadTest(factor);
    res.json(report);
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

// ── World Thinking Engine REST API ──────────────────────────────────────────
orchestratorRouter.post("/world-thinking/simulate", async (req, res) => {
  try {
    const { task = "System Invariant & Future State Projection", actions = [] } = req.body;
    const report = await worldThinkingEngine.simulateWorldThinking(task, actions);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

orchestratorRouter.get("/world-thinking/history", (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  res.json({ history: worldThinkingEngine.getHistory(limit) });
});

// ── Orchestration Oversight & Recursion Governance REST API ───────────────────
orchestratorRouter.get("/oversight/invariants", (req, res) => {
  res.json({
    invariants: orchestrationOversight.getInvariants(),
    activeSpawns: orchestrationOversight.getActiveSpawns(),
  });
});

orchestratorRouter.get("/oversight/audits", (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  res.json({ audits: orchestrationOversight.getAudits(limit) });
});

orchestratorRouter.get("/oversight/active-spawns", (req, res) => {
  res.json({ activeSpawns: orchestrationOversight.getActiveSpawns() });
});

orchestratorRouter.post("/oversight/kill-switch", (req, res) => {
  const { action = "trigger" } = req.body;
  if (action === "trigger") {
    orchestrationOversight.triggerEmergencyKill();
    return res.json({ success: true, emergencyKillEngaged: true, message: "Emergency Zero-State Kill Switch Engaged" });
  } else {
    orchestrationOversight.resetEmergencyKill();
    return res.json({ success: true, emergencyKillEngaged: false, message: "Emergency Kill Switch Disengaged (Nominal)" });
  }
});

orchestratorRouter.post("/oversight/verify-depth", (req, res) => {
  const { source = "Agent_Tester", action = "dispatch_subtask", depth = 1 } = req.body;
  const result = orchestrationOversight.verifyDelegation(source, action, Number(depth));
  res.json(result);
});

