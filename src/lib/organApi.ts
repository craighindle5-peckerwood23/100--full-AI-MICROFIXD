/**
 * src/lib/organApi.ts
 * Frontend typed API for calling any organ through the backend.
 * All 22 organs accessible via organApi.execute(id, action, payload).
 */
import { api } from "./serverApi";

export const OrganApi = {
  // List all organs
  list: () => api("GET", "/organs"),

  // Single organ
  status:  (id: string)                           => api("GET",    `/organs/${id}/status`),
  metrics: (id: string)                           => api("GET",    `/organs/${id}/metrics`),
  log:     (id: string, limit = 20)               => api("GET",    `/organs/${id}/log?limit=${limit}`),
  reset:   (id: string)                           => api("POST",   `/organs/${id}/reset`,   {}),
  isolate: (id: string)                           => api("POST",   `/organs/${id}/isolate`, {}),

  // Execute any organ action — main entry point
  execute: (id: string, action: string, payload: unknown = {}) =>
    api("POST", `/organs/${id}/execute`, { action, payload }),

  // Broadcast to multiple organs simultaneously
  broadcast: (organIds: string[], action: string, payload: unknown = {}) =>
    api("POST", "/organs/broadcast", { organ_ids: organIds, action, payload }),

  // Command center
  command: (task: string, sessionId?: string, source = "api") =>
    api("POST", "/command/run", { task, session_id: sessionId ?? crypto.randomUUID(), source }),

  feedback: (limit = 20) => api("GET", `/command/feedback?limit=${limit}`),
  snapshot: ()           => api("GET", "/organs/snapshot"),
};

// ── Organ shorthand calls ─────────────────────────────────────────────────
export const Brain = {
  complete:   (prompt: string, model?: string)    => OrganApi.execute("brain", "complete",      { prompt, model }),
  classify:   (task: string)                      => OrganApi.execute("brain", "classify",      { task }),
  healthCheck: ()                                 => OrganApi.execute("brain", "health_check",  {}),
};

export const Memory = {
  store:   (content: string, tags?: string[], organ?: string) => OrganApi.execute("memory", "store",          { content, tags, organ }),
  recall:  (query: string,   limit = 5)                       => OrganApi.execute("memory", "recall_keyword", { query, keywords: query.split(" "), limit }),
  stats:   ()                                                  => OrganApi.execute("memory", "stats",         {}),
  recent:  (limit = 10)                                        => OrganApi.execute("memory", "recent",        { limit }),
};

export const PlaywrightOrgan = {
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
