/**
 * server/tools/toolRegistry.ts
 * TOOL REGISTRY — All callable tools in Microfixd.
 * Exposes tools in OpenAI/Groq function-calling format.
 * Used by toolOrchestrator to route Groq tool calls to real implementations.
 */

export interface ToolDefinition {
  name:        string;
  description: string;
  parameters: {
    type:       "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required:   string[];
  };
  organ:       string; // which organ handles this
  action:      string; // which action on that organ
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  // ── Browser / Playwright ──────────────────────────────────────────────
  {
    name: "navigate_browser",
    description: "Navigate the browser to a URL and return the page title.",
    parameters: { type: "object", properties: { url: { type: "string", description: "URL to navigate to" } }, required: ["url"] },
    organ: "playwright", action: "navigate",
  },
  {
    name: "scrape_url",
    description: "Scrape text content from a URL.",
    parameters: { type: "object", properties: { url: { type: "string", description: "URL to scrape" }, selector: { type: "string", description: "CSS selector (optional)" } }, required: ["url"] },
    organ: "playwright", action: "scrape",
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot of the current browser page.",
    parameters: { type: "object", properties: {}, required: [] },
    organ: "playwright", action: "screenshot",
  },
  {
    name: "click_element",
    description: "Click an element on the current page by CSS selector.",
    parameters: { type: "object", properties: { selector: { type: "string", description: "CSS selector" } }, required: ["selector"] },
    organ: "playwright", action: "click",
  },
  // ── Crawling ──────────────────────────────────────────────────────────
  {
    name: "crawl_website",
    description: "Crawl a website up to a given depth and return extracted text.",
    parameters: {
      type: "object",
      properties: {
        url:      { type: "string",  description: "Starting URL" },
        maxDepth: { type: "number",  description: "Max crawl depth (0=single page, 1=follow links)" },
        maxPages: { type: "number",  description: "Max pages to crawl" },
      },
      required: ["url"],
    },
    organ: "crawl_engine", action: "scrape_fast",
  },
  // ── Memory ────────────────────────────────────────────────────────────
  {
    name: "store_memory",
    description: "Store information to long-term memory.",
    parameters: { type: "object", properties: { content: { type: "string", description: "Content to store" }, tags: { type: "string", description: "Comma-separated tags" } }, required: ["content"] },
    organ: "memory", action: "store",
  },
  {
    name: "recall_memory",
    description: "Recall relevant memories by keyword search.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Search query" }, limit: { type: "number", description: "Max results" } }, required: ["query"] },
    organ: "memory", action: "recall_keyword",
  },
  // ── GitHub ────────────────────────────────────────────────────────────
  {
    name: "get_github_repo",
    description: "Get information about a GitHub repository.",
    parameters: { type: "object", properties: { repo: { type: "string", description: "owner/repo format" } }, required: ["repo"] },
    organ: "github_connector", action: "get_repo",
  },
  {
    name: "push_file_to_github",
    description: "Push a file to a GitHub repository.",
    parameters: {
      type: "object",
      properties: {
        repo:    { type: "string", description: "owner/repo" },
        branch:  { type: "string", description: "branch name" },
        path:    { type: "string", description: "file path" },
        content: { type: "string", description: "file content" },
        message: { type: "string", description: "commit message" },
      },
      required: ["repo", "branch", "path", "content", "message"],
    },
    organ: "github_connector", action: "push_file",
  },
  // ── Security ──────────────────────────────────────────────────────────
  {
    name: "scan_for_security_issues",
    description: "Scan text or code for security issues and doctrine violations.",
    parameters: { type: "object", properties: { output: { type: "string", description: "Text to scan" } }, required: ["output"] },
    organ: "security_spine", action: "scan_output",
  },
  // ── Evolution ─────────────────────────────────────────────────────────
  {
    name: "propose_system_improvement",
    description: "Generate a system improvement proposal for Microfixd.",
    parameters: { type: "object", properties: { context: { type: "string", description: "Context for the proposal" } }, required: ["context"] },
    organ: "evolution_engine", action: "propose",
  },
  // ── Sandbox ───────────────────────────────────────────────────────────
  {
    name: "run_code",
    description: "Execute code in the sandboxed environment.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code to execute" },
        lang: { type: "string", description: "Language", enum: ["typescript", "javascript", "python", "bash"] },
      },
      required: ["code", "lang"],
    },
    organ: "sandbox", action: "run",
  },
];

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find(t => t.name === name);
}

export function getToolsForGroq(): object[] {
  return TOOL_REGISTRY.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
