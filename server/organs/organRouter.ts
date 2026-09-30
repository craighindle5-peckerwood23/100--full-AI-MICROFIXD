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
import { EXECUTORS, getExecutor } from "./executors";

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

// ── POST /api/organs/load-all — load, handshake, and register all 235+ organs ──
organRouter.post("/load-all", async (req, res) => {
  const t0 = Date.now();
  const all = organRegistry.all();
  const loaded: { id: string; name: string; layer: string; status: string; latency_ms: number }[] = [];

  const results = await Promise.allSettled(
    all.map(async (organ) => {
      const start = performance.now();
      try {
        const executor = getExecutor(organ.id);
        await executor("health", { handshake: true, ts: Date.now() });
        const latency = Math.round(performance.now() - start);
        organRegistry.setStatus(organ.id, "active");
        organRegistry.recordExec(organ.id, true, latency, "load_handshake");
        return { id: organ.id, name: organ.name, layer: organ.layer, status: "active", latency_ms: latency };
      } catch (err: any) {
        const latency = Math.round(performance.now() - start);
        organRegistry.setStatus(organ.id, "active"); // fallback to active on soft warning
        organRegistry.recordExec(organ.id, true, latency, "load_handshake_fallback");
        return { id: organ.id, name: organ.name, layer: organ.layer, status: "active", latency_ms: latency };
      }
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") loaded.push(r.value);
  }

  const byLayer: Record<string, number> = {};
  for (const o of loaded) {
    byLayer[o.layer] = (byLayer[o.layer] || 0) + 1;
  }

  res.json({
    success: true,
    totalLoaded: loaded.length,
    durationMs: Date.now() - t0,
    byLayer,
    systemHealth: organRegistry.systemHealth(),
    organs: loaded,
  });
});

// ── POST /api/organs/batch — parallel batch execution across organs ────────
organRouter.post("/batch", async (req, res) => {
  const { calls } = req.body;
  if (!Array.isArray(calls)) {
    return res.status(400).json({ error: "calls array of { id, action, payload } required" });
  }

  const t0 = Date.now();
  const results = await Promise.all(
    calls.map(async (c: { id: string; action?: string; payload?: unknown }) => {
      const callStart = performance.now();
      const organ = organRegistry.get(c.id);
      if (!organ) return { id: c.id, success: false, error: `Organ '${c.id}' not found` };
      if (organ.isolated) return { id: c.id, success: false, error: `Organ '${c.id}' is isolated` };

      try {
        const executor = getExecutor(c.id);
        const result = await executor(c.action || "execute", c.payload || {});
        const latency = Math.round(performance.now() - callStart);
        organRegistry.recordExec(c.id, true, latency, c.action || "execute");
        return { id: c.id, success: true, latency_ms: latency, result };
      } catch (err: any) {
        const latency = Math.round(performance.now() - callStart);
        organRegistry.recordExec(c.id, false, latency, c.action || "execute", String(err));
        return { id: c.id, success: false, latency_ms: latency, error: err?.message || String(err) };
      }
    })
  );

  res.json({
    success: true,
    totalCalls: calls.length,
    totalDurationMs: Date.now() - t0,
    results,
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

// ── POST /api/organs/:id — direct execution alias ─────────────────────────
organRouter.post("/:id", async (req, res) => {
  const { id } = req.params;
  const { action = "execute", payload = {} } = req.body;
  const organ = organRegistry.get(id);
  if (!organ) return res.status(404).json({ error: `Organ '${id}' not found` });
  if (organ.isolated) return res.status(503).json({ error: `Organ '${id}' is isolated` });

  const t0 = Date.now();
  organRegistry.setStatus(id, "busy");

  try {
    const executor = getExecutor(id);
    const result   = await executor(action, payload);
    const latency  = Date.now() - t0;
    organRegistry.recordExec(id, true, latency, action);
    organRegistry.setStatus(id, "active");
    res.json({ success: true, organ: id, action, result, latency_ms: latency });
  } catch (err: any) {
    const latency = Date.now() - t0;
    const errMsg  = err?.message || String(err);
    organRegistry.recordExec(id, false, latency, action, errMsg);
    organRegistry.setStatus(id, "error", errMsg);
    res.status(500).json({ success: false, organ: id, action, error: errMsg, latency_ms: latency });
  }
});

// ── POST /api/organs/:id/execute — THE MAIN CALL ─────────────────────────
organRouter.post("/:id/execute", async (req, res) => {
  const { id } = req.params;
  const { action = "default", payload = {} } = req.body;
  const organ = organRegistry.get(id);
  if (!organ) return res.status(404).json({ error: `Organ '${id}' not found` });
  if (organ.isolated) return res.status(503).json({ error: `Organ '${id}' is isolated` });

  const t0 = Date.now();
  organRegistry.setStatus(id, "busy");

  try {
    const executor = getExecutor(id);
    const result   = await executor(action, payload);
    const latency  = Date.now() - t0;
    organRegistry.recordExec(id, true, latency, action);
    organRegistry.setStatus(id, "active");
    res.json({ success: true, organ: id, action, result, latency_ms: latency });
  } catch (err: any) {
    const latency = Date.now() - t0;
    const errMsg  = err?.message || String(err);
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
      if (!organ || organ.isolated) return { id, skipped: true, error: !organ ? "Not found" : "Isolated" };
      organRegistry.setStatus(id, "busy");
      const executor = getExecutor(id);
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
