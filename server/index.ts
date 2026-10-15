/**
 * server/index.ts
 * Microfixd Backend Server
 *
 * Production bootstrap is intentionally lightweight:
 * - bind HTTP/WS immediately
 * - serve health + built UI immediately
 * - lazy-load heavyweight operational routers on demand
 *
 * This prevents Render free-tier cold starts from presenting a platform 503
 * while Playwright, cognition, governance, memory and agent modules initialize.
 */
import express, { type RequestHandler } from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { readFileSync } from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { securityHeaders } from "./security/securityHeaders";
import { broadcast, registerWsClient, unregisterWsClient } from "./events";

export { broadcast };

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

export const app = express();
export const server = http.createServer(app);
export const wss = new WebSocketServer({ server, path: "/ws" });

type LazyHandler = () => Promise<RequestHandler>;
function lazyRouter(load: LazyHandler): RequestHandler {
  let resolved: Promise<RequestHandler> | null = null;
  return (req, res, next) => {
    resolved ??= load();
    void resolved
      .then((handler) => handler(req, res, next))
      .catch(next);
  };
}

let memoryConfigured = false;
let memorySetupPromise: Promise<void> | null = null;
async function ensureMemoryTransport(): Promise<void> {
  if (memoryConfigured) return;
  memorySetupPromise ??= (async () => {
    const [{ configureMemoryTransport }, { executeMemoryOrgan }] = await Promise.all([
      import("../microfixd/core/memory/memory"),
      import("./organs/organs/memoryOrgan"),
    ]);
    configureMemoryTransport(executeMemoryOrgan);
    memoryConfigured = true;
  })();
  return memorySetupPromise;
}

async function configuredRuntimeState() {
  const configured = {
    admin: Boolean(process.env.ADMIN_TOKEN),
    supabase: Boolean(
      process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
    ),
    llm: Boolean(
      process.env.OPENROUTER_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GEMINI_API_KEY,
    ),
  };

  let systemHealth = "starting";
  try {
    const { organRegistry } = await import("./organs/organRegistry");
    systemHealth = organRegistry.systemHealth();
  } catch {
    // Keep bootstrap health independent from heavyweight runtime loading.
  }

  return { configured, systemHealth };
}

// ── Baseline middleware ────────────────────────────────────────────────────
app.use(securityHeaders);

const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: allowedOrigins.length > 0,
}));

app.use(express.json({ limit: "10mb" }));

// ── Public bootstrap health ────────────────────────────────────────────────
// Keep this endpoint dependency-light so Render can confirm the port is alive
// even while the full cognitive runtime is still cold.
app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    version: "1.1.1",
    phase: "serving",
    commit: process.env.RENDER_GIT_COMMIT ?? "local",
    ts: new Date().toISOString(),
    services: [
      "playwright",
      "sandbox",
      "hitl",
      "github",
      "mcp",
      "organs",
      "command",
      "crawl",
      "tools",
      "security",
      "execution",
      "skin",
      "crossai",
    ],
  });
});

app.get("/health", (_, res) => res.redirect(307, "/api/health"));

app.get("/readyz", async (_, res) => {
  const { configured, systemHealth } = await configuredRuntimeState();
  const ready = configured.admin && configured.supabase && systemHealth !== "critical";

  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    systemHealth,
    storage: {
      durable: configured.supabase,
      engine: configured.supabase ? "supabase-postgres" : "unconfigured",
    },
    configured,
    ts: new Date().toISOString(),
  });
});

app.get("/api/branding", async (_, res) => {
  try {
    const { getBrandConfig } = await import("./branding");
    res.json(getBrandConfig());
  } catch (error) {
    res.status(503).json({ code: "BRANDING_UNAVAILABLE", error: String(error) });
  }
});

