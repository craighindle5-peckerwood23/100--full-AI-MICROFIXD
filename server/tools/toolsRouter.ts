/**
 * server/tools/toolsRouter.ts
 * REST endpoints for the Tools Orchestration layer.
 *
 * GET  /api/tools                — List all registered tools
 * POST /api/tools/run            { message, system_prompt? } — Groq + tool calling
 * POST /api/tools/execute        { tool_name, arguments }   — Direct tool call
 */
import { Router }              from "express";
import { TOOL_REGISTRY }       from "./toolRegistry";
import { orchestrateWithTools } from "./toolOrchestrator";
import { getTool }             from "./toolRegistry";
import { organRegistry }       from "../organs/organRegistry";
import { executePlaywrightOrgan } from "../organs/organs/playwrightOrgan";
import { executeMemoryOrgan }     from "../organs/organs/memoryOrgan";
import { executeCrawlOrgan }      from "../organs/organs/crawlOrgan";

export const toolsRouter = Router();

const DIRECT_EXECUTORS: Record<string, (action: string, payload: unknown) => Promise<unknown>> = {
  playwright:   executePlaywrightOrgan,
  memory:       executeMemoryOrgan,
  crawl_engine: executeCrawlOrgan,
};

toolsRouter.get("/", (req, res) => {
  res.json({ tools: TOOL_REGISTRY, count: TOOL_REGISTRY.length });
});

toolsRouter.post("/run", async (req, res) => {
  const { message, system_prompt } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  try {
    const result = await orchestrateWithTools(message, system_prompt, 5, String(req.body.session_id || "default"));
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

toolsRouter.post("/execute", async (req, res) => {
  const { tool_name, arguments: args = {} } = req.body;
  if (!tool_name) return res.status(400).json({ error: "tool_name required" });
  const tool = getTool(tool_name);
  if (!tool)   return res.status(404).json({ error: `Tool '${tool_name}' not found` });

  const executor = DIRECT_EXECUTORS[tool.organ];
  if (!executor) return res.status(400).json({ error: `No direct executor for organ '${tool.organ}'` });

  const t0 = Date.now();
  try {
    const result  = await executor(tool.action, args);
    const latency = Date.now() - t0;
    organRegistry.recordExec(tool.organ, true, latency, tool.action);
    res.json({ success: true, tool: tool_name, organ: tool.organ, result, latency_ms: latency });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
