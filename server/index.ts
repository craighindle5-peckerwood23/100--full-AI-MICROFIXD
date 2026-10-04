/**
 * server/index.ts
 * Microfixd Backend Server — Playwright + Sandbox + HITL + GitHub + MCP
 *
 * Runs on port 3001 alongside Vite dev server (port 3000).
 * React UI connects via:
 *   REST:      http://localhost:3001/api/*
 *   WebSocket: ws://localhost:3001/ws
 *
 * Start: npx tsx server/index.ts
 */
import express       from "express";
import cors          from "cors";
import http          from "http";
import path          from "path";
import { readFileSync } from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { playwrightRouter }  from "./playwright/playwrightRouter";
import { configureMemoryTransport } from "../microfixd/core/memory/memory";
import { executeMemoryOrgan } from "./organs/organs/memoryOrgan";
import { sandboxRouter }     from "./sandbox/sandboxRouter";
import { hitlRouter }        from "./hitl/hitlRouter";
import { githubRouter }      from "./github/githubRouter";
import { mcpRouter }         from "./mcp/mcpRouter";
import { broadcastManager }  from "./playwright/screenshotStream";
import { organRouter }       from "./organs/organRouter";
import { getGroqDebugLogs } from "./orchestration/groqRetry";
import { orchestratorRouter } from "./orchestration/orchestratorRouter";
import { crawlRouter }       from "./crawl/crawlRouter";
import { toolsRouter }       from "./tools/toolsRouter";
import { securityRouter }    from "./security/securityRouter";
import { executionRouter }   from "./execution/executionRouter";
import { skinRouter }        from "./skin/skinRouter";
import { crossAIRouter }     from "./crossai/crossAIRouter";
import { autonomyRouter }   from "./autonomy-adapter/autonomyRouter";
import { rbacMiddleware, roleForToken }    from "./security/rbac";
import { organRegistry }     from "./organs/organRegistry";
import { getPending }        from "./hitl/hitlManager";
import { initOrgans }        from "../microfixd/langgraph/organs";
import { ClassificationError, getClassificationMap, resolveTypedObject } from "./classification";
import dispatchRouter from "../microfixd/backend/routes/agents/dispatch";

const PORT   = Number(process.env.PORT) || 3000;
const HOST   = "0.0.0.0";
export const app = express();
export const server = http.createServer(app);
export const wss = new WebSocketServer({ server, path: "/ws" });

// ── Middleware ─────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: allowedOrigins.length > 0,
}));
app.use(express.json({ limit: "10mb" }));

// ── Health and boot state (public, read-only) ──────────────────────────────
configureMemoryTransport(executeMemoryOrgan);
const cognitiveOrgans = initOrgans();

// Boot readiness for the OS TV: mirrors deep health without auth so the
// boot screen can show nominal/degraded before the operator logs in.
app.get("/readyz", (_, res) => {
  const configured = {
    admin: Boolean(process.env.ADMIN_TOKEN),
    supabase: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)),
    llm: Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
  };
  const health = organRegistry.systemHealth();
  const ready = configured.admin && configured.supabase && health !== "critical";
  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    systemHealth: health,
    storage: { durable: configured.supabase, engine: configured.supabase ? "supabase-postgres" : "in-memory" },
    ts: new Date().toISOString(),
  });
});

app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    version: "1.1.0",
    ts: new Date().toISOString(),
    services: ["playwright", "sandbox", "hitl", "github", "mcp", "organs", "command", "crawl", "tools", "security", "execution", "skin", "crossai"],
  });
});

app.get("/api/health/deep", async (_, res) => {
  let memoryReady = false;
  try { await cognitiveOrgans.memory.flush(); await executeMemoryOrgan("health", {}); memoryReady = true; } catch {}
  const records = organRegistry.all();
  const configured = {
    admin: Boolean(process.env.ADMIN_TOKEN),
    supabase: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)),
    llm: Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.VITE_GEMINI_API_KEY),
  };
  const ready = configured.admin && configured.supabase && memoryReady;
  res.status(ready ? 200 : 503).json({
    status: ready ? organRegistry.systemHealth() : "degraded",
    ready,
    ts: new Date().toISOString(),
    runtime: {
      organsInitialized: Boolean(cognitiveOrgans.paragon && cognitiveOrgans.wiring && cognitiveOrgans.memory),
      registeredOrgans: records.length,
      failedOrgans: records.filter((organ) => organ.status === "error").map((organ) => organ.id),
      pendingHumanApprovals: getPending().length,
    },
    configured,
    memory: { durable: memoryReady, status: memoryReady ? "nominal" : "unavailable" },
  });
});


