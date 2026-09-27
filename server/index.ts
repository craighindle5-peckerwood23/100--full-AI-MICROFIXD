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
import { WebSocketServer, WebSocket } from "ws";
import { playwrightRouter }  from "./playwright/playwrightRouter";
import { sandboxRouter }     from "./sandbox/sandboxRouter";
import { hitlRouter }        from "./hitl/hitlRouter";
import { githubRouter }      from "./github/githubRouter";
import { mcpRouter }         from "./mcp/mcpRouter";
import { broadcastManager }  from "./playwright/screenshotStream";
import { organRouter }       from "./organs/organRouter";
import { orchestratorRouter } from "./orchestration/orchestratorRouter";
import { crawlRouter }       from "./crawl/crawlRouter";
import { toolsRouter }       from "./tools/toolsRouter";
import { securityRouter }    from "./security/securityRouter";
import { executionRouter }   from "./execution/executionRouter";
import { skinRouter }        from "./skin/skinRouter";
import { crossAIRouter }     from "./crossai/crossAIRouter";

const PORT   = Number(process.env.PORT) || 3001;
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: "/ws" });

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// ── REST routes ────────────────────────────────────────────────────────────
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

// ── Health check ───────────────────────────────────────────────────────────
app.get("/api/health", (_, res) => {
  res.json({
    status:    "ok",
    version:   "1.0.0",
    ts:        new Date().toISOString(),
    services:  ["playwright", "sandbox", "hitl", "github", "mcp", "organs", "command", "crawl", "tools", "security", "execution", "skin", "crossai"],
  });
});

const distDir = path.resolve(process.cwd(), "dist");
app.use(express.static(distDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/api") return next();
  res.sendFile(path.join(distDir, "index.html"), err => err && next(err));
});

// ── WebSocket hub ──────────────────────────────────────────────────────────
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[ws] Client connected. Total: ${clients.size}`);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleWsMessage(ws, msg);
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[ws] Client disconnected. Total: ${clients.size}`);
  });

  // Send initial system state
  ws.send(JSON.stringify({ type: "connected", ts: new Date().toISOString() }));
});

// Broadcast to all connected clients
export function broadcast(type: string, payload: unknown): void {
  const msg = JSON.stringify({ type, payload, ts: new Date().toISOString() });
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

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

// ── Start ──────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🧠 Microfixd Backend Server`);
  console.log(`   REST: http://localhost:${PORT}/api`);
  console.log(`   WS:   ws://localhost:${PORT}/ws`);
  console.log(`   Playwright, Sandbox, HITL, GitHub, MCP — ready\n`);
});
