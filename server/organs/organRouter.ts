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
import { EXECUTORS } from "./executors";

export const organRouter = Router();

// ── GET /api/organs — list all ────────────────────────────────────────────
organRouter.get("/", (req, res) => {
  res.json({
    organs:   organRegistry.all(),
    snapshot: getSystemSnapshot(),
  });
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

// ── POST /api/organs/:id/execute — THE MAIN CALL ─────────────────────────
organRouter.post("/:id/execute", async (req, res) => {
  const { id } = req.params;
  const { action = "default", payload = {} } = req.body;
  const organ = organRegistry.get(id);
  if (!organ) return res.status(404).json({ error: `Organ '${id}' not found` });
  if (!EXECUTORS[id]) return res.status(422).json({ error: `Organ '${id}' has no executable node` });
  if (organ.isolated) return res.status(503).json({ error: `Organ '${id}' is isolated` });

  const t0 = Date.now();
  organRegistry.setStatus(id, "busy");

  try {
    const executor = EXECUTORS[id];
    const result   = await executor(action, payload);
    const latency  = Date.now() - t0;
    organRegistry.recordExec(id, true, latency, action);
    organRegistry.setStatus(id, "active");
    res.json({ success: true, organ: id, action, result, latency_ms: latency });
  } catch (err) {
    const latency = Date.now() - t0;
    const errMsg  = String(err);
    organRegistry.recordExec(id, false, latency, action, errMsg);
    organRegistry.setStatus(id, "error", errMsg);
    res.status(500).json({ success: false, organ: id, action, error: errMsg, latency_ms: latency });
  }
});

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

// ── POST /api/organs/broadcast — call multiple organs ─────────────────────
organRouter.post("/broadcast", async (req, res) => {
  const { organ_ids, action, payload } = req.body;
  if (!Array.isArray(organ_ids)) return res.status(400).json({ error: "organ_ids array required" });

  const results = await Promise.allSettled(
    organ_ids.map(async (id: string) => {
      const t0       = Date.now();
      const organ    = organRegistry.get(id);
      if (!organ || organ.isolated || !EXECUTORS[id]) return { id, skipped: true, error: !EXECUTORS[id] ? "No executable node" : undefined };
      organRegistry.setStatus(id, "busy");
      const executor = EXECUTORS[id];
      const result   = await executor(action, payload);
      const latency  = Date.now() - t0;
      organRegistry.recordExec(id, true, latency, action);
      organRegistry.setStatus(id, "active");
      return { id, result, latency_ms: latency };
    })
  );

  res.json({
    success: true,
    results: results.map(r => r.status === "fulfilled" ? r.value : { error: String((r as PromiseRejectedResult).reason) }),
  });
});
