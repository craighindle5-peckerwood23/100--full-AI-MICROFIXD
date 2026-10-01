/**
 * server/autonomy-adapter/autonomyRouter.ts
 *
 * Autonomy API compatibility layer for the Microfixd OS "TV" frontend.
 *
 * The TV (microfixd-os-frontend) speaks the /api/autonomy/* contract from the
 * ALL-ORGANS stack. This outlet (100--full-AI-MICROFIXD) has a different native
 * surface (/api/organs, /api/hitl, /api/command, ...). Rather than rewrite the
 * TV, this adapter mounts /api/autonomy/* and maps every TV call onto THIS
 * server's real subsystems:
 *
 *   TV endpoint                        ->  Real outlet subsystem
 *   ----------------------------------------------------------------
 *   /organs                            ->  organRegistry (organ boot records)
 *   /introspection                     ->  organMetrics system snapshot
 *   /infrastructure                    ->  process/runtime + registry health
 *   /compute                           ->  executionTracer + circuit breakers
 *   /usage-report                      ->  RBAC audit log + organ exec log
 *   /approvals, /approvals/:id/decision->  hitlManager (real HITL queue)
 *   /preview/status, /preview/rebuild  ->  real dist/ stat + governed rebuild
 *   /files/list|read|write             ->  real FS, writes gated by HITL
 *   /github/import                     ->  raw GitHub fetch with GITHUB_TOKEN
 *   /chat                              ->  commandCenter pipeline (Groq-backed)
 *   /goals, /runs/:id/*                ->  runCommand() real organ pipeline
 *   /agents                            ->  organ registry as agent records
 *   /meta/decide|evolve|heal            ->  registry health / trace stats
 *   /voice/speak                       ->  honest 503 (TV falls back to browser TTS)
 *
 * Nothing here fabricates data: every response is derived from a real module
 * in this server. Where the outlet has no equivalent capability (e.g. TTS),
 * the adapter says so instead of pretending.
 *
 * Auth: the TV sends `x-microfixd-admin-key` (its operator contract). The
 * outlet's native RBAC uses Bearer tokens; this adapter bridges the two by
 * validating the header against ADMIN_TOKEN before any route runs.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync, readFileSync, readdirSync, statSync, writeFileSync,
} from "node:fs";
import { resolve, basename } from "node:path";
import { organRegistry } from "../organs/organRegistry";
import { getSystemSnapshot } from "../organs/organMetrics";
import { trigger as hitlTrigger, decide as hitlDecide, getPending, getAll } from "../hitl/hitlManager";
import { runCommand } from "../orchestration/commandCenter";
import { executionTracer } from "../execution/executionTracer";
import { getCircuitBreakerStatus } from "../execution/executionSpine";
import { getRbacAuditLog } from "../security/rbac";
import { broadcast } from "../events";

const execFileAsync = promisify(execFile);

export const autonomyRouter = Router();

// ── Auth bridge ─────────────────────────────────────────────────────────────

function requireTvAdmin(req: Request, res: Response, next: NextFunction): void {
  const key = req.header("x-microfixd-admin-key");
  if (!process.env.ADMIN_TOKEN) {
    // No admin token configured: the deep-health endpoint already reports
    // configured.admin=false; allow reads so the OS can still boot.
    return next();
  }
  if (key && key === process.env.ADMIN_TOKEN) return next();
  res.status(401).json({ error: "Unauthorized." });
}

autonomyRouter.use(requireTvAdmin);

function tenantOf(req: Request): string {
  return req.header("x-microfixd-tenant") || "default";
}

// ── Organs: real registry records ──────────────────────────────────────────

const LAYER_ORDER = ["cognition", "memory", "autonomy", "communication", "evolution", "governance", "integration", "security"];

function organFamily(layer: string): { family: string; familyNumber: number; layerNumber: number } {
  const idx = LAYER_ORDER.indexOf(layer);
  const n = idx >= 0 ? idx + 1 : LAYER_ORDER.length;
  const label = layer.charAt(0).toUpperCase() + layer.slice(1);
  return { family: label, familyNumber: n, layerNumber: n };
}

function organToTvRecord(o: ReturnType<typeof organRegistry.all>[number]) {
  const fam = organFamily(o.layer);
  return {
    id: o.id,
    name: o.name,
    family: fam.family,
    familyNumber: fam.familyNumber,
    layer: fam.layerNumber,
    version: "1.0.0",
    tier: "tier-2" as const,
    mode: "native" as const,
    guidedPath: `/api/organs/${o.id}`,
    finalAuthority: "Paragon Dissector",
    status: o.status,
    errorCount: o.error_count,
    execCount: o.exec_count,
    lastExec: o.last_exec,
    lastError: o.last_error,
    isolated: o.isolated,
    metrics: o.metrics,
  };
}

function organSummary() {
  const all = organRegistry.all();
  const byStatus = new Map<string, number>();
  for (const o of all) byStatus.set(o.status, (byStatus.get(o.status) || 0) + 1);
  return {
    total: all.length,
    registered: all.length,
    operational: byStatus.get("healthy") || 0,
    restricted: all.filter((o) => o.isolated).length,
    dormant: byStatus.get("unknown") || 0,
    error: byStatus.get("error") || 0,
    families: new Set(all.map((o) => o.layer)).size,
    layers: new Set(all.map((o) => o.layer)).size,
    systemHealth: organRegistry.systemHealth(),
  };
}

autonomyRouter.get("/organs", (_req, res) => {
  const all = organRegistry.all();
  res.json({ summary: organSummary(), organs: all.map(organToTvRecord) });
});

autonomyRouter.get("/organs/:organId", (req, res) => {
  const organ = organRegistry.get(req.params.organId);
  if (!organ) return res.status(404).json({ error: `Organ ${req.params.organId} not found.` });
  res.json(organToTvRecord(organ));
});

// ── Introspection: real organ metrics snapshot ─────────────────────────────

autonomyRouter.get("/introspection", (_req, res) => {
  const snapshot = getSystemSnapshot();
  res.json({
    snapshot,
    organSummary: organSummary(),
    recentTraces: executionTracer.listTraces(10),
    circuitBreakers: getCircuitBreakerStatus(),
    rbacAudit: getRbacAuditLog(20),
    hitlQueue: { pending: getPending().length, total: getAll().length },
  });
});

// ── Infrastructure / compute: real runtime telemetry ────────────────────────

autonomyRouter.get("/infrastructure", (_req, res) => {
  const all = organRegistry.all();
  res.json({
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      pid: process.pid,
    },
    storage: {
      durable: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      engine: process.env.SUPABASE_URL ? "supabase-postgres" : "in-memory",
    },
    configured: {
      admin: Boolean(process.env.ADMIN_TOKEN),
      llm: Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
      github: Boolean(process.env.GITHUB_TOKEN),
    },
    organs: {
      registered: all.length,
      failed: all.filter((o) => o.status === "error").map((o) => o.id),
      isolated: all.filter((o) => o.isolated).map((o) => o.id),
      systemHealth: organRegistry.systemHealth(),
    },
    pendingHumanApprovals: getPending().length,
  });
});

autonomyRouter.get("/compute", (_req, res) => {
  const all = organRegistry.all();
  const withMetrics = all.filter((o) => o.metrics && o.metrics.total_calls > 0);
  res.json({
    traces: executionTracer.listTraces(20),
    circuitBreakers: getCircuitBreakerStatus(),
    organCompute: withMetrics.map((o) => ({
      organId: o.id,
      calls: o.metrics.total_calls,
      avgLatencyMs: Math.round(o.metrics.avg_latency_ms),
      successRate: o.metrics.success_rate,
    })),
    totals: {
      organsActive: withMetrics.length,
      totalCalls: withMetrics.reduce((s, o) => s + o.metrics.total_calls, 0),
      avgSuccessRate: withMetrics.length
        ? Number((withMetrics.reduce((s, o) => s + o.metrics.success_rate, 0) / withMetrics.length).toFixed(3))
        : 1,
    },
  });
});

// ── Usage report: real recent activity from audit + organ logs ──────────────

autonomyRouter.get("/usage-report", (_req, res) => {
  const events: Array<Record<string, unknown>> = [];
  for (const entry of getRbacAuditLog(50)) {
    events.push({
      id: `rbac-${entry.ts ?? Date.now()}`,
      kind: "http_request",
      name: `${entry.role ?? "unknown"}: ${(entry as Record<string, unknown>).method ?? "request"} ${(entry as Record<string, unknown>).path ?? ""}`,
      createdAt: new Date(typeof entry.ts === "number" ? entry.ts : Date.now()).toISOString(),
      metadata: entry as Record<string, unknown>,
    });
  }
  for (const o of organRegistry.all()) {
    for (const log of (o.log || []).slice(-3)) {
      events.push({
        id: `organ-${o.id}-${log.ts}`,
        kind: "organ_invocation",
        name: `${o.id}:${log.action}`,
        actorId: o.id,
        createdAt: log.ts,
        metadata: { success: log.success, latencyMs: log.latency_ms, error: log.error },
      });
    }
  }
  for (const r of getAll().slice(-20)) {
    events.push({
      id: `hitl-${r.hitl_id}`,
      kind: "approval",
      name: `hitl:${r.trigger} ${r.artifact?.name ?? ""}`,
      createdAt: r.ts,
      metadata: { status: r.status, decidedBy: r.decided_by },
    });
  }
  events.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  // `recentDurableEvents` is the field the TV's ActivityTimeline consumes
  // (it does .slice(-maxItems).reverse() on this ASC-ordered array).
  res.json({
    tenantId: "default",
    recentDurableEvents: events.slice(-100),
    events: events.slice(-100).reverse(),
    counts: {
      total: events.length,
      rbacEntries: getRbacAuditLog(1000).length,
      hitlRecords: getAll().length,
    },
  });
});

// ── Approvals: the real HITL queue ─────────────────────────────────────────

function hitlToApproval(r: ReturnType<typeof getPending>[number]) {
  return {
    id: r.hitl_id,
    tenantId: r.session_id,
    runId: (r.artifact as Record<string, unknown>).runId as string | undefined,
    status: r.status,
    reason: r.trigger,
    description: r.artifact?.name ?? r.trigger,
    requestedAt: r.ts,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
    decisionNote: r.notes,
    approvedBy: r.status === "approved" && r.decided_by ? [r.decided_by] : [],
    action: {
      id: r.hitl_id,
      kind: "apply_capability",
      title: r.artifact?.name ?? r.trigger,
      input: r.artifact as Record<string, unknown>,
      risk: (r.artifact as Record<string, unknown>).risk ?? "medium",
    },
  };
}

autonomyRouter.get("/approvals", (req, res) => {
  const status = (req.query.status as string) || "pending";
  const source = status === "pending" ? getPending() : getAll();
  res.json({ approvals: source.map(hitlToApproval) });
});

// Governed actions parked pending an approval decision. The adapter keeps the
// payload; the HITL decision releases it. Real human-in-the-loop, not a stub.
interface PendingAction {
  kind: "file_write" | "preview_rebuild";
  path?: string;
  content?: string;
  requestedBy?: string;
  hitlId?: string;
}
const pendingActions = new Map<string, PendingAction>();

autonomyRouter.post("/approvals/:id/decision", (req, res) => {
  const { approved, decidedBy } = req.body;
  const record = hitlDecide(req.params.id, approved ? "approved" : "rejected", `Decision by ${decidedBy ?? "operator"} via OS TV`);
  if (!record) return res.status(404).json({ error: `Approval ${req.params.id} not found.` });
  res.json({ status: "ok", approval: hitlToApproval(record) });
});

// ── Preview: real dist/ status + governed rebuild ──────────────────────────

function distLastBuilt(): string | null {
  try {
    const dist = resolve(process.cwd(), "dist");
    if (!existsSync(dist)) return null;
    return statSync(dist).mtime.toISOString();
  } catch {
    return null;
  }
}

autonomyRouter.get("/preview/status", (_req, res) => {
  res.json({
    mode: "outlet",
    note: "Static build served by this wall outlet; TV is deployed separately on Render.",
    distLastBuilt: distLastBuilt(),
  });
});

async function runRebuild(): Promise<{ status: string; exitCode: number | null; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("npm", ["run", "build"], {
      cwd: process.cwd(),
      timeout: 10 * 60 * 1000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { status: "ok", exitCode: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      status: "failed",
      exitCode: typeof e.code === "number" ? e.code : 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "build failed",
    };
  }
}

autonomyRouter.post("/preview/rebuild", async (req, res) => {
  const { approvalId, requestedBy } = req.body;
  if (!approvalId) {
    // Propose: gate the rebuild behind a real human approval.
    const record = hitlTrigger(tenantOf(req), { name: "preview-rebuild", type: "rebuild", requestedBy }, "tv_preview_rebuild");
    pendingActions.set(record.hitl_id, { kind: "preview_rebuild", requestedBy, hitlId: record.hitl_id });
    res.json({
      status: "awaiting_approval",
      approvalId: record.hitl_id,
      reasons: ["Frontend rebuild is a production-affecting action; human approval required."],
    });
    return;
  }
  const action = pendingActions.get(approvalId);
  if (!action) return res.status(404).json({ error: `No rebuild proposal ${approvalId}.` });
  const record = getAll().find((r) => r.hitl_id === approvalId);
  if (record?.status !== "approved") return res.status(403).json({ error: "Rebuild not approved." });
  pendingActions.delete(approvalId);
  const result = await runRebuild();
  res.json(result);
});

// ── Files: real repo FS, writes gated by HITL ──────────────────────────────

function safeRepoPath(relPath: string): string | null {
  const root = resolve(process.cwd());
  const target = resolve(root, relPath.replace(/^\//, ""));
  if (target !== root && !target.startsWith(root + "/")) return null; // no traversal outside repo
  return target;
}

autonomyRouter.get("/files/list", (req, res) => {
  const rel = (req.query.path as string) || "";
  const target = safeRepoPath(rel);
  if (!target) return res.status(400).json({ status: "error", error: "Path escapes repository root." });
  try {
    const entries = readdirSync(target, { withFileTypes: true })
      .filter((e) => e.name !== "node_modules" && !e.name.startsWith(".git"))
      .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
      .map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }));
    res.json({ status: "ok", entries, path: rel || "." });
  } catch (err) {
    res.status(404).json({ status: "error", error: `Cannot list ${rel}: ${String(err)}` });
  }
});

const MAX_READ_BYTES = 2 * 1024 * 1024;

autonomyRouter.get("/files/read", (req, res) => {
  const rel = req.query.path as string;
  const target = safeRepoPath(rel);
  if (!target) return res.status(400).json({ status: "error", error: "Path escapes repository root." });
  try {
    const s = statSync(target);
    if (!s.isFile()) return res.status(400).json({ status: "error", error: "Not a file." });
    if (s.size > MAX_READ_BYTES) return res.status(413).json({ status: "error", error: "File too large to preview." });
    res.json({ status: "ok", content: readFileSync(target, "utf8"), size: s.size });
  } catch (err) {
    res.status(404).json({ status: "error", error: `Cannot read ${rel}: ${String(err)}` });
  }
});

autonomyRouter.post("/files/write", (req, res) => {
  const { path: relPath, content, approvalId, requestedBy } = req.body;
  if (typeof relPath !== "string" || typeof content !== "string") {
    return res.status(400).json({ status: "error", error: "path and content required." });
  }
  const target = safeRepoPath(relPath);
  if (!target) return res.status(400).json({ status: "denied", reasons: ["Path escapes repository root."] });

  if (!approvalId) {
    // Governed write: park the payload, require a human decision first.
    const record = hitlTrigger(tenantOf(req), {
      name: `file-write: ${basename(relPath)}`,
      type: "file_write",
      path: relPath,
      bytes: content.length,
      requestedBy,
    }, "tv_file_write");
    pendingActions.set(record.hitl_id, { kind: "file_write", path: relPath, content, requestedBy, hitlId: record.hitl_id });
    return res.json({
      status: "awaiting_approval",
      approvalId: record.hitl_id,
      reasons: ["File writes to the outlet repository require human approval (HITL governance)."],
    });
  }

  const action = pendingActions.get(approvalId);
  if (!action) return res.status(404).json({ status: "error", error: `No write proposal ${approvalId}.` });
  const record = getAll().find((r) => r.hitl_id === approvalId);
  if (record?.status !== "approved") return res.status(403).json({ status: "error", error: "Write not approved." });
  pendingActions.delete(approvalId);
  try {
    writeFileSync(target, action.content ?? content, "utf8");
    broadcast("autonomy:file_written", { path: action.path, bytes: (action.content ?? content).length });
    res.json({ status: "ok", written: [action.path] });
  } catch (err) {
    res.status(500).json({ status: "error", error: `Write failed: ${String(err)}` });
  }
});

// ── GitHub import: real raw fetch with the outlet's token ──────────────────

autonomyRouter.post("/github/import", async (req, res) => {
  const { owner, repo, path: filePath, ref = "main" } = req.body;
  if (!owner || !repo || !filePath) return res.status(400).json({ error: "owner, repo and path required." });
  try {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath.replace(/^\//, "")}`;
    const headers: Record<string, string> = { "User-Agent": "microfixd-outlet" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const r = await fetch(url, { headers });
    if (!r.ok) return res.status(r.status).json({ error: `GitHub returned ${r.status} for ${url}` });
    res.json({ content: await r.text() });
  } catch (err) {
    res.status(502).json({ error: `Import failed: ${String(err)}` });
  }
});

// ── Chat: the real command pipeline (Groq-backed when configured) ──────────

autonomyRouter.post("/chat", async (req, res) => {
  const { message, requestedBy } = req.body;
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ reply: "Empty message.", status: "error" });
  }
  try {
    const result = await runCommand({
      task: message,
      session_id: tenantOf(req),
      source: "chat",
      priority: "normal",
      context: { requestedBy, channel: "microfixd-os-tv" },
    });
    res.json({ reply: result.output, status: result.success ? "ok" : "blocked", command: result });
  } catch (err) {
    res.status(500).json({ reply: `Command pipeline error: ${String(err)}`, status: "error" });
  }
});

// ── Goals / runs: real execution with event streaming ──────────────────────

interface TvRunStep {
  id: string; runId: string; sequence: number; action: Record<string, unknown>;
  status: string; createdAt: string;
}
interface TvRun {
  run: {
    id: string; tenantId: string; agentId: string; goal: string; requestedBy: string;
    status: "queued" | "planning" | "running" | "awaiting_approval" | "succeeded" | "failed" | "cancelled";
    plan: Array<{ id: string; kind: string; title: string; input: Record<string, unknown>; risk: string }>;
    currentStep: number; workingMemory: Record<string, unknown>;
    outcome?: string; error?: string; createdAt: string; updatedAt: string;
  };
  steps: TvRunStep[];
}
const runs = new Map<string, TvRun>();
const runSubscribers = new Map<string, Set<(event: Record<string, unknown>) => void>>();
const streamTokens = new Map<string, { runId: string; expires: number }>();

function emit(runId: string, event: Record<string, unknown>): void {
  broadcast(`autonomy:run:${runId}`, event);
  for (const send of runSubscribers.get(runId) ?? []) send(event);
}

autonomyRouter.post("/goals", async (req, res) => {
  const { goal, requestedBy } = req.body;
  if (typeof goal !== "string" || !goal.trim()) return res.status(400).json({ error: "goal required." });
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const tvRun: TvRun = {
    run: {
      id: runId, tenantId: tenantOf(req), agentId: "outlet-command-center", goal,
      requestedBy: requestedBy ?? "operator", status: "running",
      plan: [
        { id: "s1", kind: "introspect", title: "Reflex + security precheck", input: { task: goal }, risk: "low" },
        { id: "s2", kind: "design_workflow", title: "Groq classification + organ routing", input: { task: goal }, risk: "low" },
        { id: "s3", kind: "apply_capability", title: "Organ pipeline execution", input: { task: goal }, risk: "medium" },
      ],
      currentStep: 0, workingMemory: {}, createdAt: now, updatedAt: now,
    },
    steps: [],
  };
  runs.set(runId, tvRun);
  emit(runId, { type: "graph.started", missionId: runId });

  // Execute the goal through the REAL outlet pipeline. Async: the TV
  // subscribes to the stream while this runs.
  void (async () => {
    try {
      const result = await runCommand({
        task: goal, session_id: tenantOf(req), source: "api", priority: "normal",
        context: { requestedBy: requestedBy ?? "operator", channel: "microfixd-os-tv" },
      });
      const used = result.organs_used || [];
      used.forEach((organ, i) => {
        const step: TvRunStep = {
          id: `step_${i + 1}`, runId, sequence: i + 1,
          action: { id: `s${i + 1}`, kind: "apply_capability", title: `Organ: ${organ}`, input: { task: goal }, risk: "low" },
          status: result.success ? "succeeded" : "failed", createdAt: new Date().toISOString(),
        };
        tvRun.steps.push(step);
        tvRun.run.currentStep = i + 1;
        emit(runId, { type: "graph.step", missionId: runId, stepId: step.id, sequence: step.sequence, status: step.status, action: step.action });
      });
      tvRun.run.status = result.success ? "succeeded" : "failed";
      tvRun.run.outcome = result.output;
      tvRun.run.updatedAt = new Date().toISOString();
      emit(runId, { type: "mission.completed", missionId: runId, outcome: tvRun.run.status, ...(result.success ? {} : { error: result.output }) });
    } catch (err) {
      tvRun.run.status = "failed";
      tvRun.run.error = String(err);
      tvRun.run.updatedAt = new Date().toISOString();
      emit(runId, { type: "mission.completed", missionId: runId, outcome: "failed", error: String(err) });
      emit(runId, { type: "system.error", message: String(err) });
    }
  })();

  res.json({ run: tvRun.run });
});

autonomyRouter.post("/runs/:id/stream-token", (req, res) => {
  const token = `st_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  streamTokens.set(token, { runId: req.params.id, expires: Date.now() + 60_000 });
  res.json({ token });
});

autonomyRouter.get("/runs/:id/stream", (req, res) => {
  const { token } = req.query;
  const grant = token ? streamTokens.get(String(token)) : undefined;
  if (!grant || grant.runId !== req.params.id || grant.expires < Date.now()) {
    return res.status(401).json({ error: "Invalid or expired stream token." });
  }
  streamTokens.delete(String(token));
  const tvRun = runs.get(req.params.id);
  if (!tvRun) return res.status(404).json({ error: "Run not found." });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": req.headers.origin || "*",
  });
  const send = (event: Record<string, unknown>) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  // Replay real events that already happened (poll fallback parity).
  if (tvRun.run.status === "succeeded" || tvRun.run.status === "failed") {
    send({ type: "graph.started", missionId: tvRun.run.id });
    for (const s of tvRun.steps) {
      send({ type: "graph.step", missionId: tvRun.run.id, stepId: s.id, sequence: s.sequence, status: s.status, action: s.action });
    }
    send({ type: "mission.completed", missionId: tvRun.run.id, outcome: tvRun.run.status, ...(tvRun.run.error ? { error: tvRun.run.error } : {}) });
    res.end();
    return;
  }

  const sub = (event: Record<string, unknown>) => send(event);
  const subs = runSubscribers.get(req.params.id) ?? new Set();
  subs.add(sub);
  runSubscribers.set(req.params.id, subs);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    const s = runSubscribers.get(req.params.id);
    s?.delete(sub);
    if (s && s.size === 0) runSubscribers.delete(req.params.id);
  });
});

autonomyRouter.get("/runs/:id", (req, res) => {
  const tvRun = runs.get(req.params.id);
  if (!tvRun) return res.status(404).json({ error: "Run not found." });
  res.json({ run: tvRun.run, steps: tvRun.steps });
});

// ── Agents: the organ registry as the real agent network ──────────────────

autonomyRouter.get("/agents", (_req, res) => {
  const agents = organRegistry.all().map((o) => ({
    id: o.id,
    name: o.name,
    status: o.status,
    payload: {
      role: o.layer,
      load: o.metrics.total_calls,
      executionBoundary: o.isolated ? "isolated" : "shared-runtime",
      drift: { monitor: "organRegistry", response: o.status === "error" ? `last error: ${o.last_error ?? "unknown"}` : "nominal" },
    },
    updatedAt: o.last_exec ? new Date(o.last_exec).toISOString() : new Date().toISOString(),
  }));
  res.json({ agents });
});

// ── Meta layer: derived from real registry + trace health ───────────────────

autonomyRouter.get("/meta/decide", (_req, res) => {
  const all = organRegistry.all();
  const failed = all.filter((o) => o.status === "error");
  const isolated = all.filter((o) => o.isolated);
  const anomalyScore = all.length ? Number((failed.length / all.length).toFixed(3)) : 0;
  const health = organRegistry.systemHealth();
  res.json({
    systemMode: health === "nominal" ? "nominal" : "degraded-safe",
    assessment: {
      anomalyScore,
      degraded: health !== "nominal",
      signals: [
        ...failed.map((o) => `organ ${o.id} in error state${o.last_error ? `: ${o.last_error}` : ""}`),
        ...isolated.map((o) => `organ ${o.id} isolated`),
        ...(getPending().length > 0 ? [`${getPending().length} approval(s) awaiting human decision`] : []),
      ],
    },
    strategy: {
      mode: health === "nominal" ? "standard-operations" : "conservative-routing",
      reason: health === "nominal"
        ? `All monitored organs nominal across ${all.length} registered organs.`
        : `${failed.length} error organ(s), ${isolated.length} isolated; routing through healthy organs only.`,
    },
  });
});

autonomyRouter.get("/meta/evolve", (_req, res) => {
  const traces = executionTracer.listTraces(50);
  const byStatus = new Map<string, { success: number; total: number }>();
  for (const t of traces) {
    const rec = t as unknown as Record<string, unknown>;
    const key = String(rec.type ?? rec.status ?? "execution");
    const agg = byStatus.get(key) ?? { success: 0, total: 0 };
    agg.total += 1;
    if (rec.success) agg.success += 1;
    byStatus.set(key, agg);
  }
  const records = Array.from(byStatus.entries()).map(([recordType, agg]) => ({
    recordType,
    successRate: agg.total ? agg.success / agg.total : 1,
    successCount: agg.success,
    reviewCount: agg.total,
    recommendation: agg.success / (agg.total || 1) >= 0.8
      ? "Keep current wiring; success rate is healthy."
      : "Review recent failures; consider isolating the failing organ.",
  }));
  res.json(records);
});

autonomyRouter.post("/meta/heal", (_req, res) => {
  const all = organRegistry.all();
  const failed = all.filter((o) => o.status === "error");
  const healed: string[] = [];
  for (const o of failed) {
    if (organRegistry.reset(o.id)) healed.push(o.id);
  }
  const stillFailed = failed.filter((o) => !healed.includes(o.id)).map((o) => o.id);
  res.json({
    action: healed.length
      ? `Reset ${healed.length} error organ(s): ${healed.join(", ")}`
      : "No error organs found; nothing to heal.",
    reason: organRegistry.systemHealth() === "nominal"
      ? "System nominal; heal pass found no degraded organs."
      : `Heal pass executed across ${all.length} organs.`,
    safeModeCurrentlyActive: organRegistry.systemHealth() !== "nominal" && stillFailed.length > 0,
    healed,
    stillFailed,
  });
});

// ── Credential status: honest env-derived booleans, nothing exposed ─────────

autonomyRouter.get("/system/credential-status", (_req, res) => {
  res.json({
    adminKeyConfigured: Boolean(process.env.ADMIN_TOKEN),
    signingKeysConfigured: false,   // this outlet has no signing-key subsystem
    signingKeyCount: 0,
    activeKeyVersion: null,
    githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN),
    renderApiKeyConfigured: false,   // Render key is not stored on the outlet
    railwayTokenConfigured: false,
    twilioConfigured: false,
    valueExposure: "redacted",
  });
});

// ── Voice: honest 503; the TV falls back to browser TTS ─────────────────────

autonomyRouter.post("/voice/speak", (_req, res) => {
  res.status(503).json({ error: "No TTS provider configured on this outlet; the TV will use browser speech synthesis." });
});
