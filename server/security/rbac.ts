/**
 * server/security/rbac.ts
 * ROLE-BASED ACCESS CONTROL
 * Express middleware + role checker for all API routes.
 *
 * Roles: admin > operator > observer > system > anonymous
 * Token: Bearer in Authorization header; caller-supplied role headers are ignored
 */
import { Request, Response, NextFunction } from "express";
import { broadcast } from "../events";
import { verifySupabaseSession } from "./supabaseAuth";
import { persistAuditEntry } from "./auditPersistence";

export type Role = "admin" | "operator" | "observer" | "system" | "anonymous";

const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  admin:     new Set(["*"]),
  operator:  new Set(["read", "execute", "monitor", "crawl", "voice"]),
  observer:  new Set(["read", "monitor"]),
  system:    new Set(["read", "execute", "monitor", "self_modify"]),
  anonymous: new Set(["read"]),
};

const ROUTE_PERMISSIONS: Record<string, string> = {
  "/api/agents":          "execute",
  "/api/playwright":      "execute",
  "/api/organs":          "execute",
  "/api/command":         "execute",
  "/api/crawl":           "crawl",
  "/api/sandbox":         "execute",
  "/api/github":          "execute",
  "/api/hitl":            "monitor",
  "/api/mcp":             "execute",
  "/api/classification/resolve": "execute",
  "/api/tools":           "execute",
  "/api/crossai":         "execute",
  "/api/security":        "monitor",
  "/api/evolution":       "execute",
  "/api/execution":       "monitor",
  "/api/skin":            "read",
};

const auditLog: { ts: string; role: Role; route: string; allowed: boolean; ip: string }[] = [];

export function roleForToken(token: string): Role {
  const admin=process.env.ADMIN_TOKEN?.trim(),operator=process.env.OPERATOR_TOKEN?.trim(),system=process.env.SYSTEM_TOKEN?.trim();
  if(admin && token===admin)return "admin";
  if(operator && token===operator)return "operator";
  if(system && token===system)return "system";
  return "anonymous";
}
/**
 * Resolves a request's role, trying the shared-secret tokens first (fast,
 * synchronous, no network call — unchanged behavior) and falling back to a
 * Supabase Auth session token (see server/security/supabaseAuth.ts) only
 * when the shared-secret check doesn't match. A deployment that hasn't set
 * up Supabase accounts never takes the async branch's failure path: a
 * non-matching token simply resolves to "anonymous" either way.
 */
type ResolvedRole = { role: Role; userId?: string; email?: string | null; tenantId: string };
function resolveRoleFromRequest(req: Request): ResolvedRole | Promise<ResolvedRole> {
  const auth = req.headers.authorization ?? "";
  const token = /^Bearer /i.test(auth) ? auth.slice(7).trim() : "";
  // Preserve the standalone adapter's scoped credential path.
  if (!token && (req.path === "/api/autonomy" || req.path.startsWith("/api/autonomy/"))) {
    const key = req.header("x-microfixd-admin-key")?.trim();
    if (key && roleForToken(key) === "admin") return { role: "admin", tenantId: "default" };
  }
  // "default" matches the tenant every pre-existing row is backfilled into
  // by supabase/tenant_isolation_schema.sql — see docs/tenant-isolation-guide.md.
  // Shared-secret tokens (ADMIN_TOKEN/OPERATOR_TOKEN/SYSTEM_TOKEN) always
  // resolve to "default": they are operator/ops credentials, not scoped to
  // a specific customer, so they cannot by themselves grant access to one
  // tenant's data over another's. Real per-customer isolation requires
  // customers to use real accounts (Supabase Auth), not a shared token.
  if (!token) return { role: "anonymous", tenantId: "default" };

  const sharedSecretRole = roleForToken(token);
  if (sharedSecretRole !== "anonymous") return { role: sharedSecretRole, tenantId: "default" };

  return verifySupabaseSession(token).then(session => session
    ? { role: session.role, userId: session.userId, email: session.email, tenantId: session.tenantId }
    : { role: "anonymous", tenantId: "default" });
}

export function rbacMiddleware(req: Request, res: Response, next: NextFunction): void {
  const result = resolveRoleFromRequest(req);
  if (result instanceof Promise) {
    void result.then(resolved => enforceRole(req, res, next, resolved)).catch(next);
    return;
  }
  enforceRole(req, res, next, result);
}

function enforceRole(req: Request, res: Response, next: NextFunction, resolved: ResolvedRole): void {
  const role       = resolved.role;
  const routeBase  = Object.keys(ROUTE_PERMISSIONS).find(r => req.path.startsWith(r)) ?? req.path;
  const required = req.path.startsWith("/api/hitl/decide") && req.method !== "GET"
    ? "approve" : ROUTE_PERMISSIONS[routeBase] ?? (req.method === "GET" ? "read" : "execute");
  const perms      = ROLE_PERMISSIONS[role];
  const allowed = role !== "anonymous" && (perms.has("*") || perms.has(required));

  const entry = { ts: new Date().toISOString(), role, route: req.path, allowed, ip: req.ip ?? "" };
  auditLog.push(entry);
  if (auditLog.length > 1000) auditLog.shift();

  if (!allowed) {
    broadcast("security:rbac_denied", entry);
    persistAuditEntry({ ...entry, tenant_id: resolved.tenantId }).catch(() => {});
    res.status(403).json({ code: role === "anonymous" ? "AUTH_REQUIRED" : "PERMISSION_DENIED", error: `Forbidden: role '${role}' cannot '${required}'` });
    return;
  }

  // Stamp role + account identity (when known) onto request for downstream use
  (req as Request & { microfixdRole: Role; microfixdUserId?: string; microfixdEmail?: string | null; microfixdTenantId: string }).microfixdRole = role;
  (req as Request & { microfixdUserId?: string }).microfixdUserId = resolved.userId;
  (req as Request & { microfixdEmail?: string | null }).microfixdEmail = resolved.email;
  (req as Request & { microfixdTenantId: string }).microfixdTenantId = resolved.tenantId;
  next();
}

export function getRbacAuditLog(limit = 100) { return auditLog.slice(-limit); }
export function getRolePermissions()          { return ROLE_PERMISSIONS; }
