// microfixd/backend/routes/agents/dispatch.ts

import { Router, Request, Response } from "express";
import { agentRegistry } from "../../core/agents/registry";
import { missionEngine } from "../../core/mission/engine";
import { memory } from "../../core/memory/state";
import { telemetry } from "../../core/telemetry/grid";
import { governanceEngine } from "../../core/governance/engine";

const router = Router();

/**
 * Safely writes a JSON response regardless of whether `res` is an Express Response
 * or a raw Node.js http.ServerResponse / Connect response.
 */
function sendJson(res: any, status: number, body: any) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(status).json(body);
  }
  if (typeof res.status === "function") {
    res.status(status);
  } else if ("statusCode" in res) {
    res.statusCode = status;
  }
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json");
  }
  const payload = JSON.stringify(body);
  if (typeof res.json === "function") {
    return res.json(body);
  }
  if (typeof res.end === "function") {
    return res.end(payload);
  }
  if (typeof res.send === "function") {
    return res.send(payload);
  }
  return body;
}

/**
 * POST /api/agents/dispatch
 * Body: { action: string }
 *
 * This endpoint receives UI actions (Optimize, Build, Analyze, etc.)
 * and dispatches the correct Microfixd agent.
 */
router.post("/dispatch", async (req: Request, res: Response): Promise<any> => {
  try {
    const { action } = req.body || {};

    if (!action) {
      return sendJson(res, 400, {
        error: "Missing 'action' in request body."
      });
    }

    // 1. Lookup agent from registry
    const agent = (agentRegistry as any)[action.toLowerCase()];
    if (!agent) {
      return sendJson(res, 404, {
        error: `No agent found for action '${action}'.`
      });
    }

    // 2. Log dispatch event into memory + telemetry
    memory.logEvent({
      type: "agent_dispatch",
      agent: agent.name,
      action,
      timestamp: Date.now()
    });

    telemetry.push("agent_dispatch", {
      agent: agent.name,
      action,
      ts: Date.now()
    });

    // 3. Evaluate against Governance Engine
    const decision = await governanceEngine.evaluateAction(action.toLowerCase(), agent.name || action);

    if (decision.decision === "BLOCK") {
      return sendJson(res, 403, {
        status: "error",
        error: `Blocked by Governance: ${decision.reason}`,
        decision
      });
    }

    if (decision.decision === "PENDING_APPROVAL") {
      return sendJson(res, 403, {
        status: "error",
        error: `Requires Manual Approval: ${decision.reason}`,
        decision
      });
    }

    // 4. Execute agent task
    const result = await agent.execute({
      mission: missionEngine.getCurrentMission(),
      memory,
      telemetry
    });

    // 5. Return agent output to UI
    return sendJson(res, 200, {
      status: "ok",
      agent: agent.name,
      action,
      result
    });

  } catch (err: any) {
    console.error("Agent dispatch error:", err);
    return sendJson(res, 500, {
      error: "Agent dispatch failed.",
      details: err?.message || String(err)
    });
  }
});

export default router;