// ── MCP manifest (public, read-only) ───────────────────────────────────────
app.get("/api/mcp/manifest", (_, res) => {
  try {
    const manifest = JSON.parse(
      readFileSync(path.resolve(process.cwd(), process.env.MCP_MANIFEST_PATH ?? "mcp-manifest.json"), "utf-8")
    );
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: "Failed to read MCP manifest: " + String(err) });
  }
});

// Every operational API below this line is authenticated and role-gated.
app.use(rbacMiddleware);

app.get("/api/classification/map", (_, res) => res.json(getClassificationMap()));
app.post("/api/classification/resolve", (req, res) => {
  try {
    res.json(resolveTypedObject(req.body));
  } catch (error) {
    if (error instanceof ClassificationError) {
      res.status(422).json({ error: error.message, code: error.code });
      return;
    }
    throw error;
  }
});

// ── REST routes ────────────────────────────────────────────────────────────
app.use("/api/agents",     dispatchRouter);
app.use("/api/playwright", playwrightRouter);
app.use("/api/sandbox",    sandboxRouter);
app.use("/api/hitl",       hitlRouter);
app.use("/api/github",     githubRouter);
app.use("/api/mcp",        mcpRouter);
app.use("/api/organs",     organRouter);
app.use("/api/command",    orchestratorRouter);
app.use("/api/crawl",      crawlRouter);
app.use("/api/tools",      toolsRouter);
app.use("/api/security",   securityRouter);
app.use("/api/execution",  executionRouter);
app.use("/api/skin",       skinRouter);
app.use("/api/crossai",    crossAIRouter);

// Autonomy API compatibility layer: lets the Microfixd OS TV frontend talk to
// this outlet over its native /api/autonomy/* contract. See the adapter file
// for the full endpoint->subsystem mapping.
app.use("/api/autonomy",   autonomyRouter);

// Groq Diagnostic Debug Logs Endpoint
app.get("/api/groq/debug-logs", (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  res.json({ logs: getGroqDebugLogs(limit) });
});

const distDir = path.resolve(process.cwd(), "dist");
app.use(express.static(distDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/api") return next();
  res.sendFile(path.join(distDir, "index.html"), err => err && next(err));
});

import { broadcast, registerWsClient, unregisterWsClient } from "./events";
export { broadcast };

// ── WebSocket hub ──────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  let authenticated = false;
  const timer = setTimeout(() => { if (!authenticated) ws.close(1008, "Authentication required"); }, 5000);
  ws.once("close", () => clearTimeout(timer));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (!authenticated) {
        if (msg.type !== "authenticate" || roleForToken(String(msg.payload?.token || "")) === "anonymous") {
          ws.close(1008, "Invalid authentication"); return;
        }
        authenticated = true; clearTimeout(timer); registerWsClient(ws);
        ws.send(JSON.stringify({type:"authenticated",ts:new Date().toISOString()})); return;
      }
      void handleWsMessage(ws, msg).catch(() => ws.send(JSON.stringify({type:"error",message:"Action failed"})));
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
    }
  });

  ws.on("close", () => {
    unregisterWsClient(ws);
    console.log(`[ws] Client disconnected.`);
  });


});

// Register broadcast with screenshot streamer
broadcastManager.setBroadcast(broadcast);

async function handleWsMessage(ws: WebSocket, msg: { type: string; payload?: unknown }): Promise<void> {
  const { type, payload } = msg;
  switch (type) {
    case "playwright:stream_start":
      broadcastManager.startStream((screenshot) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "playwright:screenshot", payload: screenshot }));
        }
      });
      break;
    case "playwright:stream_stop":
      broadcastManager.stopStream();
      break;
    case "ping":
      ws.send(JSON.stringify({ type: "pong" }));
      break;
  }
}

// ── Start (standalone mode) ────────────────────────────────────────────────
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("server/index.ts") || process.argv[1].endsWith("server.ts"))
) {
  server.listen(PORT, HOST, () => {
    console.log(`\n🧠 Microfixd Backend Server`);
    console.log(`   REST: http://${HOST}:${PORT}/api`);
    console.log(`   WS:   ws://${HOST}:${PORT}/ws`);
    console.log(`   Playwright, Sandbox, HITL, GitHub, MCP — ready\n`);
  });
}