app.get("/api/health/deep", async (_, res) => {
  try {
    await ensureMemoryTransport();

    const [
      { initOrgans },
      { executeMemoryOrgan },
      { organRegistry },
      { getPending },
    ] = await Promise.all([
      import("../microfixd/langgraph/organs"),
      import("./organs/organs/memoryOrgan"),
      import("./organs/organRegistry"),
      import("./hitl/hitlManager"),
    ]);

    const cognitiveOrgans = initOrgans();
    let memoryReady = false;

    try {
      await cognitiveOrgans.memory.flush();
      await executeMemoryOrgan("health", {});
      memoryReady = true;
    } catch {}

    const records = organRegistry.all();
    const configured = {
      admin: Boolean(process.env.ADMIN_TOKEN),
      supabase: Boolean(
        process.env.SUPABASE_URL &&
        (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
      ),
      llm: Boolean(
        process.env.OPENROUTER_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.VITE_GEMINI_API_KEY,
      ),
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
      memory: {
        durable: memoryReady,
        status: memoryReady ? "nominal" : "unavailable",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      ready: false,
      code: "DEEP_HEALTH_UNAVAILABLE",
      error: error instanceof Error ? error.message : String(error),
      ts: new Date().toISOString(),
    });
  }
});

// ── MCP manifest (public, read-only) ───────────────────────────────────────
app.get("/api/mcp/manifest", (_, res) => {
  try {
    const manifest = JSON.parse(
      readFileSync(
        path.resolve(process.cwd(), process.env.MCP_MANIFEST_PATH ?? "mcp-manifest.json"),
        "utf-8",
      ),
    );
    res.json(manifest);
  } catch (error) {
    res.status(500).json({ error: "Failed to read MCP manifest: " + String(error) });
  }
});

// ── Authentication and rate limiting for operational APIs ─────────────────
app.use((req, res, next) => {
  if (!(req.path === "/api" || req.path.startsWith("/api/"))) {
    next();
    return;
  }

  void Promise.all([
    import("./security/rbac"),
    import("./security/rateLimiter"),
  ])
    .then(([{ rbacMiddleware }, { rateLimiter }]) => {
      rbacMiddleware(req, res, (error?: unknown) => {
        if (error) {
          next(error);
          return;
        }
        rateLimiter(req, res, next);
      });
    })
    .catch(next);
});

// ── Lazy operational API surface ───────────────────────────────────────────
app.get("/api/registry", async (_, res) => {
  try {
    const { organRegistry } = await import("./organs/organRegistry");
    const topology = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "microfixd/topology.json"), "utf-8"),
    );
    const wiring = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "microfixd/wiring.json"), "utf-8"),
    );
    const organs = organRegistry.all();
    res.json({ total: organs.length, organs, topology, wiring });
  } catch (error) {
    res.status(503).json({ code: "REGISTRY_UNAVAILABLE", error: String(error) });
  }
});

app.get("/api/classification/map", async (_, res) => {
  const { getClassificationMap } = await import("./classification");
  res.json(getClassificationMap());
});

app.post("/api/classification/resolve", async (req, res, next) => {
  try {
    const { ClassificationError, resolveTypedObject } = await import("./classification");
    res.json(resolveTypedObject(req.body));
  } catch (error) {
    const { ClassificationError } = await import("./classification");
    if (error instanceof ClassificationError) {
      res.status(422).json({ error: error.message, code: error.code });
      return;
    }
    next(error);
  }
});

app.use("/api/planner", lazyRouter(async () => {
  const { plannerRouter } = await import("./planner/plannerRouter");
  return plannerRouter;
}));
app.use("/api/agents", lazyRouter(async () => {
  await ensureMemoryTransport();
  const { default: dispatchRouter } = await import("../microfixd/backend/routes/agents/dispatch");
  return dispatchRouter;
}));
app.use("/api/playwright", lazyRouter(async () => {
  const { playwrightRouter } = await import("./playwright/playwrightRouter");
  return playwrightRouter;
}));
app.use("/api/sandbox", lazyRouter(async () => {
  const { sandboxRouter } = await import("./sandbox/sandboxRouter");
  return sandboxRouter;
}));
app.use("/api/hitl", lazyRouter(async () => {
  const { hitlRouter } = await import("./hitl/hitlRouter");
  return hitlRouter;
}));
app.use("/api/github", lazyRouter(async () => {
  const { githubRouter } = await import("./github/githubRouter");
  return githubRouter;
}));
app.use("/api/mcp", lazyRouter(async () => {
  const { mcpRouter } = await import("./mcp/mcpRouter");
  return mcpRouter;
}));
app.use("/api/organs", lazyRouter(async () => {
  await ensureMemoryTransport();
  const { organRouter } = await import("./organs/organRouter");
  return organRouter;
}));
app.use("/api/command", lazyRouter(async () => {
  await ensureMemoryTransport();
  const { orchestratorRouter } = await import("./orchestration/orchestratorRouter");
  return orchestratorRouter;
}));
app.use("/api/crawl", lazyRouter(async () => {
  const { crawlRouter } = await import("./crawl/crawlRouter");
  return crawlRouter;
}));
app.use("/api/tools", lazyRouter(async () => {
  const { toolsRouter } = await import("./tools/toolsRouter");
  return toolsRouter;
}));
app.use("/api/security", lazyRouter(async () => {
  const { securityRouter } = await import("./security/securityRouter");
  return securityRouter;
}));
app.use("/api/execution", lazyRouter(async () => {
  await ensureMemoryTransport();
  const { executionRouter } = await import("./execution/executionRouter");
  return executionRouter;
}));
app.use("/api/skin", lazyRouter(async () => {
  const { skinRouter } = await import("./skin/skinRouter");
  return skinRouter;
}));
app.use("/api/crossai", lazyRouter(async () => {
  await ensureMemoryTransport();
  const { crossAIRouter } = await import("./crossai/crossAIRouter");
  return crossAIRouter;
}));
app.use("/api/plugins", lazyRouter(async () => {
  const { pluginRouter } = await import("./plugins/pluginRouter");
  return pluginRouter;
}));
app.use("/api/autonomy", lazyRouter(async () => {
  await ensureMemoryTransport();
  const { autonomyRouter } = await import("./autonomy-adapter/autonomyRouter");
  return autonomyRouter;
}));

