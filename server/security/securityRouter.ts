/**
 * server/security/securityRouter.ts
 * REST endpoints for Security Spine.
 * Mounted at: /api/security
 *
 * GET  /api/security/stats        — Security stats
 * POST /api/security/check-input  { input } — Tamper check
 * POST /api/security/check-output { output } — Drift check
 * GET  /api/security/identity     — Current identity record
 * GET  /api/security/audit        — RBAC audit log
 * GET  /api/security/drift        — Drift history
 */
import { Router }        from "express";
import { securitySpine } from "./securitySpine";
import { getDriftHistory, getDriftStats } from "./antiDrift";
import { getIdentity }   from "./identityLock";
import { getRbacAuditLog } from "./rbac";

export const securityRouter = Router();

securityRouter.get("/stats",   (req, res) => res.json(securitySpine.getStats()));
securityRouter.get("/identity",(req, res) => res.json(getIdentity()));
securityRouter.get("/audit",   (req, res) => res.json({ log: getRbacAuditLog(100) }));
securityRouter.get("/drift",   (req, res) => res.json({ history: getDriftHistory(50), stats: getDriftStats() }));

securityRouter.post("/check-input", (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: "input required" });
  const result = securitySpine.checkInput(input);
  res.json(result);
});

securityRouter.post("/check-output", async (req, res) => {
  const { output } = req.body;
  if (!output) return res.status(400).json({ error: "output required" });
  const result = await securitySpine.checkOutput(output);
  res.json(result);
});

securityRouter.post("/full-check", async (req, res) => {
  const { input, output } = req.body;
  if (!input || !output) return res.status(400).json({ error: "input + output required" });
  const result = await securitySpine.fullCheck(input, output);
  res.json(result);
});
