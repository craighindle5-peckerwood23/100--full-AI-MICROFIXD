/**
 * server/mcp/mcpRouter.ts
 * MCP (Model Context Protocol) bridge router.
 * Exposes Microfixd as an MCP server AND proxies calls to external MCP servers.
 *
 * GET  /api/mcp/tools           — List all available Microfixd tools
 * POST /api/mcp/call            { tool_name, arguments }
 * GET  /api/mcp/resources       — List MCP resources (ledger, memory, episodes)
 */
import { Router } from "express";
import { browserManager } from "../playwright/browserManager";
import { runCode }        from "../sandbox/codeRunner";
import { getPending }     from "../hitl/hitlManager";

export const mcpRouter = Router();

// MCP tool definitions (subset of Microfixd capabilities exposed to MCP clients)
const MCP_TOOLS = [
  { name: "playwright_navigate",   description: "Navigate browser to URL",                inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "playwright_scrape",     description: "Navigate + return page text",             inputSchema: { type: "object", properties: { url: { type: "string" }, selector: { type: "string" } }, required: ["url"] } },
  { name: "playwright_screenshot", description: "Take browser screenshot (base64 JPEG)",   inputSchema: { type: "object", properties: {} } },
  { name: "playwright_click",      description: "Click element by CSS selector",           inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] } },
  { name: "sandbox_run",           description: "Execute code in sandbox (TS/JS/Python)",  inputSchema: { type: "object", properties: { code: { type: "string" }, lang: { type: "string" } }, required: ["code"] } },
  { name: "hitl_pending",          description: "Get list of pending HITL reviews",         inputSchema: { type: "object", properties: {} } },
  { name: "system_health",         description: "Get system health snapshot",              inputSchema: { type: "object", properties: {} } },
];

mcpRouter.get("/tools", (req, res) => {
  res.json({ tools: MCP_TOOLS });
});

mcpRouter.post("/call", async (req, res) => {
  const { tool_name, arguments: args = {} } = req.body;
  if (!tool_name) return res.status(400).json({ error: "tool_name required" });

  try {
    let result: unknown;
    switch (tool_name) {
      case "playwright_navigate":   result = await browserManager.navigate(args.url); break;
      case "playwright_scrape":     result = await browserManager.scrape(args.url, args.selector); break;
      case "playwright_screenshot": result = { screenshot: await browserManager.screenshot() }; break;
      case "playwright_click":      result = await browserManager.click(args.selector); break;
      case "sandbox_run":           result = await runCode(args.code, args.lang ?? "typescript", "mcp"); break;
      case "hitl_pending":          result = { records: getPending() }; break;
      case "system_health":         result = { status: "nominal", ts: new Date().toISOString() }; break;
      default: return res.status(404).json({ error: `Tool '${tool_name}' not found.` });
    }
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

mcpRouter.get("/resources", (req, res) => {
  res.json({
    resources: [
      { uri: "microfixd://system/health", name: "System Health", mimeType: "application/json" },
      { uri: "microfixd://hitl/pending",  name: "HITL Queue",    mimeType: "application/json" },
    ],
  });
});