app.get("/api/groq/status", async (_, res) => {
  const { groqConfiguration } = await import("./orchestration/groqRuntime");
  res.json(groqConfiguration());
});

app.post("/api/groq/check", async (_, res) => {
  const [
    { getGroqClient, groqConfiguration },
    { executeGroqWithRetry },
  ] = await Promise.all([
    import("./orchestration/groqRuntime"),
    import("./orchestration/groqRetry"),
  ]);

  const client = getGroqClient();
  if (!client) {
    res.status(503).json({
      success: false,
      error: "GROQ_API_KEY is not configured on the server",
      code: "GROQ_NOT_CONFIGURED",
    });
    return;
  }

  try {
    const result = await executeGroqWithRetry(client, {
      model: groqConfiguration().model,
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 128,
      temperature: 0,
    });

    if (
      !result.content.trim() ||
      result.completion.choices[0]?.finish_reason !== "stop"
    ) {
      throw new Error("Groq returned an incomplete diagnostic response");
    }

    res.json({
      success: true,
      connected: true,
      model: result.modelUsed,
      latency_ms: result.totalLatencyMs,
    });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      connected: false,
      error: String(error?.message ?? error),
      provider_status: error?.status,
      code: "GROQ_CHECK_FAILED",
    });
  }
});

app.get("/api/groq/debug-logs", async (req, res) => {
  const { getGroqDebugLogs } = await import("./orchestration/groqRetry");
  const limit = Number(req.query.limit ?? 50);
  res.json({ logs: getGroqDebugLogs(limit) });
});

// ── Static production UI ───────────────────────────────────────────────────
const distDir = path.resolve(process.cwd(), "dist");
app.use(express.static(distDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/api") {
    next();
    return;
  }
  res.sendFile(path.join(distDir, "index.html"), (error) => error && next(error));
});

// ── WebSocket hub ──────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  let authenticated = false;
  const timer = setTimeout(() => {
    if (!authenticated) ws.close(1008, "Authentication required");
  }, 5000);

  ws.once("close", () => clearTimeout(timer));

  ws.on("message", (data) => {
    void (async () => {
      try {
        const msg = JSON.parse(data.toString());

        if (!authenticated) {
          const token = String(msg.payload?.token || "");
          const [
            { roleForToken },
            { verifySupabaseSession },
          ] = await Promise.all([
            import("./security/rbac"),
            import("./security/supabaseAuth"),
          ]);

          const authorized =
            roleForToken(token) !== "anonymous" ||
            Boolean(await verifySupabaseSession(token));

          if (msg.type !== "authenticate" || !authorized) {
            ws.close(1008, "Invalid authentication");
            return;
          }

          authenticated = true;
          clearTimeout(timer);
          registerWsClient(ws);
          ws.send(JSON.stringify({ type: "authenticated", ts: new Date().toISOString() }));
          return;
        }

        await handleWsMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      }
    })().catch(() => ws.close(1008, "Authentication failed"));
  });

  ws.on("close", () => {
    unregisterWsClient(ws);
    console.log("[ws] Client disconnected.");
  });
});

async function handleWsMessage(
  ws: WebSocket,
  msg: { type: string; payload?: unknown },
): Promise<void> {
  switch (msg.type) {
    case "playwright:stream_start": {
      const { broadcastManager } = await import("./playwright/screenshotStream");
      broadcastManager.startStream((screenshot) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "playwright:screenshot", payload: screenshot }));
        }
      });
      break;
    }
    case "playwright:stream_stop": {
      const { broadcastManager } = await import("./playwright/screenshotStream");
      broadcastManager.stopStream();
      break;
    }
    case "ping":
      ws.send(JSON.stringify({ type: "pong" }));
      break;
  }
}

// ── Start ──────────────────────────────────────────────────────────────────
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("server/index.ts") || process.argv[1].endsWith("server.ts"))
) {
  server.listen(PORT, HOST, () => {
    console.log("\n🧠 Microfixd Backend Server");
    console.log(`   REST: http://${HOST}:${PORT}/api`);
    console.log(`   WS:   ws://${HOST}:${PORT}/ws`);
    console.log("   Bootstrap: live; operational modules lazy-loaded on demand\n");
  });

  // Planner worker is deliberately started after the public port is already
  // available. This preserves autonomous scheduling without blocking cold-start
  // health checks or the UI shell.
  setTimeout(() => {
    void import("./planner/plannerRouter")
      .then(({ startPlannerWorker }) => {
        const stopPlanner = startPlannerWorker();
        server.once("close", stopPlanner);
      })
      .catch((error) => console.error("[planner] worker start failed", error));
  }, 15_000).unref();

  if (process.env.MICROFIXD_STARTUP_PROBES === "1") {
    setTimeout(() => {
      void import("./organs/startupProbe")
        .then(({ runStartupProbe }) => runStartupProbe())
        .catch(() => console.error("[system-probe] failed"));
    }, 20_000).unref();
  }
}
