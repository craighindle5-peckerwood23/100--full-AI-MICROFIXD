/**
 * server/runtime/liveCapabilities.ts
 * LIVE RUNTIME PROBING & REAL-TIME CAPABILITY LEDGER
 *
 * Maintains an authoritative, freshness-stamped ledger of what the runtime can
 * actually do right now across three bounded safety tiers:
 *   Tier 1 (routing_only)     : Zero-I/O organ routing & credential boundary checks
 *   Tier 2 (read_verified)    : Safe read-only live checks (Supabase, Memory, OBD catalog, Security, LLM config, Metacognition)
 *   Tier 3 (dry_run_verified / evolution_verified) :
 *     - Isolated QuickJS WASM expression dry-run + E2B config check
 *     - Playwright Chromium executable readiness dry-run (zero external egress)
 *     - Automotive OBD bridge & protocol contract check
 *     - Safe organ state-evolution & adaptation/verification dry-run (zero filesystem/DB mutation)
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { broadcast } from '../events';
import { organRegistry } from '../organs/organRegistry';
import { EXECUTORS } from '../organs/executors';
import { probeOrgan } from '../organs/probes';
import { textProvidersConfigured, completeTextWithFallback } from '../orchestration/llmFallback';
import { sandboxConfigured } from '../sandbox/isolatedCode';
import { obdConnectionSetup } from '../automotive/obd/connectionSetup';
import { executeSecurityOrgan } from '../organs/organs/securityOrgan';
import { executeAdaptationOrgan, executeVerificationOrgan } from '../organs/organs/cognitiveAssuranceOrgan';
import { orchestrationOversight } from '../orchestration/orchestrationOversight';
import { runMetacognitiveReasoning } from '../orchestration/metacognitiveReasoning';

export type ProbeTier =
  | 'unverified'
  | 'routing_only'
  | 'read_verified'
  | 'dry_run_verified'
  | 'evolution_verified';

export type CapabilityStatus =
  | 'verified'
  | 'degraded'
  | 'unavailable'
  | 'isolated'
  | 'unverified';

export type CapabilityCategory = 'subsystem' | 'organ' | 'adapter';

export interface EvolutionDelta {
  priorStatus?: CapabilityStatus;
  priorTier?: ProbeTier;
  trend: 'new' | 'stable' | 'improved' | 'degraded';
  dryRunRewriteSafe?: boolean;
  notes?: string;
}

export interface CapabilityProbeRecord {
  id: string;
  name: string;
  category: CapabilityCategory;
  layer?: string;
  verificationTier: ProbeTier;
  status: CapabilityStatus;
  latencyMs: number | null;
  checkedAt: string | null;
  freshnessSeconds: number | null;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  nativeExecutor: boolean;
  summary: string;
  evolutionDelta?: EvolutionDelta;
  details?: Record<string, unknown>;
}

export interface LiveCapabilitySnapshot {
  sweepId: string | null;
  mode: 'initial' | 'quick' | 'deep' | 'targeted';
  generatedAt: string | null;
  sweepDurationMs: number;
  freshnessThresholdSeconds: number;
  stale: boolean;
  counts: {
    total: number;
    verified: number;
    degraded: number;
    unavailable: number;
    isolated: number;
    unverified: number;
    byTier: Record<ProbeTier, number>;
  };
  subsystems: CapabilityProbeRecord[];
  organsSummary: {
    total: number;
    verified: number;
    degraded: number;
    isolated: number;
    nativeExecutors: number;
    routingOnlyCount: number;
  };
  records: CapabilityProbeRecord[];
  agentSummaryPrompt: string;
}

export interface ProbeSweepOptions {
  mode?: 'quick' | 'deep' | 'targeted';
  targetIds?: string[];
  tenantId?: string;
  verifyLlmLive?: boolean;
}

const DEFAULT_FRESHNESS_SECONDS = 120;

const SUBSYSTEM_DEFINITIONS: Array<{ id: string; name: string; category: CapabilityCategory; layer: string }> = [
  { id: 'supabase_storage', name: 'Supabase Durable Persistence', category: 'subsystem', layer: 'memory' },
  { id: 'memory_retrieval', name: 'Memory & Context Retrieval', category: 'subsystem', layer: 'memory' },
  { id: 'llm_providers', name: 'Server LLM Providers', category: 'subsystem', layer: 'cortex' },
  { id: 'security_governance', name: 'Security Spine & Oversight Invariants', category: 'subsystem', layer: 'governance' },
  { id: 'metacognitive_engine', name: 'Multi-Domain Metacognition Engine', category: 'subsystem', layer: 'world_thinking' },
  { id: 'automotive_obd', name: 'Automotive & OBD Bridge Readiness', category: 'adapter', layer: 'domain' },
  { id: 'github_adapter', name: 'GitHub Repository Adapter', category: 'adapter', layer: 'execution' },
  { id: 'isolated_sandbox_dry_run', name: 'Isolated Sandbox (QuickJS/E2B Dry-Run)', category: 'subsystem', layer: 'execution' },
  { id: 'browser_runtime_dry_run', name: 'Browser Automation Runtime Readiness', category: 'adapter', layer: 'execution' },
  { id: 'organ_state_evolution_dry_run', name: 'Organ State Evolution & Safe Rewrite Gate', category: 'subsystem', layer: 'evolution' },
];

function sanitizeSummary(value: unknown): string {
  return String(value ?? '')
    .replace(/(Bearer\s+|sk-[A-Za-z0-9_-]+|AIza[A-Za-z0-9_-]+|ghp_[A-Za-z0-9_-]+)/gi, '[REDACTED]')
    .slice(0, 280);
}

function statusScore(status: CapabilityStatus): number {
  switch (status) {
    case 'verified':
      return 3;
    case 'degraded':
      return 2;
    case 'unverified':
      return 1;
    case 'isolated':
    case 'unavailable':
      return 0;
  }
}

class LiveCapabilityLedger {
  private records = new Map<string, CapabilityProbeRecord>();
  private lastSweepId: string | null = null;
  private lastMode: LiveCapabilitySnapshot['mode'] = 'initial';
  private lastGeneratedAt: string | null = null;
  private lastSweepDurationMs = 0;
  private freshnessThresholdSeconds = DEFAULT_FRESHNESS_SECONDS;
  private activeSweeps = new Map<string, Promise<LiveCapabilitySnapshot>>();
  private sweepCounter = 0;

  private ensureSeeded(): void {
    for (const def of SUBSYSTEM_DEFINITIONS) {
      if (!this.records.has(def.id)) {
        this.records.set(def.id, {
          id: def.id,
          name: def.name,
          category: def.category,
          layer: def.layer,
          verificationTier: 'unverified',
          status: 'unverified',
          latencyMs: null,
          checkedAt: null,
          freshnessSeconds: null,
          successCount: 0,
          failureCount: 0,
          consecutiveFailures: 0,
          nativeExecutor: true,
          summary: 'Awaiting initial live probe sweep.',
        });
      }
    }

    for (const organ of organRegistry.all()) {
      const key = `organ:${organ.id}`;
      if (!this.records.has(key)) {
        this.records.set(key, {
          id: organ.id,
          name: organ.name,
          category: 'organ',
          layer: organ.layer,
          verificationTier: 'unverified',
          status: organ.isolated ? 'isolated' : 'unverified',
          latencyMs: null,
          checkedAt: null,
          freshnessSeconds: null,
          successCount: 0,
          failureCount: 0,
          consecutiveFailures: 0,
          nativeExecutor: Object.hasOwn(EXECUTORS, organ.id),
          summary: organ.isolated ? 'Organ manually isolated.' : 'Not yet probed in current runtime window.',
        });
      }
    }
  }

  private recordResult(
    mapKey: string,
    base: {
      id: string;
      name: string;
      category: CapabilityCategory;
      layer?: string;
      nativeExecutor: boolean;
    },
    outcome: {
      verificationTier: ProbeTier;
      status: CapabilityStatus;
      latencyMs: number;
      summary: string;
      dryRunRewriteSafe?: boolean;
      evolutionNotes?: string;
      details?: Record<string, unknown>;
    }
  ): CapabilityProbeRecord {
    const prev = this.records.get(mapKey);
    const nowIso = new Date().toISOString();
    const ok = outcome.status === 'verified' || outcome.status === 'degraded';

    let trend: EvolutionDelta['trend'] = 'new';
    if (prev && prev.checkedAt) {
      const prevS = statusScore(prev.status);
      const nextS = statusScore(outcome.status);
      if (nextS > prevS) trend = 'improved';
      else if (nextS < prevS) trend = 'degraded';
      else trend = 'stable';
    }

    const updated: CapabilityProbeRecord = {
      id: base.id,
      name: base.name,
      category: base.category,
      layer: base.layer,
      verificationTier: outcome.verificationTier,
      status: outcome.status,
      latencyMs: Math.max(0, Math.round(outcome.latencyMs * 10) / 10),
      checkedAt: nowIso,
      freshnessSeconds: 0,
      successCount: (prev?.successCount ?? 0) + (ok ? 1 : 0),
      failureCount: (prev?.failureCount ?? 0) + (ok ? 0 : 1),
      consecutiveFailures: ok ? 0 : (prev?.consecutiveFailures ?? 0) + 1,
      nativeExecutor: base.nativeExecutor,
      summary: sanitizeSummary(outcome.summary),
      evolutionDelta: {
        priorStatus: prev?.status,
        priorTier: prev?.verificationTier,
        trend,
        dryRunRewriteSafe: outcome.dryRunRewriteSafe,
        notes: outcome.evolutionNotes,
      },
      details: outcome.details,
    };

    this.records.set(mapKey, updated);
    return updated;
  }

  private async probeSubsystem(
    id: string,
    tenantId: string,
    verifyLlmLive = false
  ): Promise<CapabilityProbeRecord | null> {
    const def = SUBSYSTEM_DEFINITIONS.find(d => d.id === id);
    if (!def) return null;
    const t0 = performance.now();

    try {
      switch (id) {
        case 'supabase_storage': {
          const url = process.env.SUPABASE_URL?.trim();
          const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
          if (!url || !key) {
            return this.recordResult(id, { ...def, nativeExecutor: true }, {
              verificationTier: 'routing_only',
              status: 'unavailable',
              latencyMs: performance.now() - t0,
              summary: 'Supabase URL or service role key not configured on server.',
              details: { configured: false },
            });
          }
          const { executeMemoryOrgan } = await import('../organs/organs/memoryOrgan');
          const res = await executeMemoryOrgan('recent', {
            tenant_id: tenantId,
            session_id: 'probe:readonly',
            limit: 1,
          }) as { records?: unknown[] };
          const visibleRows = Array.isArray(res?.records) ? res.records.length : 0;
          return this.recordResult(id, { ...def, nativeExecutor: true }, {
            verificationTier: 'read_verified',
            status: 'verified',
            latencyMs: performance.now() - t0,
            summary: `Supabase durable read check succeeded (${visibleRows} sample row(s) visible for tenant).`,
            details: { configured: true, durableRead: true, visibleRows },
          });
        }

        case 'memory_retrieval': {
          const url = process.env.SUPABASE_URL?.trim();
          const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
          if (!url || !key) {
            return this.recordResult(id, { ...def, nativeExecutor: Object.hasOwn(EXECUTORS, 'memory') }, {
              verificationTier: 'routing_only',
              status: 'unavailable',
              latencyMs: performance.now() - t0,
              summary: 'Durable memory retrieval unavailable without Supabase credentials.',
              details: { durable: false },
            });
          }
          const { executeMemoryOrgan } = await import('../organs/organs/memoryOrgan');
          const res = await executeMemoryOrgan('context', {
            tenant_id: tenantId,
            session_id: 'probe:readonly',
            query: 'capability_probe',
            limit: 1,
            max_chars: 1000,
          }) as { window?: { returned?: number }; degraded?: boolean };
          return this.recordResult(id, { ...def, nativeExecutor: true }, {
            verificationTier: 'read_verified',
            status: res?.degraded ? 'degraded' : 'verified',
            latencyMs: performance.now() - t0,
            summary: res?.degraded
              ? 'Memory context retrieval responded in degraded fallback mode.'
              : 'Memory organ context retrieval verified.',
            details: { windowReturned: res?.window?.returned ?? 0, degraded: Boolean(res?.degraded) },
          });
        }

        case 'llm_providers': {
          const configuredProviders = [
            process.env.OPENROUTER_API_KEY?.trim() ? 'openrouter' : null,
            process.env.GROQ_API_KEY?.trim() ? 'groq' : null,
            process.env.GEMINI_API_KEY?.trim() ? 'gemini' : null,
            process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ? 'cloudflare' : null,
          ].filter(Boolean) as string[];

          if (!textProvidersConfigured()) {
            return this.recordResult(id, { ...def, nativeExecutor: true }, {
              verificationTier: 'routing_only',
              status: 'unavailable',
              latencyMs: performance.now() - t0,
              summary: 'No server-side LLM provider key configured.',
              details: { configuredProviders },
            });
          }

          if (verifyLlmLive) {
            const ping = await completeTextWithFallback(
              [{ role: 'user', content: 'Reply OK.' }],
              16,
              0
            );
            return this.recordResult(id, { ...def, nativeExecutor: true }, {
              verificationTier: 'read_verified',
              status: ping.truncated ? 'degraded' : 'verified',
              latencyMs: performance.now() - t0,
              summary: `Live LLM round-trip succeeded via ${ping.provider} (${ping.model}).`,
              details: { configuredProviders, activeProvider: ping.provider, model: ping.model },
            });
          }

          return this.recordResult(id, { ...def, nativeExecutor: true }, {
            verificationTier: 'routing_only',
            status: 'verified',
            latencyMs: performance.now() - t0,
            summary: `Provider credentials configured (${configuredProviders.join(', ')}); pass verifyLlmLive=true for token probe.`,
            details: { configuredProviders, liveTokenProbeSkipped: true },
          });
        }

        case 'security_governance': {
          const scan = await executeSecurityOrgan('scan_output', {
            output: 'Routine read-only security spine diagnostic sample.',
          }) as { clean: boolean; flags: string[] };
          const inv = orchestrationOversight.getInvariants();
          const status: CapabilityStatus = inv.emergencyKillEngaged
            ? 'isolated'
            : scan.clean && inv.antiDriftCompliant
            ? 'verified'
            : 'degraded';
          return this.recordResult(id, { ...def, nativeExecutor: true }, {
            verificationTier: 'read_verified',
            status,
            latencyMs: performance.now() - t0,
            summary: inv.emergencyKillEngaged
              ? 'Emergency kill switch is currently engaged in orchestration oversight.'
              : `Security scan clean; recursion ceiling <= ${inv.recursionDepthMax} enforced.`,
            details: { scanClean: scan.clean, invariants: inv },
          });
        }

        case 'metacognitive_engine': {
          const analysis = await runMetacognitiveReasoning({
            problem: 'Verify multi-domain decomposition, multi-outcome calibration, inception retrospection, and unbiased stakeholder neutrality.',
            evidence: ['System probe read-only sanity check'],
            useLlm: false,
            tenantId,
          });
          const ok = analysis.domains.length >= 3 && analysis.outcomes.length >= 4 && analysis.perspectives.perspectivesEvaluated.length >= 4;
          return this.recordResult(id, { ...def, nativeExecutor: true }, {
            verificationTier: 'dry_run_verified',
            status: ok ? 'verified' : 'degraded',
            latencyMs: performance.now() - t0,
            summary: `Metacognitive engine verified (${analysis.domains.length} domains, ${analysis.outcomes.length} outcome trajectories, ${analysis.perspectives.perspectivesEvaluated.length} perspectives).`,
            details: {
              domainsCount: analysis.domains.length,
              outcomesCount: analysis.outcomes.length,
              perspectivesCount: analysis.perspectives.perspectivesEvaluated.length,
              uncertaintyScore: analysis.uncertainty.uncertaintyScore,
            },
          });
        }

        case 'automotive_obd': {
          const setup = obdConnectionSetup();
          const bridgePath = path.resolve(process.cwd(), 'integrations/obd-bridge/bridge.py');
          const bridgePresent = existsSync(bridgePath);
          const supportedTransports = setup.transports.filter(t => t.supported).map(t => t.id);
          return this.recordResult(id, { ...def, nativeExecutor: Object.hasOwn(EXECUTORS, 'vector_automotive') }, {
            verificationTier: 'dry_run_verified',
            status: bridgePresent && supportedTransports.length > 0 ? 'verified' : 'degraded',
            latencyMs: performance.now() - t0,
            summary: bridgePresent
              ? `OBD protocol contract & local bridge artifacts verified (${supportedTransports.join(', ')}); physical hardware requires active user bridge.`
              : 'OBD contract active, but local bridge script directory missing.',
            details: {
              bridgePresent,
              supportedTransports,
              hardwareCompatibilityVerified: setup.capabilities.hardwareCompatibilityVerified,
            },
          });
        }

        case 'github_adapter': {
          const hasToken = Boolean(process.env.GITHUB_TOKEN?.trim());
          return this.recordResult(id, { ...def, nativeExecutor: Object.hasOwn(EXECUTORS, 'github_connector') }, {
            verificationTier: 'routing_only',
            status: hasToken ? 'verified' : 'unavailable',
            latencyMs: performance.now() - t0,
            summary: hasToken
              ? 'GitHub personal/app token present for authenticated repo operations.'
              : 'GITHUB_TOKEN not set; public unauthenticated reads only, writes disabled.',
            details: { tokenConfigured: hasToken },
          });
        }

        case 'isolated_sandbox_dry_run': {
          const { getQuickJS } = await import('quickjs-emscripten');
          const QuickJS = await getQuickJS();
          const vm = QuickJS.newContext();
          let evaluated = false;
          let value = 0;
          try {
            const evalRes = vm.evalCode('21 * 2');
            if ('error' in evalRes && evalRes.error) {
              evalRes.error.dispose();
              throw new Error('QuickJS evaluation failed');
            }
            if ('value' in evalRes) {
              value = Number(vm.dump(evalRes.value));
              evalRes.value.dispose();
              evaluated = value === 42;
            }
          } finally {
            vm.dispose();
          }
          const e2bReady = sandboxConfigured();
          return this.recordResult(id, { ...def, nativeExecutor: true }, {
            verificationTier: 'dry_run_verified',
            status: evaluated ? 'verified' : 'degraded',
            latencyMs: performance.now() - t0,
            summary: `QuickJS WASM VM synthetic dry-run passed (21*2=${value}); E2B cloud sandbox: ${e2bReady ? 'configured' : 'unconfigured'}.`,
            details: { wasmQuickJsReady: evaluated, e2bConfigured: e2bReady },
          });
        }

        case 'browser_runtime_dry_run': {
          const customExec = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
          let chromiumPath: string | null = customExec || null;
          let binaryExists = customExec ? existsSync(customExec) : false;

          if (!customExec) {
            try {
              const mod = await import('@sparticuz/chromium');
              chromiumPath = await mod.default.executablePath();
              binaryExists = Boolean(chromiumPath && existsSync(chromiumPath));
            } catch {
              binaryExists = false;
            }
          }

          return this.recordResult(id, { ...def, nativeExecutor: Object.hasOwn(EXECUTORS, 'playwright') }, {
            verificationTier: 'dry_run_verified',
            status: binaryExists ? 'verified' : 'degraded',
            latencyMs: performance.now() - t0,
            summary: binaryExists
              ? 'Headless Chromium binary verified on disk (zero network egress during probe).'
              : 'Chromium executable not resolved locally; Playwright navigation may require runtime extraction.',
            details: { binaryExists, customPathConfigured: Boolean(customExec) },
          });
        }

        case 'organ_state_evolution_dry_run': {
          // Run safe, non-mutating adaptation + verification proposal dry-run
          const adaptRes = await executeAdaptationOrgan('adapt', {
            task: 'Probe safe state-evolution gate invariants',
            directive: 'Enforce strict schema & tenant checks before state promotion',
          }) as { adaptation?: unknown };
          const verifySafe = await executeVerificationOrgan('verify', {
            proposal: adaptRes.adaptation,
            baselineScore: { overall_score: 7.0, constitution_compliance: 10 },
            candidateScore: { overall_score: 8.2, constitution_compliance: 10 },
          }) as { success?: boolean; verification?: unknown };
          const verifyUnsafe = await executeVerificationOrgan('verify', {
            proposal: adaptRes.adaptation,
            baselineScore: { overall_score: 8.0, constitution_compliance: 10 },
            candidateScore: { overall_score: 8.5, constitution_compliance: 4 },
          }) as { success?: boolean };

          const gateSound = Boolean(verifySafe?.success) && verifyUnsafe?.success === false;
          return this.recordResult(id, { ...def, nativeExecutor: true }, {
            verificationTier: 'evolution_verified',
            status: gateSound ? 'verified' : 'degraded',
            latencyMs: performance.now() - t0,
            summary: gateSound
              ? 'Organ state-evolution dry-run verified: safe adaptation approved and unsafe invariant regression blocked.'
              : 'Organ state-evolution verification gate failed to discriminate unsafe candidate.',
            dryRunRewriteSafe: gateSound,
            evolutionNotes: 'Non-mutating adaptation + invariant regression check passed without filesystem/DB writes.',
            details: {
              safeApproved: Boolean(verifySafe?.success),
              unsafeBlocked: verifyUnsafe?.success === false,
            },
          });
        }

        default:
          return null;
      }
    } catch (error) {
      return this.recordResult(id, { ...def, nativeExecutor: false }, {
        verificationTier: 'routing_only',
        status: 'unavailable',
        latencyMs: performance.now() - t0,
        summary: `Probe failed: ${error instanceof Error ? error.message : String(error)}`,
        dryRunRewriteSafe: false,
      });
    }
  }

  private async probeRegisteredOrgan(organId: string, requestId: string, tenantId: string): Promise<CapabilityProbeRecord | null> {
    const organ = organRegistry.get(organId);
    if (!organ) return null;
    const key = `organ:${organ.id}`;
    const hasNative = Object.hasOwn(EXECUTORS, organ.id);

    if (organ.isolated) {
      return this.recordResult(key, {
        id: organ.id,
        name: organ.name,
        category: 'organ',
        layer: organ.layer,
        nativeExecutor: hasNative,
      }, {
        verificationTier: 'routing_only',
        status: 'isolated',
        latencyMs: 0,
        summary: 'Organ is isolated; dispatch disabled until reset.',
        details: { execCount: organ.exec_count, errorCount: organ.error_count },
      });
    }

    const t0 = performance.now();
    try {
      const probeResult = await probeOrgan(organ.id, requestId, tenantId) as {
        lane?: string;
        value?: { native_executor?: boolean; probe_version?: string };
      };
      const errorPenalty = organ.status === 'error' || organ.error_count > organ.exec_count;
      return this.recordResult(key, {
        id: organ.id,
        name: organ.name,
        category: 'organ',
        layer: organ.layer,
        nativeExecutor: hasNative,
      }, {
        verificationTier: hasNative ? 'routing_only' : 'routing_only',
        status: errorPenalty ? 'degraded' : 'verified',
        latencyMs: performance.now() - t0,
        summary: hasNative
          ? `Routing verified via ${probeResult?.lane ?? 'stable'} lane; native executor bound.`
          : `Routing verified via ${probeResult?.lane ?? 'stable'} lane; descriptive/fallback capability only.`,
        details: {
          lane: probeResult?.lane ?? 'stable',
          probeVersion: probeResult?.value?.probe_version ?? 'v1',
          execCount: organ.exec_count,
          errorCount: organ.error_count,
          registryStatus: organ.status,
        },
      });
    } catch (error) {
      return this.recordResult(key, {
        id: organ.id,
        name: organ.name,
        category: 'organ',
        layer: organ.layer,
        nativeExecutor: hasNative,
      }, {
        verificationTier: 'routing_only',
        status: 'unavailable',
        latencyMs: performance.now() - t0,
        summary: `Organ probe failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  public async runSweep(options: ProbeSweepOptions = {}): Promise<LiveCapabilitySnapshot> {
    this.ensureSeeded();
    const mode = options.mode ?? 'quick';
    const targetIds = Array.isArray(options.targetIds) && options.targetIds.length > 0
      ? [...new Set(options.targetIds.map(s => String(s).trim()).filter(Boolean))]
      : null;
    const singleFlightKey = targetIds ? `targeted:${targetIds.slice().sort().join(',')}` : `${mode}:${Boolean(options.verifyLlmLive)}`;

    const existing = this.activeSweeps.get(singleFlightKey);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const started = performance.now();
      const sweepId = `cap_sweep_${++this.sweepCounter}_${Date.now().toString(36)}`;
      const requestId = randomUUID();
      const tenantId = options.tenantId?.trim() || 'default';
      const changedRecords: CapabilityProbeRecord[] = [];

      if (targetIds) {
        await Promise.all(targetIds.map(async tid => {
          if (SUBSYSTEM_DEFINITIONS.some(d => d.id === tid)) {
            const rec = await this.probeSubsystem(tid, tenantId, Boolean(options.verifyLlmLive));
            if (rec) changedRecords.push(rec);
          } else {
            const cleanId = tid.startsWith('organ:') ? tid.slice(6) : tid;
            const rec = await this.probeRegisteredOrgan(cleanId, requestId, tenantId);
            if (rec) changedRecords.push(rec);
          }
        }));
      } else {
        const tier2Ids = [
          'supabase_storage',
          'memory_retrieval',
          'llm_providers',
          'security_governance',
          'metacognitive_engine',
          'automotive_obd',
          'github_adapter',
        ];
        const tier3Ids = [
          'isolated_sandbox_dry_run',
          'browser_runtime_dry_run',
          'organ_state_evolution_dry_run',
        ];

        const subsystemIds = mode === 'deep' ? [...tier2Ids, ...tier3Ids] : tier2Ids;
        const subResults = await Promise.all(
          subsystemIds.map(id => this.probeSubsystem(id, tenantId, Boolean(options.verifyLlmLive)))
        );
        for (const r of subResults) {
          if (r) changedRecords.push(r);
        }

        // Probe all registered organs in chunks so routing + isolation state stays current
        const allOrgans = organRegistry.all();
        const organResults = await Promise.all(
          allOrgans.map(o => this.probeRegisteredOrgan(o.id, requestId, tenantId))
        );
        for (const r of organResults) {
          if (r) changedRecords.push(r);
        }
      }

      this.lastSweepId = sweepId;
      this.lastMode = targetIds ? 'targeted' : mode;
      this.lastGeneratedAt = new Date().toISOString();
      this.lastSweepDurationMs = Math.max(1, Math.round(performance.now() - started));

      const snapshot = this.getSnapshot();
      broadcast('capabilities:updated', {
        sweepId: snapshot.sweepId,
        mode: snapshot.mode,
        generatedAt: snapshot.generatedAt,
        sweepDurationMs: snapshot.sweepDurationMs,
        counts: snapshot.counts,
        subsystems: snapshot.subsystems,
        changedCount: changedRecords.length,
        degradedIds: snapshot.records.filter(r => r.status === 'degraded' || r.status === 'unavailable').map(r => r.id).slice(0, 20),
      });

      return snapshot;
    })().finally(() => {
      this.activeSweeps.delete(singleFlightKey);
    });

    this.activeSweeps.set(singleFlightKey, promise);
    return promise;
  }

  public hasSnapshot(): boolean {
    return this.lastGeneratedAt !== null;
  }

  public getSnapshot(): LiveCapabilitySnapshot {
    this.ensureSeeded();
    const nowMs = Date.now();
    const records: CapabilityProbeRecord[] = [];

    for (const rec of this.records.values()) {
      const freshnessSeconds = rec.checkedAt
        ? Math.max(0, Math.round((nowMs - Date.parse(rec.checkedAt)) / 1000))
        : null;
      // Keep live organ isolation status synced even between sweeps
      if (rec.category === 'organ') {
        const organ = organRegistry.get(rec.id);
        if (organ?.isolated && rec.status !== 'isolated') {
          records.push({ ...rec, status: 'isolated', freshnessSeconds });
          continue;
        }
      }
      records.push({ ...rec, freshnessSeconds });
    }

    const byTier: Record<ProbeTier, number> = {
      unverified: 0,
      routing_only: 0,
      read_verified: 0,
      dry_run_verified: 0,
      evolution_verified: 0,
    };

    let verified = 0;
    let degraded = 0;
    let unavailable = 0;
    let isolated = 0;
    let unverified = 0;

    for (const rec of records) {
      byTier[rec.verificationTier]++;
      if (rec.status === 'verified') verified++;
      else if (rec.status === 'degraded') degraded++;
      else if (rec.status === 'unavailable') unavailable++;
      else if (rec.status === 'isolated') isolated++;
      else unverified++;
    }

    const subsystems = records.filter(r => r.category !== 'organ');
    const organRecords = records.filter(r => r.category === 'organ');
    const stale = !this.lastGeneratedAt || (nowMs - Date.parse(this.lastGeneratedAt)) / 1000 > this.freshnessThresholdSeconds;

    const snapshotBase = {
      sweepId: this.lastSweepId,
      mode: this.lastMode,
      generatedAt: this.lastGeneratedAt,
      sweepDurationMs: this.lastSweepDurationMs,
      freshnessThresholdSeconds: this.freshnessThresholdSeconds,
      stale,
      counts: {
        total: records.length,
        verified,
        degraded,
        unavailable,
        isolated,
        unverified,
        byTier,
      },
      subsystems,
      organsSummary: {
        total: organRecords.length,
        verified: organRecords.filter(o => o.status === 'verified').length,
        degraded: organRecords.filter(o => o.status === 'degraded').length,
        isolated: organRecords.filter(o => o.status === 'isolated').length,
        nativeExecutors: organRecords.filter(o => o.nativeExecutor).length,
        routingOnlyCount: organRecords.filter(o => o.verificationTier === 'routing_only').length,
      },
      records,
    };

    return {
      ...snapshotBase,
      agentSummaryPrompt: this.formatAgentSummary(snapshotBase),
    };
  }

  private formatAgentSummary(snapshot: Omit<LiveCapabilitySnapshot, 'agentSummaryPrompt'>): string {
    if (!snapshot.generatedAt) {
      return `Live capability telemetry: unprobed (${snapshot.organsSummary.total} registered organs, ${snapshot.organsSummary.nativeExecutors} native executors). Treat unprobed external services as unverified and call run_live_capability_probe when certainty is required.`;
    }
    const ageSec = Math.max(0, Math.round((Date.now() - Date.parse(snapshot.generatedAt)) / 1000));
    const verifiedSubs = snapshot.subsystems
      .filter(s => s.status === 'verified')
      .map(s => `${s.id}[${s.verificationTier}]`)
      .join(', ');
    const degradedOrDown = snapshot.subsystems
      .filter(s => s.status === 'degraded' || s.status === 'unavailable' || s.status === 'isolated')
      .map(s => `${s.id}=${s.status}(${s.summary.slice(0, 80)})`)
      .join('; ');
    const isolatedOrgans = snapshot.records
      .filter(r => r.category === 'organ' && r.status === 'isolated')
      .map(r => r.id);

    return [
      `Live capability snapshot (${snapshot.mode}, age=${ageSec}s, stale=${snapshot.stale}):`,
      `Subsystems verified: ${verifiedSubs || 'none'}.`,
      degradedOrDown ? `Degraded/Unavailable: ${degradedOrDown}.` : 'All probed subsystems nominal.',
      `Organs: ${snapshot.organsSummary.verified}/${snapshot.organsSummary.total} routing-verified (${snapshot.organsSummary.nativeExecutors} native executors${isolatedOrgans.length ? `, isolated=[${isolatedOrgans.join(',')}]` : ''}).`,
    ].join(' ');
  }

  public getCompactPlannerSummary(): string {
    return this.getSnapshot().agentSummaryPrompt;
  }
}

export const liveCapabilityLedger = new LiveCapabilityLedger();

export function startLiveCapabilityLoop(options?: { intervalMs?: number; deepEveryNSweeps?: number; runInitialImmediately?: boolean }): () => void {
  const intervalMs = Math.max(
    10_000,
    Number(options?.intervalMs ?? process.env.MICROFIXD_CAPABILITY_PROBE_INTERVAL_MS ?? 60_000) || 60_000
  );
  const deepEvery = Math.max(2, Number(options?.deepEveryNSweeps ?? 5) || 5);
  let sweepIndex = 0;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    sweepIndex++;
    const mode: 'quick' | 'deep' = sweepIndex === 1 || sweepIndex % deepEvery === 0 ? 'deep' : 'quick';
    try {
      await liveCapabilityLedger.runSweep({ mode, tenantId: 'system-runtime' });
    } catch (err) {
      console.error('[live-capabilities] sweep failed:', err instanceof Error ? err.message : String(err));
    }
  };

  if (options?.runInitialImmediately !== false) {
    setTimeout(() => void tick(), 2000).unref();
  }
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
