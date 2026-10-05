import {getCommandPreferences} from './commandPreferences';
import { commandSession, runSystemCommand } from './commandApi';
/**
 * src/lib/organApi.ts
 * Frontend typed API for calling any organ through the backend.
 * All 22 organs accessible via organApi.execute(id, action, payload).
 */
import { api } from "./serverApi";

export const OrganApi = {
  // List all organs with snapshot
  list: () => api("GET", "/organs"),

  // Direct array of all 235+ registered organs
  getAll: () => api("GET", "/organs/all"),

  // Load and register all 235 organs live
  loadAll: () => api("POST", "/organs/load-all", {}),

  // Single organ record & status
  get:     (id: string)                           => api("GET",    `/organs/${id}`),
  status:  (id: string)                           => api("GET",    `/organs/${id}/status`),
  metrics: (id: string)                           => api("GET",    `/organs/${id}/metrics`),
  log:     (id: string, limit = 20)               => api("GET",    `/organs/${id}/log?limit=${limit}`),
  reset:   (id: string)                           => api("POST",   `/organs/${id}/reset`,   {}),
  isolate: (id: string)                           => api("POST",   `/organs/${id}/isolate`, {}),

  // Execute any organ action — main entry point
  execute: (id: string, action: string = "execute", payload: unknown = {}) =>
    api("POST", `/organs/${id}/execute`, { action, payload }),

  // Call any organ directly via /:id
  call: (id: string, action: string = "execute", payload: unknown = {}) =>
    api("POST", `/organs/${id}`, { action, payload }),

  // Parallel batch execution across multiple organs
  batch: (calls: Array<{ id: string; action?: string; payload?: unknown }>) =>
    api("POST", "/organs/batch", { calls }),

  // Broadcast to multiple organs simultaneously
  broadcast: (organIds: string[], action: string, payload: unknown = {}) =>
    api("POST", "/organs/broadcast", { organ_ids: organIds, action, payload }),

  // Command center
  command: (task: string, sessionId?: string, source = "api") =>
    runSystemCommand(task,undefined,sessionId ?? commandSession(),source),

  feedback: (limit = 20) => api("GET", `/command/feedback?limit=${limit}`),
  snapshot: ()           => api("GET", "/organs/snapshot"),

  // 200% Capacity Full System Load Test
  loadTest: (concurrencyFactor = 2.0) =>
    api("POST", "/command/load-test", { concurrencyFactor }),
};

// ── Organ shorthand calls ─────────────────────────────────────────────────
export const Brain = {
  complete:   (prompt: string, model?: string)    => OrganApi.execute("brain", "complete",      { prompt, model }),
  classify:   (task: string)                      => OrganApi.execute("brain", "classify",      { task }),
  healthCheck: ()                                 => OrganApi.execute("brain", "health_check",  {}),
};

export const Memory = {
  store:   (content: string, tags?: string[], organ?: string) => OrganApi.execute("memory", "store",          { content, tags, organ }),
  recall:  (query: string,   limit = 30, session_id = commandSession())                       => OrganApi.execute("memory", "recall_keyword", { query, keywords: query.split(" "), limit, session_id }),
  stats:   ()                                                  => OrganApi.execute("memory", "stats",         {}),
  context: (limit = 30, max_chars = 60000, query?: string, session_id = commandSession()) => OrganApi.execute("memory", "context", {limit,max_chars,query,session_id}),
  recent:  (limit = 30, session_id = commandSession())                                        => OrganApi.execute("memory", "recent",        { limit, session_id }),
};

export const PlaywrightOrgan = {
  fill: (selector:string,value:string) => api("POST","/playwright/fill",{selector,value}),
  login: (input:{url:string;username:string;password:string;usernameSelector:string;passwordSelector:string;submitSelector:string;successSelector?:string}) => api("POST","/playwright/login",input),
  loginSnippet: (input:{url:string;usernameSelector:string;passwordSelector:string;submitSelector:string}) => api("POST","/playwright/login-snippet",input),
  navigate:   (url: string)                         => OrganApi.execute("playwright", "navigate",   { url }),
  scrape:     (url: string, selector?: string)      => OrganApi.execute("playwright", "scrape",     { url, selector }),
  screenshot: ()                                    => OrganApi.execute("playwright", "screenshot", {}),
  click:      (selector: string)                    => OrganApi.execute("playwright", "click",      { selector }),
  evaluate:   (js: string)                          => OrganApi.execute("playwright", "evaluate",   { js }),
  state:      ()                                    => OrganApi.execute("playwright", "state",      {}),
};

