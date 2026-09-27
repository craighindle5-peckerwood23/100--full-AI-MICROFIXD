/**
 * Security Organ — RBAC + identity lock + anti-drift checks
 * Actions: check_identity, validate_role, scan_output, audit_log
 */
const IDENTITY = { name: "Microfixd", level: 7, constitution: "active", version: "7.0.0" };

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin:    ["*"],
  operator: ["read", "execute", "monitor"],
  observer: ["read", "monitor"],
  system:   ["read", "execute", "monitor", "modify_self"],
};

const auditLog: { ts: string; role: string; action: string; allowed: boolean; reason?: string }[] = [];

export async function executeSecurityOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  switch (action) {
    case "check_identity":
      return { identity: IDENTITY, locked: true, drift_detected: false };
    case "validate_role": {
      const role        = String(p.role ?? "observer");
      const reqAction   = String(p.action ?? "read");
      const perms       = ROLE_PERMISSIONS[role] ?? [];
      const allowed     = perms.includes("*") || perms.includes(reqAction);
      const entry       = { ts: new Date().toISOString(), role, action: reqAction, allowed };
      auditLog.push(entry);
      if (auditLog.length > 500) auditLog.shift();
      return { allowed, role, action: reqAction };
    }
    case "scan_output": {
      const output  = String(p.output ?? "");
      const flags: string[] = [];
      if (/i am not microfixd/i.test(output))   flags.push("identity_drift");
      if (/rm -rf|drop table/i.test(output))     flags.push("destructive_command");
      if (/bypass.*constitution/i.test(output))  flags.push("constitution_bypass");
      return { clean: flags.length === 0, flags };
    }
    case "audit_log":
      return { log: auditLog.slice(-Number(p.limit ?? 50)) };
    default:
      throw new Error(`Security organ: unknown action '${action}'`);
  }
}
