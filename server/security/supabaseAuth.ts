/**
 * server/security/supabaseAuth.ts
 * Verifies a Supabase Auth access token (the JWT a logged-in user's browser
 * session holds) and resolves it to a role, via the `profiles` table added
 * in supabase/accounts_schema.sql.
 *
 * This sits alongside — not instead of — the existing shared-secret tokens
 * in server/security/rbac.ts (ADMIN_TOKEN/OPERATOR_TOKEN/SYSTEM_TOKEN).
 * rbacMiddleware tries a shared-secret match first (unchanged, synchronous,
 * zero Supabase calls), then falls back to verifying the bearer value as a
 * Supabase JWT. A deployment that never sets up accounts keeps working
 * exactly as before.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "./rbac";

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null; // Accounts not configured — caller should fall back.
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  return adminClient;
}

const VALID_ROLES: Role[] = ["admin", "operator", "observer", "system"];

export interface AuthenticatedUser {
  userId: string;
  email: string | null;
  role: Role;
  /**
   * The caller's tenant, resolved from profiles.tenant_id (see
   * supabase/tenant_isolation_schema.sql). Defaults to "default" when the
   * tenant isolation migration hasn't been applied yet or the column is
   * null, so this stays backward-compatible with a single-tenant setup.
   */
  tenantId: string;
}

/**
 * Verifies `token` as a Supabase Auth JWT and looks up the caller's role
 * from `profiles`. Returns null if accounts aren't configured, the token
 * doesn't verify, or no profile row exists — callers should treat null as
 * "not a Supabase account token" and fall back to anonymous/other checks,
 * not as an error.
 */
export async function verifySupabaseSession(token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const client = getAdminClient();
  if (!client) return null;

  try {
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData?.user) return null;

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role, email, tenant_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      // Valid Supabase account, but no profile row (trigger didn't run, or
      // the account predates the accounts_schema.sql migration). Default to
      // the lowest-privilege role rather than failing open.
      return null;
    }

    const role = VALID_ROLES.includes(profile.role as Role) ? (profile.role as Role) : "observer";
    if(typeof profile.tenant_id!=="string"||!profile.tenant_id.trim())return null;
    const tenantId = profile.tenant_id;
    return { userId: userData.user.id, email: profile.email ?? userData.user.email ?? null, role, tenantId };
  } catch {
    return null;
  }
}

export function accountsConfigured(): boolean {
  return getAdminClient() !== null;
}
