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
function getRoleFromRequest(req: Request): Role {
  const auth = req.headers.authorization ?? "";
  return /^Bearer /i.test(auth) ? roleForToken(auth.slice(7).trim()) : "anonymous";
}

export function rbacMiddleware(req: Request, res: Response, next: NextFunction): void {
  const role       = getRoleFromRequest(req);
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
    res.status(403).json({ code: role === "anonymous" ? "AUTH_REQUIRED" : "PERMISSION_DENIED", error: `Forbidden: role '${role}' cannot '${required}'` });
    return;
  }

  // Stamp role onto request for downstream use
  (req as Request & { microfixdRole: Role }).microfixdRole = role;
  next();
}

export function getRbacAuditLog(limit = 100) { return auditLog.slice(-limit); }
export function getRolePermissions()          { return ROLE_PERMISSIONS; }
