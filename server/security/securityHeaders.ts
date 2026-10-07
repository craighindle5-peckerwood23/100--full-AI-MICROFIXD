/**
 * server/security/securityHeaders.ts
 * Baseline HTTP security headers — the kind of thing a security review or
 * enterprise customer's vendor questionnaire checks for first, and this
 * deployment had none of (no helmet, no manual equivalent). Written by hand
 * rather than adding the `helmet` package, since this is a small, stable
 * set of headers and avoids a new dependency for it.
 *
 * This does NOT replace a real WAF/CDN-level DDoS protection (Cloudflare,
 * AWS Shield, etc.) — see docs/enterprise-security-assessment.md for what
 * is and isn't covered by this file.
 */
import { Request, Response, NextFunction } from "express";

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Force HTTPS on repeat visits (only meaningful once actually served over
  // HTTPS — Render terminates TLS in front of this app).
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  // Stop the browser from guessing content types away from what's declared.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Block this app from being embedded in another site's <iframe> (clickjacking).
  res.setHeader("X-Frame-Options", "DENY");
  // Legacy header some scanners still check for; modern browsers use CSP instead.
  res.setHeader("X-XSS-Protection", "0");
  // Don't leak the full referring URL (which can contain tokens in query
  // strings) to third-party destinations.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Disable browser features this app never needs, reducing attack surface
  // if a dependency is ever compromised via a supply-chain issue.
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=()");
  // A pragmatic default CSP: same-origin for everything, but allows inline
  // styles/scripts (the built Vite bundle currently needs 'unsafe-inline'
  // for some injected styles) and websockets back to this origin. Tighten
  // this further (remove 'unsafe-inline', add a nonce) once the frontend
  // build is audited for inline script/style usage — flagged in
  // docs/enterprise-security-assessment.md rather than silently done here,
  // since an overly strict CSP shipped without testing can break the UI.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: https:; font-src 'self' data:;"
  );
  next();
}
