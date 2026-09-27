/**
 * server/security/rbac.ts
 * ROLE-BASED ACCESS CONTROL
 * Express middleware + role checker for all API routes.
 *
 * Roles: admin > operator > observer > system > anonymous
 * Token: Bearer in Authorization header (or X-Microfixd-Role for dev)
 */
import { Request, Response, NextFunction } from "express";
import { broadcast } from "../index";

export type Role = "admin" | "operator" | "observer" | "system" | "anonymous";

const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  admin:     new Set(["*"]),
  operator:  new Set(["read", "execute", "monitor", "crawl", "voice"]),
  observer:  new Set(["read", "monitor"]),
  system:    new Set(["read", "execute", "monitor", "self_modify"]),
  anonymous: new Set(["read"]),
};

const ROUTE_PERMISSIONS: Record<string, string> = {
  "/api/organs":          "execute",
  "/api/command":         "execute",
  "/api/crawl":           "crawl",
  "/api/sandbox":         "execute",
  "/api/github":          "execute",
  "/api/hitl":            "monitor",
  "/api/tools":           "execute",
  "/api/crossai":         "execute",
  "/api/security":        "monitor",
  "/api/evolution":       "execute",
  "/api/execution":       "monitor",
  "/api/skin":            "read",
};

const auditLog: { ts: string; role: Role; route: string; allowed: boolean; ip: string }[] = [];

function getRoleFromRequest(req: Request): Role {
  // Dev: X-Microfixd-Role header (remove in production)
  const devRole = req.headers["x-microfixd-role"] as Role;
  if (devRole && devRole in ROLE_PERMISSIONS) return devRole;

  // Auth: Bearer token lookup (stub — replace with JWT in production)
  const auth  = req.headers["authorization"] ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (token === process.env.ADMIN_TOKEN)    return "admin";
  if (token === process.env.OPERATOR_TOKEN) return "operator";
  if (token === process.env.SYSTEM_TOKEN)   return "system";

  return "anonymous";
}

export function rbacMiddleware(req: Request, res: Response, next: NextFunction): void {
  const role       = getRoleFromRequest(req);
  const routeBase  = Object.keys(ROUTE_PERMISSIONS).find(r => req.path.startsWith(r)) ?? req.path;
  const required   = ROUTE_PERMISSIONS[routeBase] ?? "read";
  const perms      = ROLE_PERMISSIONS[role];
  const allowed    = perms.has("*") || perms.has(required);

  const entry = { ts: new Date().toISOString(), role, route: req.path, allowed, ip: req.ip ?? "" };
  auditLog.push(entry);
  if (auditLog.length > 1000) auditLog.shift();

  if (!allowed) {
    broadcast("security:rbac_denied", entry);
    res.status(403).json({ error: `Forbidden: role '${role}' cannot '${required}'` });
    return;
  }

  // Stamp role onto request for downstream use
  (req as Request & { microfixdRole: Role }).microfixdRole = role;
  next();
}

export function getRbacAuditLog(limit = 100) { return auditLog.slice(-limit); }
export function getRolePermissions()          { return ROLE_PERMISSIONS; }