export const GitHubOrgan = {
  getRepo:       (repo: string)                                                   => OrganApi.execute("github_connector", "get_repo",       { repo }),
  listBranches:  (repo: string)                                                   => OrganApi.execute("github_connector", "list_branches",  { repo }),
  pushFile:      (repo: string, branch: string, path: string, content: string, message: string, sha?: string) =>
    OrganApi.execute("github_connector", "push_file", { repo, branch, path, content, message, sha }),
  createBranch:  (repo: string, branch: string, sha: string)                      => OrganApi.execute("github_connector", "create_branch",  { repo, branch, sha }),
};

export const VoiceOrgan = {
  synthesize:  (text: string, voiceId?: string)  => OrganApi.execute("voice", "synthesize",   { text, voice_id: voiceId }),
  listVoices:  ()                                => OrganApi.execute("voice", "list_voices",  {}),
  status:      ()                                => OrganApi.execute("voice", "status",        {}),
};

export const Security = {
  checkIdentity: ()                           => OrganApi.execute("security_spine", "check_identity", {}),
  validateRole:  (role: string, action: string) => OrganApi.execute("security_spine", "validate_role", { role, action }),
  scanOutput:    (output: string)             => OrganApi.execute("security_spine", "scan_output",     { output }),
  auditLog:      (limit = 50)                 => OrganApi.execute("security_spine", "audit_log",       { limit }),
};

export const Evolution = {
  propose:        (context: unknown)  => OrganApi.execute("evolution_engine", "propose",        context as object),
  list:           ()                  => OrganApi.execute("evolution_engine", "list",           {}),
  applyProposal:  (id: string)        => OrganApi.execute("evolution_engine", "apply_proposal", { id }),
  rejectProposal: (id: string)        => OrganApi.execute("evolution_engine", "reject_proposal",{ id }),
};

export const Reflex = {
  match:       (text: string) => OrganApi.execute("reflex", "match",        { text }),
  checkSafety: (text: string) => OrganApi.execute("reflex", "check_safety", { text }),
  parseIntent: (text: string) => OrganApi.execute("reflex", "parse_intent", { text }),
};

export const Scheduler = {
  listJobs:    ()              => OrganApi.execute("scheduler", "list_jobs",    {}),
  enableJob:   (job_id: string) => OrganApi.execute("scheduler", "enable_job",  { job_id }),
  disableJob:  (job_id: string) => OrganApi.execute("scheduler", "disable_job", { job_id }),
  triggerJob:  (job_id: string) => OrganApi.execute("scheduler", "trigger_job", { job_id }),
  status:      ()              => OrganApi.execute("scheduler", "status",       {}),
};

export const Governance = {
  evaluate: (action: string, targetOrgan: string) =>
    OrganApi.execute("governance", action, { targetOrgan }),
  checkConstitution: () =>
    OrganApi.execute("constitution", "verify", {}),
  status: () =>
    OrganApi.execute("governance", "status", {}),
};

export const TelemetryOrgan = {
  push: (metric: string, value: number) =>
    OrganApi.execute("telemetry_grid", "push", { metric, value }),
  snapshot: () =>
    OrganApi.execute("telemetry_sensor", "status", {}),
};

export const AgentOrgan = (agentId: string) => ({
  execute: (action: string, payload: unknown = {}) =>
    OrganApi.execute(`agent_${agentId.replace(/^agent_/, "")}`, action, payload),
  status: () =>
    OrganApi.status(`agent_${agentId.replace(/^agent_/, "")}`),
});

export const AnyOrgan = (organId: string) => ({
  call: (action: string = "execute", payload: unknown = {}) =>
    OrganApi.execute(organId, action, payload),
  status: () =>
    OrganApi.status(organId),
  metrics: () =>
    OrganApi.metrics(organId),
  log: (limit = 20) =>
    OrganApi.log(organId, limit),
});
