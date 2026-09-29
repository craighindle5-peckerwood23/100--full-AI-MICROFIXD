/**
 * mcp-server.ts
 * Standalone Microfixd MCP manifest server.
 * Serves mcp-manifest.json plus health/readiness endpoints.
 *
 * Start: npx tsx mcp-server.ts
 */
import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import path from "path";

const app = express();

app.use(cors({
  origin: (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  credentials: true,
}));
app.use(express.json());

function loadManifest(): unknown {
  return JSON.parse(
    readFileSync(path.resolve(process.cwd(), process.env.MCP_MANIFEST_PATH ?? "mcp-manifest.json"), "utf-8")
  );
}

app.get("/manifest", (_, res) => {
  try {
    res.json(loadManifest());
  } catch (err) {
    res.status(500).json({ error: "Failed to read MCP manifest: " + String(err) });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

app.get("/readyz", (_, res) =>
  res.json({
    ready: Boolean(process.env.ADMIN_TOKEN && process.env.SUPABASE_URL),
    ts: new Date().toISOString(),
  })
);

const PORT = Number(process.env.PORT) || 3002;
app.listen(PORT, () => {
  console.log("Microfixd MCP manifest server on :" + PORT);
});
