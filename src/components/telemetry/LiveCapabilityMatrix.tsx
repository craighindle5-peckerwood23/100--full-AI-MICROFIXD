import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  FlaskConical,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api, AuthenticationRequiredError } from '../../lib/serverApi';
import type {
  CapabilityProbeRecord,
  CapabilityStatus,
  LiveCapabilitySnapshot,
  ProbeTier,
} from '../../types';

function statusBadgeClasses(status: CapabilityStatus): string {
  switch (status) {
    case 'verified':
      return 'text-emerald-300 border-emerald-500/35 bg-emerald-950/30';
    case 'degraded':
      return 'text-amber-300 border-amber-500/35 bg-amber-950/30';
    case 'isolated':
      return 'text-cyan-300 border-cyan-500/35 bg-cyan-950/30';
    case 'unavailable':
      return 'text-rose-300 border-rose-500/35 bg-rose-950/30';
    default:
      return 'text-slate-400 border-slate-700 bg-slate-900/60';
  }
}

function tierLabel(tier: ProbeTier): string {
  switch (tier) {
    case 'evolution_verified':
      return 'T3 EVOLUTION';
    case 'dry_run_verified':
      return 'T3 DRY-RUN';
    case 'read_verified':
      return 'T2 READ-LIVE';
    case 'routing_only':
      return 'T1 ROUTING';
    default:
      return 'UNVERIFIED';
  }
}

function tierColor(tier: ProbeTier): string {
  switch (tier) {
    case 'evolution_verified':
      return 'text-indigo-300';
    case 'dry_run_verified':
      return 'text-emerald-300';
    case 'read_verified':
      return 'text-cyan-300';
    case 'routing_only':
      return 'text-slate-300';
    default:
      return 'text-slate-500';
  }
}

function statusIcon(status: CapabilityStatus) {
  switch (status) {
    case 'verified':
      return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
    case 'degraded':
      return <AlertTriangle size={13} className="text-amber-400 shrink-0" />;
    case 'isolated':
      return <ShieldAlert size={13} className="text-cyan-400 shrink-0" />;
    case 'unavailable':
      return <XCircle size={13} className="text-rose-400 shrink-0" />;
    default:
      return <Cpu size={13} className="text-slate-500 shrink-0" />;
  }
}

