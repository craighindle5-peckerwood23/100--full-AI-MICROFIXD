/**
 * server/hitl/hitlRouter.ts
 * REST API for HITL queue.
 *
 * GET  /api/hitl/pending        — Get all pending reviews
 * GET  /api/hitl/all            — Get all records
 * POST /api/hitl/trigger        { session_id, artifact }
 * POST /api/hitl/decide         { hitl_id, decision, notes? }
 */
import { Router } from "express";
import { trigger, decide, getPending, getAll } from "./hitlManager";

export const hitlRouter = Router();

hitlRouter.get("/pending", (req, res) => {
  res.json({ records: getPending(), count: getPending().length });
});

hitlRouter.get("/all", (req, res) => {
  res.json({ records: getAll(), count: getAll().length });
});

hitlRouter.post("/trigger", (req, res) => {
  const { session_id = "default", artifact, trigger: triggerType = "build_complete" } = req.body;
  if (!artifact?.name) return res.status(400).json({ error: "artifact.name required" });
  const record = trigger(session_id, artifact, triggerType);
  res.json({ success: true, record });
});

hitlRouter.post("/decide", (req, res) => {
  const { hitl_id, decision, notes } = req.body;
  if (!hitl_id || !["approved","rejected"].includes(decision)) {
    return res.status(400).json({ error: "hitl_id + decision (approved|rejected) required" });
  }
  const record = decide(hitl_id, decision, notes);
  if (!record) return res.status(404).json({ error: `HITL record ${hitl_id} not found.` });
  res.json({ success: true, record });
});
