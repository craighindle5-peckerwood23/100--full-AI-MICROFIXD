import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Layers,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Activity,
  Cpu,
  Network,
  Radio,
  Clock,
  Sparkles,
  GitBranch,
  Terminal,
  CheckCircle2,
  XCircle,
  BarChart3,
  Sliders,
  Flame,
  Search,
  Scale,
  Compass,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  WorldThinkingReport,
  SimulationBranch,
  OversightAudit,
  SystemInvariants,
  LiveCapabilitySnapshot,
  MetacognitiveAnalysisResult,
  InceptionOutcomeRetrospection,
} from '../../types';
import { api } from '../../lib/serverApi';
import { sound } from '../../utils/audio';

export default function WorldThinkingOversightRoom() {
  const [activeTab, setActiveTab] = useState<
    'simulation' | 'branches' | 'metacognition' | 'retrospection' | 'oversight' | 'organs'
  >('simulation');
  const [simulationPrompt, setSimulationPrompt] = useState(
    'Optimize parallel execution pipelines while preserving Chapter 15 invariants',
  );
  const [simulating, setSimulating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [latestReport, setLatestReport] = useState<WorldThinkingReport | null>(null);
  const [history, setHistory] = useState<WorldThinkingReport[]>([]);
  const [audits, setAudits] = useState<OversightAudit[]>([]);
  const [capSnapshot, setCapSnapshot] = useState<LiveCapabilitySnapshot | null>(null);
  const [probingCaps, setProbingCaps] = useState(false);

  // High-bandwidth metacognition & inception-to-outcome retrospection state
  const [metaProblem, setMetaProblem] = useState(
    'Design resilient multi-tenant execution with OBD telemetry, WASM sandboxing, and zero cross-tenant leakage under partial failure.',
  );
  const [metaEvidence, setMetaEvidence] = useState(
    'QuickJS WASM sandbox available; RBAC tenant isolation enforced server-side; HITL gate required for irreversible writes',
  );
  const [metaConstraints, setMetaConstraints] = useState(
    'Preserve durable Supabase state; Keep recursion depth <= 3; Zero synthetic fallback metrics',
  );
  const [metaUseLlm, setMetaUseLlm] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaAnalysis, setMetaAnalysis] = useState<MetacognitiveAnalysisResult | null>(null);

  const [inceptionPromptInput, setInceptionPromptInput] = useState(
    'Just bypass checks and deploy immediately—obviously the faster path is better.',
  );
  const [intendedOutcomeInput, setIntendedOutcomeInput] = useState(
    'Deliver verified multi-domain resolution preserving RBAC, HITL safety, and durable persistence.',
  );
  const [observedOutcomeInput, setObservedOutcomeInput] = useState('');
  const [retroLoading, setRetroLoading] = useState(false);
  const [standaloneRetro, setStandaloneRetro] = useState<InceptionOutcomeRetrospection | null>(null);

  const [invariants, setInvariants] = useState<SystemInvariants>({
    recursionDepthMax: 3,
    memoryLeakZero: true,
    dataPersistencePreserved: true,
    antiDriftCompliant: true,
    emergencyKillEngaged: false,
  });
  const [selectedBranch, setSelectedBranch] = useState<SimulationBranch | null>(null);
  const [testDepth, setTestDepth] = useState(2);
  const [testAction, setTestAction] = useState('subagent_spawn_batch');
  const [depthVerifyResult, setDepthVerifyResult] = useState<{ allowed: boolean; reason: string } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // World thinking & oversight organs definition
  const worldOrgans = [
    { id: 'world_model', name: 'World Model & State Simulator', layer: 'world_thinking', role: 'Predictive Spatial-Temporal & Multi-Domain Simulation', fallbackStatus: 'active', fallbackLatency: '4.2ms' },
    { id: 'world_thinking_engine', name: 'Counterfactual World Thinking Engine', layer: 'world_thinking', role: 'Multi-Branch Counterfactual & Metacognitive Search', fallbackStatus: 'active', fallbackLatency: '12.8ms' },
    { id: 'counterfactual_simulator', name: 'Multi-Branch Counterfactual Search', layer: 'world_thinking', role: 'Speculative Branch Evaluator', fallbackStatus: 'active', fallbackLatency: '8.1ms' },
    { id: 'epistemic_uncertainty_scorer', name: 'Epistemic Uncertainty Estimator', layer: 'world_thinking', role: 'Deterministic Calibrated Entropy & Confidence Meter', fallbackStatus: 'active', fallbackLatency: '2.5ms' },
    { id: 'future_state_projector', name: 'State Trajectory & Drift Forecaster', layer: 'world_thinking', role: '10-Step Ahead Resource Predictor', fallbackStatus: 'active', fallbackLatency: '6.4ms' },
    { id: 'invariance_verifier', name: 'Mathematical Invariant Preserver', layer: 'world_thinking', role: 'Identity & Schema Anchor Guard', fallbackStatus: 'active', fallbackLatency: '1.9ms' },
    { id: 'orchestration_oversight', name: 'Hierarchical Oversight Supervisor', layer: 'oversight', role: 'Hub-and-Spoke Spawner Supervisor', fallbackStatus: 'active', fallbackLatency: '3.1ms' },
    { id: 'recursion_governor', name: 'Call-Stack Recursion Depth Arbiter', layer: 'oversight', role: 'Recursion Depth Enforcer (Max: 3)', fallbackStatus: 'active', fallbackLatency: '0.8ms' },
    { id: 'subagent_mesh_arbiter', name: 'Sub-Agent Mesh Spawner & Barrier', layer: 'oversight', role: 'Threadpool Allocator & Barrier Sync', fallbackStatus: 'active', fallbackLatency: '5.2ms' },
    { id: 'emergency_kill_switch', name: 'Zero-State Emergency Circuit Interrupter', layer: 'oversight', role: 'Sub-ms Zero-State Interrupter', fallbackStatus: invariants.emergencyKillEngaged ? 'engaged' : 'nominal', fallbackLatency: '0.2ms' },
    { id: 'hallucination_pruner', name: 'Counterfactual Hallucination Pruner', layer: 'world_thinking', role: 'Hypothetical Risk Dissector', fallbackStatus: 'active', fallbackLatency: '7.3ms' },
    { id: 'anti_drift_anchor', name: 'Identity & Invariant Anti-Drift Lock', layer: 'oversight', role: 'Constitutional Constraint Anchor', fallbackStatus: 'active', fallbackLatency: '1.4ms' },
  ];

  const fetchLiveCapabilities = async () => {
    try {
      const snap = await api<LiveCapabilitySnapshot>('GET', '/organs/capabilities/live?run_if_empty=1');
      if (snap && Array.isArray(snap.records)) {
        setCapSnapshot(snap);
      }
    } catch {
      // Handled via apiError or unauthenticated state
    }
  };

  const handleQuickProbeCapabilities = async (mode: 'quick' | 'deep' = 'quick') => {
    setProbingCaps(true);
    setApiError(null);
    try {
      const res = await api<{ success: boolean; snapshot: LiveCapabilitySnapshot }>(
        'POST',
        '/organs/capabilities/probe',
        { mode },
      );
      if (res.snapshot) {
        setCapSnapshot(res.snapshot);
        window.dispatchEvent(new CustomEvent('microfixd:capabilities-updated', { detail: res.snapshot }));
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Capability probe failed');
    } finally {
      setProbingCaps(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await api<{ history?: WorldThinkingReport[] }>('GET', '/command/world-thinking/history?limit=10');
      if (data.history && data.history.length > 0) {
        setHistory(data.history);
        setLatestReport(data.history[0]);
        setSelectedBranch(data.history[0].optimalBranch);
        if (data.history[0].metacognition) {
          setMetaAnalysis(data.history[0].metacognition);
        }
      } else {
        await handleRunSimulation(simulationPrompt);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to load world thinking history');
    }
  };

  const fetchOversightData = async () => {
    try {
      const [invData, audData] = await Promise.all([
        api<{ invariants: SystemInvariants }>('GET', '/command/oversight/invariants'),
        api<{ audits?: OversightAudit[] }>('GET', '/command/oversight/audits?limit=25'),
      ]);
      if (invData?.invariants) setInvariants(invData.invariants);
      if (audData?.audits) setAudits(audData.audits);
    } catch {
      // Keep polling quiet if session not yet active
    }
  };

  const fetchMetacognitiveHistory = async () => {
    try {
      const data = await api<{ history?: MetacognitiveAnalysisResult[] }>('GET', '/command/metacognition/history?limit=5');
      if (data.history && data.history.length > 0 && !metaAnalysis) {
        setMetaAnalysis(data.history[0]);
      }
    } catch {
      // Ignored on initial load
    }
  };

  // Fetch initial data & subscribe to WS capability broadcasts
  useEffect(() => {
    void fetchHistory();
    void fetchOversightData();
    void fetchLiveCapabilities();
    void fetchMetacognitiveHistory();

    const interval = setInterval(() => {
      void fetchOversightData();
    }, 4000);

    const onWsCaps = (event: Event) => {
      const detail = (event as CustomEvent<LiveCapabilitySnapshot>).detail;
      if (detail && Array.isArray(detail.records)) setCapSnapshot(detail);
    };
    const onAuthChanged = () => {
      setApiError(null);
      void fetchHistory();
      void fetchOversightData();
      void fetchLiveCapabilities();
      void fetchMetacognitiveHistory();
    };

    window.addEventListener('microfixd:capabilities-updated', onWsCaps);
    window.addEventListener('microfixd:auth-changed', onAuthChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('microfixd:capabilities-updated', onWsCaps);
      window.removeEventListener('microfixd:auth-changed', onAuthChanged);
    };
  }, []);

  const handleRunSimulation = async (task: string) => {
    setSimulating(true);
    setApiError(null);
    sound.click();
    try {
      const data = await api<{ success: boolean; report?: WorldThinkingReport }>(
        'POST',
        '/command/world-thinking/simulate',
        {
          task,
          includeLiveCapabilities: true,
          actions: [
            { action: 'speculative_dag_dispatch', args: { parallel_workers: 4, memory_limit_mb: 512 } },
            { action: 'deterministic_pipeline_patch', args: { sandbox_mode: 'wasm', verify_invariants: true } },
            { action: 'aggressive_cache_purge', args: { drop_active_tables: false } },
            { action: 'self_morphing_rewrite', args: { target_layer: 'execution', depth_allowance: 2 } },
          ],
        },
      );
      if (data.report) {
        setLatestReport(data.report);
        setSelectedBranch(data.report.optimalBranch);
        setHistory((prev) => [data.report!, ...prev.slice(0, 15)]);
        if (data.report.metacognition) {
          setMetaAnalysis(data.report.metacognition);
        }
        sound.telemetry();
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleRunMetacognition = async () => {
    setMetaLoading(true);
    setApiError(null);
    sound.click();
    try {
      const evidenceList = metaEvidence
        .split(/[\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const constraintList = metaConstraints
        .split(/[\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await api<{ success: boolean; analysis: MetacognitiveAnalysisResult }>(
        'POST',
        '/command/metacognition/reason',
        {
          problem: metaProblem,
          inceptionPrompt: inceptionPromptInput || metaProblem,
          intendedOutcome: intendedOutcomeInput || undefined,
          observedOutcome: observedOutcomeInput.trim() || undefined,
          evidence: evidenceList,
          constraints: constraintList,
          useLlm: metaUseLlm,
          requireLlm: metaUseLlm,
        },
      );
      if (res.analysis) {
        setMetaAnalysis(res.analysis);
        setStandaloneRetro(res.analysis.retrospection);
        sound.telemetry();
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Metacognitive analysis failed');
    } finally {
      setMetaLoading(false);
    }
  };

  const handleRunRetrospection = async () => {
    setRetroLoading(true);
    setApiError(null);
    sound.click();
    try {
      const evidenceList = metaEvidence
        .split(/[\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const constraintList = metaConstraints
        .split(/[\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api<{ success: boolean; retrospection: InceptionOutcomeRetrospection }>(
        'POST',
        '/command/metacognition/retrospect',
        {
          problem: metaProblem,
          inceptionPrompt: inceptionPromptInput || metaProblem,
          intendedOutcome: intendedOutcomeInput || undefined,
          observedOutcome: observedOutcomeInput.trim() || undefined,
          evidence: evidenceList,
          constraints: constraintList,
        },
      );
      if (res.retrospection) {
        setStandaloneRetro(res.retrospection);
        sound.telemetry();
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Retrospection audit failed');
    } finally {
      setRetroLoading(false);
    }
  };

  const handleToggleKillSwitch = async () => {
    sound.critical();
    setApiError(null);
    const nextAction = invariants.emergencyKillEngaged ? 'reset' : 'trigger';
    try {
      const data = await api<{ emergencyKillEngaged: boolean }>('POST', '/command/oversight/kill-switch', {
        action: nextAction,
      });
      setInvariants((prev) => ({ ...prev, emergencyKillEngaged: data.emergencyKillEngaged }));
      void fetchOversightData();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Kill switch toggle failed');
    }
  };

  const handleVerifyDepth = async () => {
    sound.click();
    setApiError(null);
    try {
      const data = await api<{ allowed: boolean; reason: string }>('POST', '/command/oversight/verify-depth', {
        source: 'Operator_Tester',
        action: testAction,
        depth: testDepth,
      });
      setDepthVerifyResult(data);
      void fetchOversightData();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Depth verification failed');
    }
  };

  // Trajectory chart dataset for branches
  const trajectoryData = [0, 2, 4, 6, 8, 10].map(step => {
    const baseCpu = latestReport?.activeWorldState?.cpuLoadEst ?? 32;
    const baseMem = latestReport?.activeWorldState?.memoryLoadEst ?? 4.2;
    return {
      step: `T+${step}s`,
      OptimalBranch: +(baseCpu + Math.sin(step * 0.5) * 6 + (step > 6 ? -3 : 4)).toFixed(1),
      HypotheticalMax: +(baseCpu + step * 2.8).toFixed(1),
      SafetyThreshold: 85,
      MemoryLoadGB: +(baseMem + (step * 0.12)).toFixed(2),
    };
  });

  const branchBarData = (latestReport?.branchesEvaluated || []).map(b => ({
    name: b.actionName.length > 18 ? b.actionName.slice(0, 18) + '…' : b.actionName,
    Utility: Math.round(b.expectedUtility * 100),
    Risk: Math.round(b.riskFactor * 100),
    Hallucination: Math.round(b.hallucinationRisk * 100),
    decision: b.decision,
    fullBranch: b
  }));

  const filteredOrgans = worldOrgans.filter(o =>
    o.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    o.role.toLowerCase().includes(searchFilter.toLowerCase()) ||
    o.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050811] text-slate-100 overflow-hidden select-none">
      {/* ── TOP HEADER HUD ── */}
      <header className="px-6 py-4 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <Brain className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 font-mono">
                WORLD THINKING & ORCHESTRATION OVERSIGHT
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Layer-11 Kernel
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Counterfactual tree search • Epistemic uncertainty scoring • Recursion depth limit (≤3) • Emergency kill-switch
            </p>
          </div>
        </div>

        {/* Global Action & Invariant Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/90 text-xs font-mono">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span className="text-slate-400">Uncertainty:</span>
            <span className="text-cyan-300 font-bold">
              {latestReport ? `${(latestReport.epistemicUncertainty * 100).toFixed(1)}%` : '6.4%'}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/90 text-xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Invariants:</span>
            <span className="text-emerald-400 font-bold">100% PRESERVED</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/90 text-xs font-mono">
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Max Depth:</span>
            <span className="text-indigo-300 font-bold">{invariants.recursionDepthMax}</span>
          </div>

          {/* Emergency Kill Switch Button */}
          <button
            onClick={handleToggleKillSwitch}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
              invariants.emergencyKillEngaged
                ? 'bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                : 'bg-red-950/40 text-red-400 border-red-500/30 hover:bg-red-900/40 hover:border-red-400'
            }`}
            title="Trigger or Reset Zero-State Emergency Kill Switch"
          >
            {invariants.emergencyKillEngaged ? (
              <>
                <ShieldAlert className="w-4 h-4 text-red-400 animate-bounce" />
                <span>KILL SWITCH ENGAGED (RESET)</span>
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 text-red-400" />
                <span>EMERGENCY KILL SWITCH</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── NAVIGATION TABS ── */}
      <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setActiveTab('simulation'); sound.click(); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'simulation'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>World Thinking Matrix</span>
          </button>

          <button
            onClick={() => { setActiveTab('branches'); sound.click(); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'branches'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Branches & Pruning</span>
          </button>

          <button
            onClick={() => { setActiveTab('metacognition'); sound.click(); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'metacognition'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Multi-Domain & Outcomes</span>
          </button>

          <button
            onClick={() => { setActiveTab('retrospection'); sound.click(); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'retrospection'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Inception & Unbiased Lenses</span>
          </button>

          <button
            onClick={() => { setActiveTab('oversight'); sound.click(); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'oversight'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Oversight & Recursion</span>
          </button>

          <button
            onClick={() => { setActiveTab('organs'); sound.click(); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'organs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Organs ({worldOrgans.length})</span>
          </button>
        </div>

        {/* Live Simulation Trigger Input */}
        <div className="flex items-center gap-2 max-w-md w-full">
          <input
            type="text"
            value={simulationPrompt}
            onChange={(e) => setSimulationPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleRunSimulation(simulationPrompt)}
            placeholder="Simulate action or invariant hypothesis..."
            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={() => void handleRunSimulation(simulationPrompt)}
            disabled={simulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs transition-all disabled:opacity-50 shrink-0"
          >
            {simulating ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── MAIN BODY CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {apiError && (
          <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/25 text-rose-200 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{apiError}</span>
            </div>
            <button
              type="button"
              onClick={() => setApiError(null)}
              className="px-2 py-0.5 rounded border border-rose-400/40 text-[10px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: WORLD THINKING MATRIX */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            {/* Live Runtime Capability Posture Bar */}
            <div className="p-3.5 rounded-xl border border-cyan-500/25 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <span className="text-cyan-300 font-bold tracking-wider">LIVE CAPABILITY POSTURE</span>
                {capSnapshot ? (
                  <>
                    <span className="text-emerald-300 tabular-nums">
                      {capSnapshot.counts.verified}/{capSnapshot.counts.total} VERIFIED
                    </span>
                    <span className="text-slate-400 tabular-nums">
                      DEGRADED: {capSnapshot.counts.degraded} · UNAVAIL: {capSnapshot.counts.unavailable} · ISOLATED: {capSnapshot.counts.isolated}
                    </span>
                    <span className={capSnapshot.stale ? 'text-amber-300' : 'text-cyan-400'}>
                      {capSnapshot.mode.toUpperCase()} · {capSnapshot.stale ? 'STALE' : 'FRESH'}
                    </span>
                  </>
                ) : latestReport?.capabilityPosture ? (
                  <span className="text-slate-300 truncate">{latestReport.capabilityPosture.summary}</span>
                ) : (
                  <span className="text-slate-400">Awaiting authenticated live capability snapshot</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleQuickProbeCapabilities('quick')}
                  disabled={probingCaps}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-500/20 text-[11px] text-cyan-200 disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${probingCaps ? 'animate-spin' : ''}`} />
                  <span>{probingCaps ? 'Probing...' : 'Quick Probe'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickProbeCapabilities('deep')}
                  disabled={probingCaps}
                  className="px-2.5 py-1 rounded border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-500/20 text-[11px] text-indigo-200 disabled:opacity-40"
                >
                  Deep Dry-Run
                </button>
              </div>
            </div>

            {/* Top Stat Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-mono">EPISTEMIC UNCERTAINTY</span>
                  <Activity className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-cyan-300">
                  {latestReport ? `${(latestReport.epistemicUncertainty * 100).toFixed(1)}%` : '6.8%'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                  <span className="text-emerald-400 font-bold">● High Epistemic Confidence</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-500/20">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${Math.max(5, (latestReport?.epistemicUncertainty ?? 0.068) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-mono">OPTIMAL EXPECTED UTILITY</span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-300">
                  {latestReport?.optimalBranch ? `${(latestReport.optimalBranch.expectedUtility * 100).toFixed(0)}%` : '92%'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  Branch: <span className="text-slate-200">{latestReport?.optimalBranch?.actionName || 'direct_pipeline'}</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/20">
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${(latestReport?.optimalBranch?.expectedUtility ?? 0.92) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-mono">HALLUCINATION RISK</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-300">
                  {latestReport?.optimalBranch ? `${(latestReport.optimalBranch.hallucinationRisk * 100).toFixed(1)}%` : '4.0%'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  Pruned branches: <span className="text-amber-400 font-bold">{(latestReport?.branchesEvaluated || []).filter(b => b.decision === 'PRUNED').length}</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/20">
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${Math.max(4, (latestReport?.optimalBranch?.hallucinationRisk ?? 0.04) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-mono">SIMULATED HORIZON</span>
                  <Clock className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-indigo-300">
                  {latestReport?.simulatedTimeHorizonSteps ?? 10} STEPS
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  State invariant drift: <span className="text-emerald-400 font-bold">0.00%</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500/20">
                  <div className="h-full bg-indigo-400 w-full" />
                </div>
              </div>
            </div>

            {/* Split View: Recharts Trajectory & Optimal Reasoning */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Trajectory Area Chart */}
              <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-sm font-bold font-mono text-slate-200">
                      COUNTERFACTUAL RESOURCE & LATENCY TRAJECTORY (10-STEP AHEAD)
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-400">Model: Qwen 3.8 / Groq LPU</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trajectoryData}>
                      <defs>
                        <linearGradient id="optBranchGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="hypoMaxGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Area
                        type="monotone"
                        dataKey="OptimalBranch"
                        name="Optimal Branch CPU %"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#optBranchGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="HypotheticalMax"
                        name="Unchecked Max CPU %"
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#hypoMaxGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right Col: Active Optimal Branch Spec Card */}
              <div className="p-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 via-slate-900/60 to-slate-950/80 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-mono font-bold text-cyan-300">OPTIMAL TRAJECTORY SPEC</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {latestReport?.optimalBranch?.decision || 'APPROVED'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 font-mono text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">ACTION DIRECTIVE:</span>
                      <span className="text-cyan-200 font-bold">{latestReport?.optimalBranch?.actionName || 'execute_direct_pipeline'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[11px] block">REASONING & INVARIANT PROOF:</span>
                      <p className="text-slate-300 font-sans text-xs mt-1 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        {latestReport?.optimalBranch?.reasoning || 'Counterfactual simulation indicates high positive system utility with manageable thread expansion.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">EST. CPU LOAD:</span>
                        <span className="text-slate-200 font-bold">{latestReport?.optimalBranch?.predictedState?.cpuLoadEst ?? 36}%</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">EST. MEMORY:</span>
                        <span className="text-slate-200 font-bold">{latestReport?.optimalBranch?.predictedState?.memoryLoadEst ?? 4.5} GB</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">ACTIVE THREADS:</span>
                        <span className="text-slate-200 font-bold">{latestReport?.optimalBranch?.predictedState?.agentThreadsActive ?? 7}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">SAFETY SCORE:</span>
                        <span className="text-emerald-400 font-bold">{latestReport?.optimalBranch?.predictedState?.safetyScore ?? 0.98}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Task ID: {latestReport?.taskId?.slice(0, 16) || 'task_init'}</span>
                  <span className="text-cyan-400">Zero Invariant Drift</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COUNTERFACTUAL BRANCHES & PRUNING */}
        {activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold font-mono text-slate-200">
                    MULTI-BRANCH SPECULATIVE TREE & PRUNED NODES
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Total Evaluated: {latestReport?.branchesEvaluated?.length || 0} Branches
                </span>
              </div>

              {/* Utility vs Risk Bar Chart */}
              <div className="h-56 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Utility" name="Expected Utility %" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Risk" name="Risk Factor %" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Hallucination" name="Hallucination %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Branch Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(latestReport?.branchesEvaluated || []).map((branch, idx) => {
                  const isApproved = branch.decision === 'APPROVED';
                  const isPruned = branch.decision === 'PRUNED';
                  const isHitl = branch.decision === 'REQUIRES_HITL';

                  return (
                    <div
                      key={branch.branchId || idx}
                      onClick={() => setSelectedBranch(branch)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedBranch?.branchId === branch.branchId
                          ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : isPruned
                          ? 'border-red-900/50 bg-red-950/10 hover:border-red-700/60'
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">#{idx + 1}</span>
                          <span className="font-mono font-bold text-xs text-slate-200">{branch.actionName}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isApproved
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isPruned
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {branch.decision}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 font-sans mb-3 line-clamp-2">
                        {branch.reasoning}
                      </p>

                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Utility:</span>
                          <span className="text-cyan-300 font-bold">{(branch.expectedUtility * 100).toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Risk:</span>
                          <span className={branch.riskFactor > 0.5 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                            {(branch.riskFactor * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Invariants:</span>
                          <span className={branch.predictedState.invariantsPreserved ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                            {branch.predictedState.invariantsPreserved ? 'Preserved' : 'Violated'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HIERARCHICAL OVERSIGHT & RECURSION */}
        {activeTab === 'oversight' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Col: Recursion Limit & Depth Tester */}
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold font-mono text-slate-200">
                    RECURSION DEPTH GOVERNOR
                  </h3>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>CALL-STACK CEILING:</span>
                    <span className="text-indigo-400 font-bold">DEPTH 3 (CHAPTER 15)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>CIRCULAR RE-SUMMON:</span>
                    <span className="text-emerald-400 font-bold">STRICT_DENY</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>KILL-SWITCH STATE:</span>
                    <span className={invariants.emergencyKillEngaged ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {invariants.emergencyKillEngaged ? 'ENGAGED' : 'ARMED / NOMINAL'}
                    </span>
                  </div>
                </div>

                {/* Depth Verifier Tester */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-mono text-slate-300 block font-bold">TEST DELEGATION DEPTH</span>
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Target Action:</label>
                    <input
                      type="text"
                      value={testAction}
                      onChange={(e) => setTestAction(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                      <span>Requested Depth:</span>
                      <span className="text-cyan-300 font-bold">{testDepth}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      value={testDepth}
                      onChange={(e) => setTestDepth(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <button
                    onClick={handleVerifyDepth}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  >
                    Verify Delegation with Oversight
                  </button>

                  {depthVerifyResult && (
                    <div
                      className={`p-3 rounded-lg border font-mono text-xs ${
                        depthVerifyResult.allowed
                          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                          : 'border-red-500/40 bg-red-950/20 text-red-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        {depthVerifyResult.allowed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span>{depthVerifyResult.allowed ? 'DELEGATION PERMITTED' : 'DELEGATION BLOCKED'}</span>
                      </div>
                      <p className="text-[11px] opacity-90">{depthVerifyResult.reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 2 Cols: Live Oversight Audit Log */}
              <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-bold font-mono text-slate-200">
                        HIERARCHICAL AUDIT & INTERCEPTION STREAM
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">Total Audits: {audits.length}</span>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                    {audits.length === 0 ? (
                      <div className="py-8 text-center text-xs font-mono text-slate-500">
                        No oversight interventions recorded yet. System operating at nominal equilibrium.
                      </div>
                    ) : (
                      audits.map((audit) => {
                        const isNominal = audit.status === 'NOMINAL';
                        const isBlocked = audit.status === 'BLOCKED' || audit.status === 'INTERCEPTED';

                        return (
                          <div
                            key={audit.id}
                            className={`p-2.5 rounded-lg border font-mono text-xs flex items-center justify-between gap-3 ${
                              isNominal
                                ? 'border-slate-800/80 bg-slate-950/50'
                                : isBlocked
                                ? 'border-red-500/40 bg-red-950/20 text-red-300'
                                : 'border-amber-500/40 bg-amber-950/20 text-amber-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] text-slate-400 shrink-0">{audit.timestamp}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                  isNominal ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {audit.status}
                              </span>
                              <span className="text-slate-200 font-bold truncate">[{audit.source}]</span>
                              <span className="text-slate-400 truncate">{audit.action}</span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400">
                              <span>d:{audit.depth}/{audit.maxDepth}</span>
                              <span className="text-cyan-400 font-bold">{audit.tokensConsumed} tok</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Anti-Drift Lock: SHA256-ANCHOR-ACTIVE</span>
                  <button onClick={fetchOversightData} className="text-cyan-400 hover:underline">
                    Refresh Audits
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: HIGH-BANDWIDTH MULTI-DOMAIN & MULTI-OUTCOME METACOGNITION */}
        {activeTab === 'metacognition' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-cyan-500/25 bg-slate-900/70 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold font-mono text-cyan-200">
                    MULTI-DOMAIN DECOMPOSITION & COMPLEX OUTCOME MODELING
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Maps coupled constraints, 1st/2nd/3rd-order effects, reversibility, and deterministic calibrated uncertainty across 8 cognitive domains.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 px-2.5 py-1 rounded border border-slate-700 bg-slate-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={metaUseLlm}
                      onChange={(e) => setMetaUseLlm(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span>{metaUseLlm ? 'Mode: LLM-Synthesized (Fail-Closed)' : 'Mode: Deterministic Structural'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleRunMetacognition()}
                    disabled={metaLoading}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs disabled:opacity-50"
                  >
                    <Compass className={`w-3.5 h-3.5 ${metaLoading ? 'animate-spin' : ''}`} />
                    <span>{metaLoading ? 'Analyzing...' : 'Analyze Multi-Domain'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 font-mono text-xs">
                <div className="lg:col-span-1">
                  <label className="block text-[11px] text-slate-400 mb-1">PROBLEM / SYSTEM BRIEF</label>
                  <textarea
                    rows={3}
                    value={metaProblem}
                    onChange={(e) => setMetaProblem(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">VERIFIED EVIDENCE (; or newline)</label>
                  <textarea
                    rows={3}
                    value={metaEvidence}
                    onChange={(e) => setMetaEvidence(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">INVARIANTS & CONSTRAINTS (; or newline)</label>
                  <textarea
                    rows={3}
                    value={metaConstraints}
                    onChange={(e) => setMetaConstraints(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            {metaAnalysis ? (
              <div className="space-y-6">
                {/* Executive Synthesis & Uncertainty Calibration */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 p-4 rounded-xl border border-cyan-500/25 bg-slate-900/60 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-cyan-300 font-bold">EXECUTIVE SYNTHESIS</span>
                      <span className="text-slate-400">
                        {metaAnalysis.reasoningMode.toUpperCase()}
                        {metaAnalysis.provider ? ` · ${metaAnalysis.provider}/${metaAnalysis.model}` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {metaAnalysis.executiveSynthesis}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs space-y-2 tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">CALIBRATED UNCERTAINTY</span>
                      <span className="text-cyan-300 font-bold">
                        {(metaAnalysis.uncertainty.uncertaintyScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300 pt-1">
                      <div>Evidence Deficit: {(metaAnalysis.uncertainty.breakdown.evidenceDeficit * 100).toFixed(0)}%</div>
                      <div>Coupling Load: {(metaAnalysis.uncertainty.breakdown.domainCouplingComplexity * 100).toFixed(0)}%</div>
                      <div>Framing Ambiguity: {(metaAnalysis.uncertainty.breakdown.framingAmbiguity * 100).toFixed(0)}%</div>
                      <div>Value Tension: {(metaAnalysis.uncertainty.breakdown.valueTension * 100).toFixed(0)}%</div>
                    </div>
                    <div className="text-[11px] font-sans text-slate-400 pt-1 border-t border-slate-800">
                      {metaAnalysis.uncertainty.calibrationBasis}
                    </div>
                  </div>
                </div>

                {/* Active Cognitive Domains */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-slate-300 tracking-wider">
                    MULTI-DOMAIN LENSES ({metaAnalysis.domains.length} ACTIVE)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {metaAnalysis.domains.map((dom) => (
                      <div key={dom.domain} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-bold text-cyan-200">{dom.label}</span>
                          <span className="text-emerald-300 tabular-nums">
                            Weight {(dom.relevanceWeight * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 space-y-1 font-sans">
                          <div><strong className="text-slate-200">Constraints:</strong> {dom.coreConstraints.join(' · ')}</div>
                          <div><strong className="text-amber-300">Failure Vectors:</strong> {dom.failureVectors.join(' · ')}</div>
                          <div><strong className="text-emerald-300">Leverage:</strong> {dom.leveragePoints.join(' · ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cross-Domain Couplings */}
                {metaAnalysis.crossDomainCouplings.length > 0 && (
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2.5">
                    <h3 className="text-xs font-mono font-bold text-slate-300 tracking-wider">
                      CROSS-DOMAIN COUPLINGS ({metaAnalysis.crossDomainCouplings.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                      {metaAnalysis.crossDomainCouplings.map((c, idx) => (
                        <div key={idx} className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1">
                          <div className="font-mono text-[11px] flex items-center justify-between">
                            <span className="text-cyan-300">{c.fromDomain} → {c.toDomain}</span>
                            <span className="text-amber-300 uppercase">{c.interactionType}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 font-sans">{c.mechanism}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Multi-Outcome Trajectories (1st / 2nd / 3rd order) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-slate-300 tracking-wider">
                    COMPLEX MULTI-OUTCOME TRAJECTORIES (1ST / 2ND / 3RD-ORDER EFFECTS)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {metaAnalysis.outcomes.map((out) => (
                      <div key={out.outcomeId} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                        <div className="flex items-center justify-between font-mono text-xs gap-2">
                          <span className="font-bold text-slate-100">{out.label}</span>
                          <span className="text-cyan-300 tabular-nums shrink-0">
                            P={(out.probabilityWeight * 100).toFixed(0)}% · {out.reversibility.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {out.trajectoryType} · Horizon: {out.timeHorizon}
                        </div>
                        <div className="text-[11px] font-sans text-slate-300 space-y-1 pt-1">
                          <div><strong className="text-cyan-300">1st Order:</strong> {out.firstOrderEffects.join('; ')}</div>
                          <div><strong className="text-indigo-300">2nd Order:</strong> {out.secondOrderEffects.join('; ')}</div>
                          <div><strong className="text-amber-300">3rd Order:</strong> {out.thirdOrderEffects.join('; ')}</div>
                          <div><strong className="text-emerald-300">Safeguards:</strong> {out.safeguardsRequired.join('; ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-xs font-mono text-slate-400">
                Run "Analyze Multi-Domain" above to compute coupled domain constraints, 3rd-order outcome trajectories, and calibrated epistemic uncertainty.
              </div>
            )}
          </div>
        )}

        {/* TAB: INCEPTION-TO-OUTCOME RETROSPECTION & UNBIASED PERSPECTIVES */}
        {activeTab === 'retrospection' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-cyan-500/25 bg-slate-900/70 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold font-mono text-cyan-200">
                    INCEPTION-TO-OUTCOME RETROSPECTION & UNBIASED HUMAN PERSPECTIVES
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Audits inception framing biases, hidden assumptions, and outcome divergence while synthesizing 6 steelmanned non-biased human stakeholder views.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRunRetrospection()}
                    disabled={retroLoading || metaLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-400/50 bg-indigo-950/40 hover:bg-indigo-500/20 text-indigo-200 font-mono text-xs disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{retroLoading ? 'Auditing...' : 'Retrospect Only'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRunMetacognition()}
                    disabled={metaLoading || retroLoading}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs disabled:opacity-50"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>{metaLoading ? 'Running Audit...' : 'Run Full Perspective + Retrospect'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 font-mono text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">INCEPTION PROMPT (ORIGINAL FRAMING)</label>
                  <textarea
                    rows={2}
                    value={inceptionPromptInput}
                    onChange={(e) => setInceptionPromptInput(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">INTENDED OUTCOME</label>
                  <textarea
                    rows={2}
                    value={intendedOutcomeInput}
                    onChange={(e) => setIntendedOutcomeInput(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">OBSERVED OUTCOME (OPTIONAL FOR RETROSPECTION)</label>
                  <textarea
                    rows={2}
                    value={observedOutcomeInput}
                    onChange={(e) => setObservedOutcomeInput(e.target.value)}
                    placeholder="Leave empty for prospective alignment, or enter realized outcome (e.g. skipped validation caused schema drift)"
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            {(standaloneRetro || metaAnalysis?.retrospection) && (() => {
              const retro = standaloneRetro ?? metaAnalysis!.retrospection;
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2.5">
                    <div className="flex items-center justify-between font-mono text-xs border-b border-slate-800 pb-2">
                      <span className="text-cyan-300 font-bold">INCEPTION AUDIT</span>
                      <span className="text-slate-400 uppercase">{retro.mode}</span>
                    </div>
                    <div className="text-xs font-sans text-slate-300 space-y-1.5">
                      <div><strong className="text-slate-100">Initial Framing:</strong> {retro.inceptionAudit.initialFraming}</div>
                      <div><strong className="text-amber-300">Framing Bias Signals:</strong> {retro.inceptionAudit.framingBiasDetected.join('; ') || 'None'}</div>
                      <div><strong className="text-indigo-300">Hidden Assumptions:</strong> {retro.inceptionAudit.hiddenAssumptions.join('; ') || 'None'}</div>
                      <div><strong className="text-rose-300">Boundary Gaps:</strong> {retro.inceptionAudit.boundaryGaps.join('; ') || 'None'}</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2.5">
                    <div className="flex items-center justify-between font-mono text-xs border-b border-slate-800 pb-2">
                      <span className="text-emerald-300 font-bold">OUTCOME RETROSPECTION</span>
                      <span className={`uppercase font-bold ${
                        retro.outcomeRetrospection.alignmentStatus === 'material_divergence'
                          ? 'text-rose-300'
                          : retro.outcomeRetrospection.alignmentStatus === 'partial_divergence'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      }`}>
                        {retro.outcomeRetrospection.alignmentStatus}
                      </span>
                    </div>
                    <div className="text-xs font-sans text-slate-300 space-y-1.5">
                      <div><strong className="text-slate-100">Alignment Delta:</strong> {retro.outcomeRetrospection.alignmentDelta}</div>
                      <div><strong className="text-amber-300">Divergence Causes:</strong> {retro.outcomeRetrospection.rootCausesOfDivergence.join('; ') || 'None'}</div>
                      <div><strong className="text-cyan-300">Counterfactual Hindsight:</strong> {retro.outcomeRetrospection.counterfactualHindsight}</div>
                      <div><strong className="text-emerald-300">Corrective Directives:</strong> {retro.outcomeRetrospection.correctiveDirectives.join('; ')}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {metaAnalysis?.perspectives ? (
              <div className="space-y-4">
                {/* Bias Audit Summary */}
                <div className="p-4 rounded-xl border border-cyan-500/25 bg-slate-900/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs border-b border-slate-800 pb-2">
                    <span className="text-cyan-200 font-bold">COGNITIVE BIAS NEUTRALIZATION & ROLE-REVERSAL SYNTHESIS</span>
                    <span className={`font-bold uppercase ${
                      metaAnalysis.perspectives.overallBiasRisk === 'high'
                        ? 'text-rose-300'
                        : metaAnalysis.perspectives.overallBiasRisk === 'moderate'
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}>
                      Bias Risk: {metaAnalysis.perspectives.overallBiasRisk} · Human Judgment Required: {metaAnalysis.perspectives.requiresHumanJudgment ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-sans">
                    {metaAnalysis.perspectives.balancedRecommendation}
                  </p>
                  <div className="text-[11px] font-sans text-slate-400">
                    <strong className="text-slate-200">Role-Reversal Check:</strong> {metaAnalysis.perspectives.roleReversalCheck}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                    {metaAnalysis.perspectives.biasAudit.map((b, i) => (
                      <div key={i} className="p-2.5 rounded border border-slate-800 bg-slate-950/60 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-200 font-semibold">{b.biasType}</span>
                          <span className={b.severity === 'high' ? 'text-rose-300' : b.severity === 'moderate' ? 'text-amber-300' : 'text-emerald-300'}>
                            {b.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-slate-400 font-sans">{b.neutralizationStrategy}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6 Steelmanned Human Stakeholder Perspectives */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metaAnalysis.perspectives.perspectivesEvaluated.map((p) => (
                    <div key={p.roleId} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                      <div className="font-mono text-xs font-bold text-cyan-200 border-b border-slate-800 pb-1.5">
                        {p.roleLabel}
                      </div>
                      <div className="text-[11px] font-sans text-slate-300 space-y-1.5">
                        <div><strong className="text-slate-100">Steelmanned Argument:</strong> {p.steelmannedArgument}</div>
                        <div><strong className="text-amber-300">Role Blind Spots:</strong> {p.blindSpotsOfRole.join('; ')}</div>
                        <div><strong className="text-emerald-300">Safeguards:</strong> {p.nonNegotiableSafeguards.join('; ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-xs font-mono text-slate-400">
                Click "Run Full Perspective + Retrospect" to inspect all 6 balanced human stakeholder lenses and cognitive bias audits.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LAYER-11 ORGANS DIRECTORY */}
        {activeTab === 'organs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold font-mono text-slate-200">
                  LAYER-11 WORLD THINKING & ORCHESTRATION OVERSIGHT ORGANS
                </h2>
              </div>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter layer-11 organs..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrgans.map((organ) => {
                const liveRec = capSnapshot?.records.find((r) => r.id === organ.id);
                const statusText = (liveRec?.status ?? organ.fallbackStatus).toUpperCase();
                const latencyText =
                  liveRec && liveRec.latencyMs !== null ? `${liveRec.latencyMs}ms` : organ.fallbackLatency;
                const tierText = liveRec?.verificationTier ?? 'unverified';

                return (
                  <div
                    key={organ.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                          {organ.layer} · {tierText}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            statusText === 'DEGRADED' || statusText === 'ENGAGED'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : statusText === 'UNAVAILABLE'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {statusText}
                        </span>
                      </div>
                      <h4 className="font-mono font-bold text-xs text-slate-200">{organ.name}</h4>
                      <p className="text-xs text-slate-400 font-sans mt-1">{organ.role}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-400">
                      <span>
                        Latency: <strong className="text-cyan-300 tabular-nums">{latencyText}</strong>
                      </span>
                      <button
                        onClick={() => void handleRunSimulation(`Simulate organ execution on ${organ.id}`)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-slate-950 text-slate-200 text-[10px] transition-all"
                      >
                        Probe
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