function formatIsoClock(iso: string | null): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function LiveCapabilityMatrix() {
  const [snapshot, setSnapshot] = useState<LiveCapabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [probingMode, setProbingMode] = useState<'quick' | 'deep' | string | null>(null);
  const [verifyLlmLive, setVerifyLlmLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'subsystems' | 'organs'>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CapabilityStatus>('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | ProbeTier>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async (runIfEmpty = true) => {
    setError(null);
    setAuthRequired(false);
    try {
      const data = await api<LiveCapabilitySnapshot>(
        'GET',
        `/organs/capabilities/live?run_if_empty=${runIfEmpty ? '1' : '0'}`,
      );
      setSnapshot(data);
    } catch (err) {
      if (err instanceof AuthenticationRequiredError) {
        setAuthRequired(true);
        setError('Operator token or signed-in session required to inspect live capability probes.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load live capability ledger');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerProbe = useCallback(
    async (mode: 'quick' | 'deep' | 'targeted', targetIds?: string[]) => {
      const key = mode === 'targeted' && targetIds?.[0] ? targetIds[0] : mode;
      setProbingMode(key);
      setError(null);
      try {
        const res = await api<{ success: boolean; snapshot: LiveCapabilitySnapshot }>(
          'POST',
          '/organs/capabilities/probe',
          {
            mode,
            targetIds,
            verifyLlmLive: mode === 'deep' ? verifyLlmLive : false,
          },
        );
        if (res.snapshot) {
          setSnapshot(res.snapshot);
        }
      } catch (err) {
        if (err instanceof AuthenticationRequiredError) {
          setAuthRequired(true);
          setError('Operator token or session required to trigger capability probes.');
        } else {
          setError(err instanceof Error ? err.message : 'Capability probe failed');
        }
      } finally {
        setProbingMode(null);
      }
    },
    [verifyLlmLive],
  );

  useEffect(() => {
    void fetchSnapshot(true);

    const onWsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LiveCapabilitySnapshot>).detail;
      if (detail && Array.isArray(detail.records)) {
        setSnapshot(detail);
        setLoading(false);
        setError(null);
      }
    };

    const onAuthChanged = () => {
      setLoading(true);
      void fetchSnapshot(true);
    };

    window.addEventListener('microfixd:capabilities-updated', onWsUpdate);
    window.addEventListener('microfixd:auth-changed', onAuthChanged);

    return () => {
      window.removeEventListener('microfixd:capabilities-updated', onWsUpdate);
      window.removeEventListener('microfixd:auth-changed', onAuthChanged);
    };
  }, [fetchSnapshot]);

  const filteredRecords = useMemo(() => {
    const records = snapshot?.records ?? [];
    const q = search.trim().toLowerCase();
    return records.filter((rec) => {
      if (categoryFilter === 'subsystems' && rec.category === 'organ') return false;
      if (categoryFilter === 'organs' && rec.category !== 'organ') return false;
      if (statusFilter !== 'ALL' && rec.status !== statusFilter) return false;
      if (tierFilter !== 'ALL' && rec.verificationTier !== tierFilter) return false;
      if (q) {
        const haystack = `${rec.id} ${rec.name} ${rec.layer ?? ''} ${rec.summary}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [snapshot, categoryFilter, statusFilter, tierFilter, search]);

  const resetFilters = () => {
    setCategoryFilter('all');
    setStatusFilter('ALL');
    setTierFilter('ALL');
    setSearch('');
  };

  return (
    <div className="space-y-4 font-mono text-slate-200">
      {/* Header & Controls Bar */}
      <div className="border border-cyan-500/25 rounded-xl bg-[#040a12] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-white">
              <ShieldCheck size={16} className="text-cyan-400" />
              <span>LIVE RUNTIME CAPABILITY MATRIX // 3-TIER SELF-AWARENESS</span>
            </div>
            <p className="text-[11px] font-sans text-slate-400 mt-1">
              Real-time freshness-stamped verification across routing boundaries, safe read checks, QuickJS/Chromium/OBD dry-runs, and organ state-evolution gates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 px-2 py-1 border border-slate-800 rounded bg-slate-950/60 cursor-pointer">
              <input
                type="checkbox"
                checked={verifyLlmLive}
                onChange={(e) => setVerifyLlmLive(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>Verify LLM Live (Deep)</span>
            </label>

            <button
              type="button"
              onClick={() => void triggerProbe('quick')}
              disabled={probingMode !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-400/50 bg-cyan-950/40 hover:bg-cyan-500/20 text-xs text-cyan-200 disabled:opacity-50"
            >
              <RefreshCw size={12} className={probingMode === 'quick' ? 'animate-spin' : ''} />
              <span>{probingMode === 'quick' ? 'Checking...' : 'Run Quick Check'}</span>
            </button>

            <button
              type="button"
              onClick={() => void triggerProbe('deep')}
              disabled={probingMode !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-indigo-400/50 bg-indigo-950/40 hover:bg-indigo-500/20 text-xs text-indigo-200 disabled:opacity-50"
            >
              <FlaskConical size={12} className={probingMode === 'deep' ? 'animate-spin' : ''} />
              <span>{probingMode === 'deep' ? 'Probing T3...' : 'Run Deep Dry-Run'}</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        {snapshot && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="border border-slate-800 bg-black/40 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Verified</div>
              <div className="text-lg font-bold text-emerald-300 tabular-nums mt-0.5">
                {snapshot.counts.verified}
                <span className="text-xs text-slate-500 font-normal">/{snapshot.counts.total}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                T3:{snapshot.counts.byTier.dry_run_verified + snapshot.counts.byTier.evolution_verified} · T2:{snapshot.counts.byTier.read_verified}
              </div>
            </div>

            <div className="border border-slate-800 bg-black/40 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Degraded</div>
              <div className={`text-lg font-bold tabular-nums mt-0.5 ${snapshot.counts.degraded > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                {snapshot.counts.degraded}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Unavail: {snapshot.counts.unavailable}
              </div>
            </div>

            <div className="border border-slate-800 bg-black/40 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Isolated</div>
              <div className={`text-lg font-bold tabular-nums mt-0.5 ${snapshot.counts.isolated > 0 ? 'text-cyan-300' : 'text-slate-300'}`}>
                {snapshot.counts.isolated}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Guarded / Kill-switch</div>
            </div>

            <div className="border border-slate-800 bg-black/40 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Organs Native</div>
              <div className="text-lg font-bold text-cyan-300 tabular-nums mt-0.5">
                {snapshot.organsSummary.nativeExecutors}
                <span className="text-xs text-slate-500 font-normal">/{snapshot.organsSummary.total}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                T1 Routing: {snapshot.organsSummary.routingOnlyCount}
              </div>
            </div>

            <div className="border border-slate-800 bg-black/40 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Evolution Tier</div>
              <div className="text-lg font-bold text-indigo-300 tabular-nums mt-0.5">
                {snapshot.counts.byTier.evolution_verified}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Safe Rewrite Gate</div>
            </div>

            <div className="border border-slate-800 bg-black/40 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Last Sweep</div>
              <div className="text-sm font-bold text-slate-200 tabular-nums mt-1">
                {formatIsoClock(snapshot.generatedAt)}
              </div>
              <div className={`text-[10px] mt-0.5 ${snapshot.stale ? 'text-amber-300' : 'text-emerald-400'}`}>
                {snapshot.mode.toUpperCase()} · {snapshot.sweepDurationMs}ms · {snapshot.stale ? 'STALE' : 'FRESH'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="border border-rose-500/40 bg-rose-950/25 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void fetchSnapshot(true);
            }}
            className="px-2.5 py-1 rounded border border-rose-400/40 bg-rose-900/30 hover:bg-rose-800/40 text-[11px] shrink-0"
          >
            {authRequired ? 'Retry After Auth' : 'Retry'}
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !snapshot && (
        <div className="border border-cyan-500/20 bg-black/50 rounded-xl p-8 text-center text-xs text-cyan-300">
          <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-cyan-400" />
          Running initial live capability check...
        </div>
      )}

      {/* Filter Toolbar & Matrix Table */}
      {snapshot && (
        <div className="border border-cyan-500/25 rounded-xl bg-[#040a12] overflow-hidden">
          <div className="p-3 border-b border-cyan-500/15 flex flex-wrap items-center justify-between gap-3 bg-black/40">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <div className="flex border border-slate-800 rounded bg-slate-950/80 p-0.5">
                {(['all', 'subsystems', 'organs'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2 py-1 rounded uppercase ${
                      categoryFilter === cat
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | CapabilityStatus)}
                aria-label="Filter by status"
                className="px-2 py-1 rounded border border-slate-800 bg-slate-950 text-slate-200 text-[11px]"
              >
                <option value="ALL">Status: All</option>
                <option value="verified">Verified</option>
                <option value="degraded">Degraded</option>
                <option value="isolated">Isolated</option>
                <option value="unavailable">Unavailable</option>
                <option value="unverified">Unverified</option>
              </select>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as 'ALL' | ProbeTier)}
                aria-label="Filter by verification tier"
                className="px-2 py-1 rounded border border-slate-800 bg-slate-950 text-slate-200 text-[11px]"
              >
                <option value="ALL">Tier: All</option>
                <option value="evolution_verified">T3 Evolution</option>
                <option value="dry_run_verified">T3 Dry-Run</option>
                <option value="read_verified">T2 Read-Live</option>
                <option value="routing_only">T1 Routing</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={13} className="text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search capabilities, layers..."
                className="w-full pl-8 pr-3 py-1 rounded border border-slate-800 bg-slate-950 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Filtered Empty State */}
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <Layers size={18} className="mx-auto text-slate-500" />
              <div>No live capabilities match the current filter criteria.</div>
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1 rounded border border-cyan-500/35 bg-cyan-950/30 text-cyan-200 hover:bg-cyan-500/20"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 max-h-[540px] overflow-y-auto">
              {filteredRecords.map((rec: CapabilityProbeRecord) => {
                const isExpanded = expandedId === rec.id;
                const isTargetedProbing = probingMode === rec.id;

                return (
                  <div key={rec.id} className="bg-black/20 hover:bg-cyan-950/10 transition-colors">
                    <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown size={13} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={13} className="text-slate-500 shrink-0" />
                        )}
                        {statusIcon(rec.status)}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-100 truncate">{rec.name}</span>
                            <span className="text-[10px] text-slate-500">
                              {rec.id} · {rec.category.toUpperCase()}
                              {rec.layer ? `/${rec.layer}` : ''}
                            </span>
                          </div>
                          <div className="text-[11px] font-sans text-slate-400 truncate mt-0.5">
                            {rec.summary}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-3 shrink-0 text-[10px] tabular-nums">
                        <span className={`font-semibold ${tierColor(rec.verificationTier)}`}>
                          {tierLabel(rec.verificationTier)}
                        </span>

                        <span className={`px-1.5 py-0.5 rounded border uppercase font-semibold ${statusBadgeClasses(rec.status)}`}>
                          {rec.status}
                        </span>

                        <span className="w-12 text-right text-slate-300">
                          {rec.latencyMs !== null ? `${rec.latencyMs}ms` : '—'}
                        </span>

                        <span className="hidden md:inline text-slate-400 w-16 text-right">
                          {rec.successCount}✓/{rec.failureCount}✕
                        </span>

                        <button
                          type="button"
                          onClick={() => void triggerProbe('targeted', [rec.id])}
                          disabled={probingMode !== null}
                          className="px-2 py-1 rounded border border-cyan-500/35 bg-cyan-950/30 hover:bg-cyan-500/20 text-cyan-200 disabled:opacity-40"
                        >
                          {isTargetedProbing ? '...' : 'Probe'}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-9 pb-3 pt-1 text-[11px] border-t border-slate-800/50 bg-slate-950/50 space-y-2">
                        <div className="flex flex-wrap items-center gap-4 text-slate-400">
                          <span>Checked: <strong className="text-slate-200">{formatIsoClock(rec.checkedAt)}</strong></span>
                          <span>Native Executor: <strong className="text-slate-200">{rec.nativeExecutor ? 'Yes' : 'No'}</strong></span>
                          <span>Consecutive Failures: <strong className="text-slate-200">{rec.consecutiveFailures}</strong></span>
                          {rec.evolutionDelta && (
                            <span>
                              Evolution Delta:{' '}
                              <strong className={rec.evolutionDelta.trend === 'degraded' ? 'text-amber-300' : 'text-emerald-300'}>
                                {rec.evolutionDelta.trend.toUpperCase()}
                              </strong>
                              {rec.evolutionDelta.dryRunRewriteSafe !== undefined && (
                                <> · Rewrite Gate: {rec.evolutionDelta.dryRunRewriteSafe ? 'SAFE' : 'BLOCKED'}</>
                              )}
                            </span>
                          )}
                        </div>

                        {rec.evolutionDelta?.notes && (
                          <div className="text-indigo-200 font-sans">
                            {rec.evolutionDelta.notes}
                          </div>
                        )}

                        {rec.details && Object.keys(rec.details).length > 0 && (
                          <pre className="p-2 rounded border border-slate-800 bg-black/60 text-[10px] text-cyan-200/90 overflow-x-auto">
                            {JSON.stringify(rec.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Compact Planner Context Preview */}
          <div className="px-3.5 py-2.5 border-t border-slate-800 bg-black/50 text-[10px] text-slate-400 flex items-center justify-between gap-3">
            <span className="truncate" title={snapshot.agentSummaryPrompt}>
              Planner/Brain Prompt Injection: <span className="text-cyan-300">{snapshot.agentSummaryPrompt}</span>
            </span>
            <span className="shrink-0">Updated {formatIsoClock(snapshot.generatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
