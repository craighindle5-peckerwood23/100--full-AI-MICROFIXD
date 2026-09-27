import { Router }    from "express";
import { execute }   from "./executionSpine";
import { executionTracer } from "./executionTracer";
import { getCircuitBreakerStatus } from "./executionSpine";

export const executionRouter = Router();

executionRouter.post("/run", async (req, res) => {
  const { task, session_id = crypto.randomUUID(), priority = 1, source = "api" } = req.body;
  if (!task) return res.status(400).json({ error: "task required" });
  const result = await execute({ id: crypto.randomUUID(), task, session_id, priority, source, created_at: new Date().toISOString() });
  res.json(result);
});

executionRouter.get("/traces",        (req, res) => res.json({ traces: executionTracer.listTraces(20) }));
executionRouter.get("/traces/:id",    (req, res) => res.json(executionTracer.getTrace(req.params.id) ?? { error: "not found" }));
executionRouter.get("/circuit-breakers", (req, res) => res.json({ breakers: getCircuitBreakerStatus() }));
