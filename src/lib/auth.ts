/**
 * src/lib/auth.ts
 * Thin wrapper around Supabase Auth (email/password) for the optional
 * accounts layer. Reuses the same Supabase client as src/lib/supabase.ts —
 * one project, one set of credentials, both UI state and accounts.
 *
 * This is opt-in: see isAccountsModeEnabled(). Deployments that don't set
 * VITE_AUTH_MODE=accounts keep using the existing manual operator-token
 * entry in Settings (src/lib/operatorAccess.ts), completely unchanged.
 */
import { getSupabase } from "./supabase";

const SESSION_TOKEN_KEY = "microfixd_supabase_access_token";

export function isAccountsModeEnabled(): boolean {
  const mode = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_AUTH_MODE;
  return mode === "accounts";
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured for this deployment." };

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };

  if (data.session?.access_token) {
    persistToken(data.session.access_token);
    return { ok: true };
  }
  // Supabase projects with "Confirm email" enabled return a user but no
  // session until the user clicks the confirmation link.
  return { ok: true, needsEmailConfirmation: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured for this deployment." };

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  if (!data.session?.access_token) return { ok: false, error: "Sign-in succeeded but no session was returned." };

  persistToken(data.session.access_token);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (client) await client.auth.signOut();
  clearToken();
}

/** The token every API call sends — see src/lib/serverApi.ts's Authorization header. */
export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
}

function persistToken(token: string) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
}

function clearToken() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

/** Re-hydrates the session token from Supabase's own stored session on page load. */
export async function restoreSession(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  const { data } = await client.auth.getSession();
  if (data.session?.access_token) {
    persistToken(data.session.access_token);
    return true;
  }
  return false;
}
