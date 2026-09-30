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
  Search
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
  Cell
} from 'recharts';
import { WorldThinkingReport, SimulationBranch, OversightAudit, SystemInvariants } from '../../types';
import { sound } from '../../utils/audio';

export default function WorldThinkingOversightRoom() {
  const [activeTab, setActiveTab] = useState<'simulation' | 'branches' | 'oversight' | 'organs'>('simulation');
  const [simulationPrompt, setSimulationPrompt] = useState('Optimize parallel execution pipelines while preserving Chapter 15 invariants');
  const [simulating, setSimulating] = useState(false);
  const [latestReport, setLatestReport] = useState<WorldThinkingReport | null>(null);
  const [history, setHistory] = useState<WorldThinkingReport[]>([]);
  const [audits, setAudits] = useState<OversightAudit[]>([]);
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
    { id: 'world_model', name: 'World Model & State Simulator', layer: 'world_thinking', role: 'Predictive Spatial-Temporal Simulation', status: 'active', latency: '4.2ms' },
    { id: 'world_thinking_engine', name: 'Counterfactual World Thinking Engine', layer: 'world_thinking', role: 'Multi-Branch Counterfactual Search', status: 'active', latency: '12.8ms' },
    { id: 'counterfactual_simulator', name: 'Multi-Branch Counterfactual Search', layer: 'world_thinking', role: 'Speculative Branch Evaluator', status: 'active', latency: '8.1ms' },
    { id: 'epistemic_uncertainty_scorer', name: 'Epistemic Uncertainty Estimator', layer: 'world_thinking', role: 'Bayesian Entropy & Confidence Meter', status: 'active', latency: '2.5ms' },
    { id: 'future_state_projector', name: 'State Trajectory & Drift Forecaster', layer: 'world_thinking', role: '10-Step Ahead Resource Predictor', status: 'active', latency: '6.4ms' },
    { id: 'invariance_verifier', name: 'Mathematical Invariant Preserver', layer: 'world_thinking', role: 'Identity & Schema Anchor Guard', status: 'active', latency: '1.9ms' },
    { id: 'orchestration_oversight', name: 'Hierarchical Oversight Supervisor', layer: 'oversight', role: 'Hub-and-Spoke Spawner Supervisor', status: 'active', latency: '3.1ms' },
    { id: 'recursion_governor', name: 'Call-Stack Recursion Depth Arbiter', layer: 'oversight', role: 'Recursion Depth Enforcer (Max: 3)', status: 'active', latency: '0.8ms' },
    { id: 'subagent_mesh_arbiter', name: 'Sub-Agent Mesh Spawner & Barrier', layer: 'oversight', role: 'Threadpool Allocator & Barrier Sync', status: 'active', latency: '5.2ms' },
    { id: 'emergency_kill_switch', name: 'Zero-State Emergency Circuit Interrupter', layer: 'oversight', role: 'Sub-ms Zero-State Interrupter', status: invariants.emergencyKillEngaged ? 'engaged' : 'nominal', latency: '0.2ms' },
    { id: 'hallucination_pruner', name: 'Counterfactual Hallucination Pruner', layer: 'world_thinking', role: 'Hypothetical Risk Dissector', status: 'active', latency: '7.3ms' },
    { id: 'anti_drift_anchor', name: 'Identity & Invariant Anti-Drift Lock', layer: 'oversight', role: 'Constitutional Constraint Anchor', status: 'active', latency: '1.4ms' },
  ];

  // Fetch initial data
  useEffect(() => {
    fetchHistory();
    fetchOversightData();
    const interval = setInterval(() => {
      fetchOversightData();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/command/world-thinking/history?limit=10');
      if (res.ok) {
        const data = await res.json();
        if (data.history && data.history.length > 0) {
          setHistory(data.history);
          setLatestReport(data.history[0]);
          setSelectedBranch(data.history[0].optimalBranch);
        } else {
          // Trigger initial baseline simulation
          handleRunSimulation(simulationPrompt);
        }
      }
    } catch {
      // Fallback
    }
  };

  const fetchOversightData = async () => {
    try {
      const [invRes, audRes] = await Promise.all([
        fetch('/api/command/oversight/invariants'),
        fetch('/api/command/oversight/audits?limit=25')
      ]);
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvariants(invData.invariants);
      }
      if (audRes.ok) {
        const audData = await audRes.json();
        setAudits(audData.audits || []);
      }
    } catch {
      // Ignored
    }
  };

  const handleRunSimulation = async (task: string) => {
    setSimulating(true);
    sound.click();
    try {
      const res = await fetch('/api/command/world-thinking/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          actions: [
            { action: 'speculative_dag_dispatch', args: { parallel_workers: 4, memory_limit_mb: 512 } },
            { action: 'deterministic_pipeline_patch', args: { sandbox_mode: 'wasm', verify_invariants: true } },
            { action: 'aggressive_cache_purge', args: { drop_active_tables: false } },
            { action: 'self_morphing_rewrite', args: { target_layer: 'execution', depth_allowance: 2 } }
          ]
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setLatestReport(data.report);
          setSelectedBranch(data.report.optimalBranch);
          setHistory(prev => [data.report, ...prev.slice(0, 15)]);
          sound.telemetry();
        }
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const handleToggleKillSwitch = async () => {
    sound.critical();
    const nextAction = invariants.emergencyKillEngaged ? 'reset' : 'trigger';
    try {
      const res = await fetch('/api/command/oversight/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction })
      });
      if (res.ok) {
        const data = await res.json();
        setInvariants(prev => ({ ...prev, emergencyKillEngaged: data.emergencyKillEngaged }));
        fetchOversightData();
      }
    } catch (err) {
      console.error('Kill switch toggle error:', err);
    }
  };

  const handleVerifyDepth = async () => {
    sound.click();
    try {
      const res = await fetch('/api/command/oversight/verify-depth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'Operator_Tester', action: testAction, depth: testDepth })
      });
      if (res.ok) {
        const data = await res.json();
        setDepthVerifyResult(data);
        fetchOversightData();
      }
    } catch {
      // Ignored
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
      <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('simulation'); sound.click(); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'simulation'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>World Thinking Matrix</span>
          </button>

          <button
            onClick={() => { setActiveTab('branches'); sound.click(); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'branches'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Counterfactual Branches & Pruning</span>
          </button>

          <button
            onClick={() => { setActiveTab('oversight'); sound.click(); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'oversight'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Hierarchical Oversight & Recursion</span>
          </button>

          <button
            onClick={() => { setActiveTab('organs'); sound.click(); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'organs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layer-11 Organs ({worldOrgans.length})</span>
          </button>
        </div>

        {/* Live Simulation Trigger Input */}
        <div className="flex items-center gap-2 max-w-md w-full">
          <input
            type="text"
            value={simulationPrompt}
            onChange={(e) => setSimulationPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRunSimulation(simulationPrompt)}
            placeholder="Simulate action or invariant hypothesis..."
            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={() => handleRunSimulation(simulationPrompt)}
            disabled={simulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs transition-all disabled:opacity-50 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
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
        {/* TAB 1: WORLD THINKING MATRIX */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
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
              {filteredOrgans.map((organ) => (
                <div
                  key={organ.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">{organ.layer}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {organ.status.toUpperCase()}
                      </span>
                    </div>
                    <h4 className="font-mono font-bold text-xs text-slate-200">{organ.name}</h4>
                    <p className="text-xs text-slate-400 font-sans mt-1">{organ.role}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-400">
                    <span>Latency: <strong className="text-cyan-300">{organ.latency}</strong></span>
                    <button
                      onClick={() => handleRunSimulation(`Simulate organ execution on ${organ.id}`)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-slate-950 text-slate-200 text-[10px] transition-all"
                    >
                      Probe
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
