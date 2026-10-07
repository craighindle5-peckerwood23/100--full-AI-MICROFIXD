/**
 * server/security/auditPersistence.ts
 * Durable copy of security-relevant RBAC denials.
 *
 * The in-memory audit log in server/security/rbac.ts (`getRbacAuditLog`) is
 * capped at 1000 entries and is lost on every restart/redeploy — fine for a
 * live "what's happening right now" view, not acceptable as the only record
 * for an access-denial trail an enterprise customer or auditor would want
 * to review after the fact. This writes each denial into the existing
 * `system_logs` table (already part of supabase/schema.sql) so it survives
 * restarts and can be queried later.
 *
 * Deliberately best-effort: a failure here (Supabase not configured, a
 * transient network error) must never block or slow down the request that
 * triggered it. Call sites always do `persistAuditEntry(...).catch(() => {})`.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export interface AuditEntry {
  ts: string;
  role: string;
  route: string;
  allowed: boolean;
  ip: string;
  tenant_id: string;
}

export async function persistAuditEntry(entry: AuditEntry): Promise<void> {
  const db = getClient();
  if (!db) return; // Supabase not configured — in-memory log is all this deployment has.
  await db.from("system_logs").insert({
    source: "rbac_audit",
    level: "warn",
    status: "denied",
    message: `Forbidden: role '${entry.role}' on ${entry.route}`,
    meta: entry,
  });
}
