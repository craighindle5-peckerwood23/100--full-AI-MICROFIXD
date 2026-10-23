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
  {name:'obd_connection_setup',description:'Get the actual supported adapter transports, local connector download endpoint and guided setup commands. Use when the adapter model is unknown or no vehicle session exists. Does not claim hardware is attached or start a local process from the cloud.',parameters:{type:'object',properties:{},required:[]},organ:'vector_automotive',action:'obd_setup'},
  {name:'list_obd_sessions',description:'List local vehicle adapter sessions and their freshness. Adapters must run the local J2534/ELM327 bridge; cloud access alone cannot discover plugged-in hardware.',parameters:{type:'object',properties:{},required:[]},organ:'vector_automotive',action:'obd_sessions'},
  {name:'read_obd_status',description:'Understand a connected vehicle from a specific bridge session: actual responding ECUs, VIN conflicts, DTCs, MIL, RPM, temperatures, voltage and freshness. Stale or absent data is unknown. This is generic emissions OBD, not all-module OEM coverage.',parameters:{type:'object',properties:{obd_session_id:{type:'string',description:'Session UUID returned by list_obd_sessions'}},required:['obd_session_id']},organ:'vector_automotive',action:'obd_status'},
  {name:'list_automotive_cases',description:'Read recent Vector Automotive diagnostic cases in the authenticated tenant. Evidence statuses and technician-entered verification are not independent proof of repair.',parameters:{type:'object',properties:{},required:[]},organ:'vector_automotive',action:'list'},
  {name:'read_automotive_case',description:'Read a tenant-scoped automotive case, source evidence, observations and repair verification. Never invent a repair or claim hardware testing.',parameters:{type:'object',properties:{case_id:{type:'string',description:'Diagnostic case UUID'}},required:['case_id']},organ:'vector_automotive',action:'read'},
  {name:'invoke_system_organ',description:'Invoke a concrete native organ action under the mission authorization policy. Use list_system_capabilities to discover IDs. Browser, crawl, GitHub, and sandbox operations require their dedicated governed tools. Unsupported organs fail explicitly.',parameters:{type:'object',properties:{organ_id:{type:'string',description:'Registered native organ ID'},action:{type:'string',description:'Supported organ action'},payload_json:{type:'string',description:'JSON object containing action arguments; tenant and session identity are set by the server'}},required:['organ_id','action','payload_json']},organ:'system_catalog',action:'invoke'},
  {name:'list_system_capabilities',description:'List every registered organ, concrete executor availability, tool schema, and execution endpoint. Descriptive organs are not implemented task capabilities.',parameters:{type:'object',properties:{},required:[]},organ:'system_catalog',action:'list'},
  {name:'probe_system_organ',description:'Run the real read-only routing probe for any registered organ. This verifies routing, not arbitrary task execution.',parameters:{type:'object',properties:{organ_id:{type:'string',description:'Exact registered organ ID from list_system_capabilities'}},required:['organ_id']},organ:'system_catalog',action:'probe'},
  {name:"read_public_page",description:"Read a public web page as text through Jina Reader (third party). Never use for private, signed-in or credential-bearing URLs; use Playwright for authenticated pages.",parameters:{type:"object",properties:{url:{type:"string",description:"Public HTTP(S) page URL"}},required:["url"]},organ:"crawl_engine",action:"read_public_page"},
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
    parameters: { type: "object", properties: { url: {type:"string",description:"HTTPS page URL to capture"} }, required: ["url"] },
    organ: "playwright", action: "screenshot",
  },
  {
    name: "click_element",
    description: "Click an element on the current page by CSS selector.",
    parameters: { type: "object", properties: { url: {type:"string",description:"HTTPS page URL containing the element"}, selector: { type: "string", description: "CSS selector" } }, required: ["url", "selector"] },
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
    organ: "crawl_engine", action: "crawl",
  },
  // ── Memory ────────────────────────────────────────────────────────────
  {
    name: 'remember_knowledge',
    description: 'Persist a fact, preference, goal, constraint or project state in tenant-scoped structured memory. The newest value for the same key supersedes earlier values while preserving history. Stored assertions are not independently verified facts. Optional subject/predicate/object links related knowledge.',
    parameters: {type:'object',properties:{key:{type:'string',description:'Stable claim key, e.g. vehicle-335i.current-dtc'},content:{type:'string',description:'Complete assertion or state to retain'},kind:{type:'string',description:'Memory category',enum:['fact','preference','goal','constraint','project_state']},scope:{type:'string',description:'tenant persists across missions; session stays within this mission',enum:['tenant','session']},subject:{type:'string',description:'Relationship subject; provide all three relationship fields together'},predicate:{type:'string',description:'Relationship predicate'},object:{type:'string',description:'Relationship object'},confidence:{type:'number',description:'Uncalibrated confidence from 0 to 1; does not certify truth'},tags:{type:'string',description:'Comma-separated search tags'}},required:['key','content']},
    organ:'memory',action:'remember_knowledge',
  },
  {
    name:'recall_knowledge',description:'Recall ranked structured memory and one-hop related entities within this tenant and mission. Returns current assertions, confidence and superseded record IDs; original history is retained.',
    parameters:{type:'object',properties:{query:{type:'string',description:'Search terms or entity name'},limit:{type:'number',description:'Maximum results, up to 30'}},required:['query']},organ:'memory',action:'recall_knowledge',
  },
  {
    name:'recall_procedures',description:'Find historical tool sequences from completed, artifact-backed missions in this tenant. These are planning references, not executable tools or standing authorization. Re-plan with current arguments and permissions.',
    parameters:{type:'object',properties:{query:{type:'string',description:'Task or procedure to look up'},limit:{type:'number',description:'Maximum results, up to 10'}},required:['query']},organ:'memory',action:'recall_procedures',
  },
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
  // ── World Thinking & Counterfactual Simulation ──────────────────────
  {
    name: "simulate_world_thinking",
    description: "Perform counterfactual tree simulation, hallucination risk analysis, and future state projection before critical executions.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task or hypothesis to simulate" },
      },
      required: ["task"],
    },
    organ: "world_thinking_engine", action: "simulate",
  },
  {
    name: "query_epistemic_uncertainty",
    description: "Measure epistemic uncertainty score, entropy, and safety margins for a target operation.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "The action to evaluate for epistemic uncertainty" },
      },
      required: ["task"],
    },
    organ: "world_thinking_engine", action: "estimate_uncertainty",
  },
  // ── Orchestration Oversight & Invariance ──────────────────────────────
  {
    name: "verify_orchestration_oversight",
    description: "Audit agent delegation hierarchy, check max call stack depth (limit: 3), prevent circular loops, and query system invariants.",
    parameters: {
      type: "object",
      properties: {
        agent: { type: "string", description: "Calling agent or spawner identifier" },
        action: { type: "string", description: "Action or task being delegated" },
        depth: { type: "number", description: "Current delegation depth" },
      },
      required: ["agent", "action"],
    },
    organ: "orchestration_oversight", action: "oversight_status",
  },
  {
    name: "trigger_emergency_kill_switch",
    description: "Engage the local orchestration oversight kill flag and clear its spawn registry. Does not terminate independent processes or durable missions.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Operator or algorithmic reason for triggering emergency halt" },
      },
      required: ["reason"],
    },
    organ: "orchestration_oversight", action: "emergency_kill",
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
