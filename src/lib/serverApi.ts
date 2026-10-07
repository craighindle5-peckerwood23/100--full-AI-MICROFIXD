/**
 * src/lib/serverApi.ts
 * Typed fetch wrapper for Microfixd backend REST API (port 3001).
 * Used by all React hooks that talk to the server.
 */

export class AuthenticationRequiredError extends Error {}

const BASE = "/api";
const OPERATOR_TOKEN_KEY = "microfixd_operator_token";
const SUPABASE_SESSION_TOKEN_KEY = "microfixd_supabase_access_token";

export async function api<T = unknown>(
  method:  "GET" | "POST" | "DELETE" | "PUT",
  path:    string,
  body?:   unknown,
): Promise<T> {
  // The operator supplies the server-side token in Settings. Keep it in
  // sessionStorage so it is not committed, persisted across browser sessions,
  // or injected into the production bundle. When accounts mode is enabled
  // (src/lib/auth.ts) and no manual operator token is set, fall back to the
  // signed-in user's Supabase session token — the server's RBAC layer
  // (server/security/rbac.ts) accepts either.
  const token = typeof window !== "undefined"
    ? (window.sessionStorage.getItem(OPERATOR_TOKEN_KEY) || window.sessionStorage.getItem(SUPABASE_SESSION_TOKEN_KEY))
    : null;
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body:    body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    if((resp.status===401||resp.status===403) && (err.code==='AUTH_REQUIRED'||/anonymous/i.test(err.error||'')))throw new AuthenticationRequiredError('Operator access required');
    throw new Error((err as { error?: string }).error ?? `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

// ── Playwright ──────────────────────────────────────────────────────────────
export const Playwright = {
  navigate:   (url: string)                                => api("POST", "/playwright/navigate",    { url }),
  click:      (selector: string)                           => api("POST", "/playwright/click",       { selector }),
  fill:       (selector: string, value: string)            => api("POST", "/playwright/fill",        { selector, value }),
  fillSubmit: (selector: string, value: string, sub: string) => api("POST", "/playwright/fill-submit", { selector, value, submitSelector: sub }),
  evaluate:   (js: string)                                 => api("POST", "/playwright/evaluate",    { js }),
  scrape:     (url: string, selector?: string)             => api("POST", "/playwright/scrape",      { url, selector }),
  screenshot: ()                                           => api<{ screenshot: string }>("GET",  "/playwright/screenshot"),
  state:      ()                                           => api<{ url: string; title: string; status: string }>("GET", "/playwright/state"),
  stop:       ()                                           => api("POST", "/playwright/stop",        {}),
};

// ── Sandbox ─────────────────────────────────────────────────────────────────
export const Sandbox = {
  run: (code: string, lang: string, session_id = "default", approval_id?: string) =>
    api("POST", "/sandbox/run", { code, lang, session_id, approval_id }),
  log: (limit = 50) =>
    api<{ entries: unknown[] }>("GET", `/sandbox/log?limit=${limit}`),
  clearLog: () => api("DELETE", "/sandbox/log"),
};

// ── HITL ────────────────────────────────────────────────────────────────────
export const HITL = {
  pending: () => api<{ records: HITLRecord[] }>("GET", "/hitl/pending"),
  all:     () => api<{ records: HITLRecord[] }>("GET", "/hitl/all"),
  trigger: (session_id: string, artifact: HITLRecord["artifact"], trigger?: string) =>
    api("POST", "/hitl/trigger", { session_id, artifact, trigger }),
  decide:  (hitl_id: string, decision: "approved" | "rejected", notes?: string) =>
    api("POST", "/hitl/decide", { hitl_id, decision, notes }),
};

// ── GitHub ──────────────────────────────────────────────────────────────────
export const GitHub = {
  repo:    (owner: string, repo: string) => api("GET", `/github/repo/${owner}/${repo}`),
  push:    (repo: string, branch: string, files: {path:string;content:string}[], message: string) =>
    api("POST", "/github/push", { repo, branch, files, message }),
};

// ── Health ──────────────────────────────────────────────────────────────────
export const ServerHealth = {
  check: () => api<{ status: string; services: string[] }>("GET", "/health"),
};

export interface HITLRecord {
  hitl_id:    string;
  session_id: string;
  trigger:    string;
  artifact:   { name: string; type: string; severity?: "critical" | "major" | "minor"; [k: string]: unknown };
  status:     "pending" | "approved" | "rejected";
  ts:         string;
  decided_at?: string;
  notes?:     string;
}
