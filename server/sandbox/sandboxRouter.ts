/**
 * server/sandbox/sandboxRouter.ts
 * REST API for sandbox code execution.
 *
 * POST /api/sandbox/run     { code, lang, session_id }
 * GET  /api/sandbox/log     Returns session_log.jsonl entries
 * DELETE /api/sandbox/log   Clear session log
 */
import { Router }  from "express";
import { runCode } from "./codeRunner";
import { broadcast } from "../events";
import fs   from "fs";
import path from "path";

export const sandboxRouter = Router();
const SESSION_LOG = path.join(process.cwd(), "server", "sandbox", "session_log.jsonl");

sandboxRouter.post("/run", async (req, res) => {
  const { code, lang = "typescript", session_id = "default", approval_id } = req.body;
  if (typeof code !== "string" || !code.trim() || code.length > 65536 || typeof lang !== "string" || typeof session_id !== "string") return res.status(400).json({ error: "code required" });

  const result = await runCode(code, lang, session_id, approval_id);
  // Broadcast to all WS clients so HSH can update (rule-SB-001)
  broadcast("sandbox:exec_result", result);
  res.status(result.approval_required ? 202 : result.success ? 200 : 422).json(result);
});

sandboxRouter.get("/log", (req, res) => {
  if (!fs.existsSync(SESSION_LOG)) return res.json({ entries: [] });
  const lines = fs.readFileSync(SESSION_LOG, "utf-8")
    .split("\n").filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  res.json({ entries: lines.slice(-limit), total: lines.length });
});

sandboxRouter.delete("/log", (req, res) => {
  if (fs.existsSync(SESSION_LOG)) fs.writeFileSync(SESSION_LOG, "");
  res.json({ success: true });
});
