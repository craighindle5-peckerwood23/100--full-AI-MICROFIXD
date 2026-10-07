/**
 * server/security/rateLimiter.ts
 * Minimal in-memory, per-IP sliding-window rate limiter. Hand-written
 * (no `express-rate-limit` dependency) to avoid adding a package for
 * something this small — swap it for a real distributed limiter (backed by
 * Redis/Upstash) before running multiple server instances behind a load
 * balancer, since this one's counters are per-process and won't be shared
 * across replicas. See docs/enterprise-security-assessment.md.
 *
 * Applied to the authenticated API surface in server/index.ts, after the
 * RBAC gate (so the limit key can use the resolved role, not just raw IP —
 * an anonymous/unauthenticated caller is limited harder than an
 * authenticated operator).
 */
import { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000; // 1 minute
const LIMITS: Record<string, number> = {
  anonymous: 20,
  observer: 120,
  operator: 300,
  system: 600,
  admin: 1000,
};

const buckets = new Map<string, Bucket>();

// Prevent unbounded memory growth from a flood of distinct IPs: sweep stale
// buckets periodically rather than on every request.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS * 2) buckets.delete(key);
  }
}, WINDOW_MS).unref();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const role = (req as Request & { microfixdRole?: string }).microfixdRole || "anonymous";
  const key = `${role}:${req.ip ?? "unknown"}`;
  const limit = LIMITS[role] ?? LIMITS.anonymous;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));

  if (bucket.count > limit) {
    res.setHeader("Retry-After", String(Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000)));
    res.status(429).json({ code: "RATE_LIMITED", error: "Too many requests — slow down and try again shortly." });
    return;
  }

  next();
}
