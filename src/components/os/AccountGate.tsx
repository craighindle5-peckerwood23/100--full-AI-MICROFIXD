/**
 * src/components/os/AccountGate.tsx
 * Minimal email/password sign-in & sign-up screen for the optional
 * accounts layer (see src/lib/auth.ts, server/security/supabaseAuth.ts).
 *
 * Only mounted when VITE_AUTH_MODE=accounts (see App.tsx) — deployments
 * that don't set that env var never render this and keep the existing
 * manual-operator-token flow in Settings exactly as before.
 */
import React, { useEffect, useState } from "react";
import { signIn, signUp, restoreSession, getSessionToken } from "../../lib/auth";
import { useBrand } from "../../branding/BrandProvider";

interface AccountGateProps {
  children: React.ReactNode;
}

export default function AccountGate({ children }: AccountGateProps) {
  const brand = useBrand();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (getSessionToken()) {
        setAuthed(true);
        setChecking(false);
        return;
      }
      const restored = await restoreSession();
      setAuthed(restored);
      setChecking(false);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    if (result.needsEmailConfirmation) {
      setMessage("Check your email to confirm your account, then sign in.");
      setMode("signin");
      return;
    }
    setAuthed(true);
  }

  if (checking) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black text-cyan-400 text-xs tracking-widest">
        CHECKING SESSION…
      </div>
    );
  }

  if (authed) return <>{children}</>;

  return (
    <div className="w-full h-screen flex items-center justify-center bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#0d1117] border border-[#21262d] rounded-lg p-6 space-y-4"
      >
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-white tracking-wide">{brand.productName}</h1>
          <p className="text-xs text-zinc-500">{brand.tagline}</p>
        </div>

        <div className="flex rounded overflow-hidden border border-[#21262d] text-xs">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-1.5 ${mode === "signin" ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-500"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-1.5 ${mode === "signup" ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-500"}`}
          >
            Create account
          </button>
        </div>

        <div className="space-y-2">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#161b22] border border-[#21262d] rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#161b22] border border-[#21262d] rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
          />
        </div>

        {message && <p className="text-xs text-amber-400">{message}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <p className="text-[10px] text-zinc-600 text-center">
          New accounts start with read-only access until an administrator
          grants more. Need help? {brand.supportEmail}
        </p>
      </form>
    </div>
  );
}
