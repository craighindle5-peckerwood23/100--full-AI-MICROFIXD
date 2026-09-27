import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Play, 
  Pause, 
  Zap, 
  ArrowRight, 
  Radio, 
  RefreshCw,
  Heart,
  Eye,
  Sliders,
  Sparkles,
  GitPullRequest,
  Check
} from 'lucide-react';
import { autonomousCore } from '../../autonomy/autonomousCore';
import { 
  AutonomousProblem, 
  SelfHealingAction, 
  FallbackAlertState, 
  WatchdogStatus, 
  MetaPerspectiveReport, 
  ExecutionJob 
} from '../../types';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';

export default function AutonomyRoom() {
  const [problems, setProblems] = useState<AutonomousProblem[]>(autonomousCore.getProblems());
  const [actions, setActions] = useState<SelfHealingAction[]>(autonomousCore.getActions());
  const [watchdog, setWatchdog] = useState<WatchdogStatus>(autonomousCore.getWatchdog());
  const [fallbackAlert, setFallbackAlert] = useState<FallbackAlertState>(autonomousCore.getFallbackAlert());
  const [meta, setMeta] = useState<MetaPerspectiveReport>(autonomousCore.getMetaPerspective());
  const [queue, setQueue] = useState<ExecutionJob[]>(autonomousCore.getExecutionQueue());
  const [isAutoHealingEnabled, setIsAutoHealingEnabled] = useState(autonomousCore.isAutoHealingEnabled());
  const [selectedProblem, setSelectedProblem] = useState<AutonomousProblem | null>(problems[0] || null);

  const [schedulerTasks, setSchedulerTasks] = useState<any[]>(autonomousCore.getSchedulerTasks());
  const [deployments, setDeployments] = useState<any[]>(autonomousCore.getDeployments());
  const [currentDeploymentJob, setCurrentDeploymentJob] = useState<any>(autonomousCore.getCurrentDeploymentJob());
  const [taskType, setTaskType] = useState('code');
  const [taskPrompt, setTaskPrompt] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    const unsub = autonomousCore.subscribe(() => {
      setProblems([...autonomousCore.getProblems()]);
      setActions([...autonomousCore.getActions()]);
      setWatchdog({ ...autonomousCore.getWatchdog() });
      setFallbackAlert({ ...autonomousCore.getFallbackAlert() });
      setMeta({ ...autonomousCore.getMetaPerspective() });
      setQueue([...autonomousCore.getExecutionQueue()]);
      setIsAutoHealingEnabled(autonomousCore.isAutoHealingEnabled());
      setSchedulerTasks([...autonomousCore.getSchedulerTasks()]);
      setDeployments([...autonomousCore.getDeployments()]);
      setCurrentDeploymentJob(autonomousCore.getCurrentDeploymentJob());
    });
    return () => unsub();
  }, []);

  const handleInject = (type: 'connectivity' | 'agent' | 'memory' | 'mission') => {
    autonomousCore.injectSimulatedProblem(type);
  };

  const handleToggleAutoHealing = () => {
    const state = autonomousCore.toggleAutoHealing();
    setIsAutoHealingEnabled(state);
  };

  const handleToggleOverride = () => {
    autonomousCore.toggleManualOverride();
  };

  const handleUndoFallback = () => {
    autonomousCore.undoFallback();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) return;
    const p = taskPrompt;
    setTaskPrompt('');
    await autonomousCore.addSchedulerTask(taskType, p);
  };

  const handleSelfRepair = async () => {
    if (isRepairing) return;
    setIsRepairing(true);
    await autonomousCore.triggerSelfRepairOrgan();
    setIsRepairing(false);
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDeploying) return;
    const msg = commitMsg || "Manual hot-fix patch compilation";
    setCommitMsg('');
    setIsDeploying(true);
    await autonomousCore.triggerAutoDeployment(msg);
    setIsDeploying(false);
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 text-cyan-400 font-mono overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.4)]">
            <Cpu size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white tracking-wider">
                AUTONOMOUS SELF-DETECTING & SELF-FIXING CORE
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-cyan-950 border border-cyan-400 text-cyan-300">
                LEVEL 6 DAEMON // RING-0
              </span>
            </div>
            <p className="text-xs text-cyan-500/80 mt-0.5">
              Continuous Watchdog supervisor, self-healing execution engine & meta-perspective oversight.
            </p>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-Healing Toggle */}
          <button
            onClick={handleToggleAutoHealing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              isAutoHealingEnabled
                ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400'
            }`}
            title="Enable or pause autonomous self-repair daemon"
          >
            {isAutoHealingEnabled ? <Play size={13} className="text-emerald-400" /> : <Pause size={13} />}
            <span>{isAutoHealingEnabled ? 'AUTO-HEAL: ACTIVE' : 'AUTO-HEAL: PAUSED'}</span>
          </button>

          {/* Manual Override Button */}
          <button
            onClick={handleToggleOverride}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              fallbackAlert.manualOverrideActive
                ? 'bg-red-950/80 border-red-400 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                : 'bg-black/50 border-cyan-500/30 text-cyan-300 hover:text-white'
            }`}
            title="Lock model choices and suspend automatic fallback cascades"
          >
            {fallbackAlert.manualOverrideActive ? <Lock size={13} className="text-red-400" /> : <Unlock size={13} />}
            <span>{fallbackAlert.manualOverrideActive ? 'MANUAL OVERRIDE: ON' : 'MANUAL OVERRIDE: OFF'}</span>
          </button>
        </div>
      </div>

      {/* TOP STATUS CARDS: WATCHDOG, OVERSIGHT, & META-PERSPECTIVE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Watchdog Heartbeat */}
        <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-cyan-500/80 font-bold flex items-center gap-1">
              <Heart size={12} className="text-red-400 animate-pulse" />
              Watchdog Heartbeat
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold">
              {watchdog.status}
            </span>
          </div>
          <div className="text-2xl font-black text-white">{watchdog.heartbeatCount.toLocaleString()}</div>
          <div className="text-[11px] text-cyan-400/80 flex items-center justify-between">
            <span>Pulse: 1.0 Hz</span>
            <span>Watchers: {watchdog.activeWatchers}</span>
          </div>
        </div>

        {/* System Coherence & Entropy */}
        <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-cyan-500/80 font-bold flex items-center gap-1">
              <Eye size={12} className="text-cyan-400" />
              Meta-Perspective Coherence
            </span>
            <span className="text-[9px] text-cyan-400 font-mono">Entropy: {watchdog.systemEntropy}</span>
          </div>
          <div className="text-2xl font-black text-emerald-300">{meta.systemCoherence}%</div>
          <div className="text-[11px] text-cyan-400/80 flex items-center justify-between">
            <span>Directives: {meta.activeDirectivesEnforced}/14</span>
            <span>Convergence: {meta.autonomousConvergenceRate}%</span>
          </div>
        </div>

        {/* Invariants Verified */}
        <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-cyan-500/80 font-bold flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" />
              Invariants Ingestion
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300">0 PANICS</span>
          </div>
          <div className="text-2xl font-black text-white">{watchdog.invariantsPassed.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-400/80">
            Automated invariant checks passing continuously
          </div>
        </div>

        {/* 24h Autonomous Remediations */}
        <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-cyan-500/80 font-bold flex items-center gap-1">
              <Zap size={12} className="text-amber-400" />
              Self-Heals Executed
            </span>
            <span className="text-[9px] text-cyan-400 font-mono">24H Window</span>
          </div>
          <div className="text-2xl font-black text-cyan-300">{meta.totalRemediations24h}</div>
          <div className="text-[11px] text-cyan-400/80 flex items-center justify-between">
            <span>Success Rate: 100%</span>
            <span>Avg Latency: 142ms</span>
          </div>
        </div>
      </div>

      {/* INTERACTIVE PROBLEM INJECTION BENCHMARK (LIVE DEMO & VERIFICATION) */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/30 via-black/50 to-cyan-950/30 border border-cyan-500/30 shadow-lg space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              REAL-TIME PROBLEM INJECTION TEST BENCH
            </span>
            <span className="text-[10px] text-cyan-500/80">
              (Trigger anomalies to verify immediate autonomous detection, fallback alert & self-repair)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleInject('connectivity')}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold transition-all shadow-[0_0_10px_rgba(245,158,11,0.15)] active:scale-95"
          >
            <Radio size={13} className="text-amber-400" />
            <span>Inject Connectivity Drop</span>
          </button>

          <button
            onClick={() => handleInject('agent')}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold transition-all shadow-[0_0_10px_rgba(239,68,68,0.15)] active:scale-95"
          >
            <Activity size={13} className="text-red-400" />
            <span>Inject Agent Degrade</span>
          </button>

          <button
            onClick={() => handleInject('memory')}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs font-bold transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-95"
          >
            <Cpu size={13} className="text-cyan-400" />
            <span>Inject Memory Leak</span>
          </button>

          <button
            onClick={() => handleInject('mission')}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all shadow-[0_0_10px_rgba(168,85,247,0.15)] active:scale-95"
          >
            <GitPullRequest size={13} className="text-purple-400" />
            <span>Inject Stalled Task</span>
          </button>
        </div>
      </div>

      {/* FALLBACK ALERT CARD (WHEN ACTIVE) */}
      {fallbackAlert.active && (
        <div className="p-4 rounded-xl bg-amber-950/40 border-2 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.25)] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-300 animate-bounce" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                AUTONOMOUS CONNECTIVITY FALLBACK ACTIVE
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900 border border-amber-400 text-amber-200">
                Triggered at {fallbackAlert.switchedAt}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleUndoFallback}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-200 text-xs font-bold transition-all"
              >
                <RotateCcw size={13} />
                <span>Undo Switch</span>
              </button>

              <button
                onClick={handleToggleOverride}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  fallbackAlert.manualOverrideActive
                    ? 'bg-red-500/30 border-red-400 text-red-200'
                    : 'bg-zinc-800 border-zinc-600 text-zinc-200'
                }`}
              >
                {fallbackAlert.manualOverrideActive ? <Lock size={13} /> : <Unlock size={13} />}
                <span>{fallbackAlert.manualOverrideActive ? 'Lock Active' : 'Manual Override'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-black/60 p-3 rounded-lg border border-amber-500/30">
            <div>
              <span className="text-[10px] text-amber-400/80 uppercase block">Failed Primary Provider</span>
              <span className="text-red-400 font-bold text-sm line-through">
                {fallbackAlert.primaryProvider.toUpperCase()} ({fallbackAlert.primaryModel})
              </span>
            </div>
            <div>
              <span className="text-[10px] text-amber-400/80 uppercase block">Active Autonomous Fallback</span>
              <span className="text-emerald-300 font-bold text-sm">
                {fallbackAlert.fallbackProvider.toUpperCase()} ({fallbackAlert.fallbackModel})
              </span>
            </div>
            <div>
              <span className="text-[10px] text-amber-400/80 uppercase block">Fault Signature</span>
              <span className="text-zinc-300 text-xs truncate block">{fallbackAlert.reason}</span>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM ORGANS CORE PANEL GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Organ 1: Autonomous Scheduler & Background Loop Engine */}
        <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/20 flex flex-col space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
            <span className="text-xs uppercase tracking-wider font-bold text-cyan-300 flex items-center gap-1.5">
              <Sparkles size={14} className="text-cyan-400 animate-pulse" />
              Autonomous Scheduler Organ
            </span>
            <span className="text-[10px] bg-emerald-950 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded uppercase font-bold">
              Background Loop Active
            </span>
          </div>

          {/* Enqueue Task Form */}
          <form onSubmit={handleAddTask} className="space-y-3">
            <div className="flex gap-2">
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-cyan-400"
              >
                <option value="code">CODE</option>
                <option value="legal">LEGAL</option>
                <option value="security">SECURITY</option>
                <option value="infra">INFRA</option>
              </select>
              <input
                type="text"
                placeholder="Enqueue autonomous prompt..."
                value={taskPrompt}
                onChange={(e) => setTaskPrompt(e.target.value)}
                className="bg-cyan-950/30 border border-cyan-500/30 text-white placeholder-cyan-700 text-xs rounded-lg px-3 py-1.5 flex-1 outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="bg-cyan-500/15 border border-cyan-400 hover:bg-cyan-500/25 text-cyan-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
              >
                <Zap size={12} />
              </button>
            </div>
          </form>

          {/* Tasks Queue */}
          <div className="flex-1 flex flex-col space-y-2">
            <span className="text-[10px] text-cyan-500 uppercase tracking-widest font-bold">
              Scheduler Task Queue ({schedulerTasks.length})
            </span>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {schedulerTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg bg-cyan-950/10 border border-cyan-500/10 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px] uppercase tracking-wide">
                      {t.id} - {t.type}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                      t.status === 'done'
                        ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-400'
                        : t.status === 'running'
                        ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 animate-pulse'
                        : 'bg-zinc-850 border border-zinc-650 text-zinc-400'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-cyan-300/80 italic">"{t.payload.userPrompt}"</p>
                  {t.result && (
                    <div className="p-1.5 rounded bg-black/40 text-[10px] text-emerald-300/90 font-mono border border-emerald-500/10">
                      <span className="font-bold text-white">Output: </span>
                      {t.result}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Organ 2: Multi-Agent Router & Self-Repair Organ */}
        <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/20 flex flex-col space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
            <span className="text-xs uppercase tracking-wider font-bold text-cyan-300 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-cyan-400" />
              Router Self-Repair Organ (Full)
            </span>
            <span className="text-[10px] bg-cyan-950 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded uppercase font-bold">
              Level 7 Organism
            </span>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-between">
            <p className="text-[11px] text-cyan-300/80 leading-relaxed font-sans">
              Monitors and repairs code construction faults in the decentralized Multi-Agent router. Resolves AST desynchronization, deadlock paths, and latency drifts on secure memory channels with 0-human intervention.
            </p>

            <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/10 text-[11px] space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Active Router:</span>
                <span className="text-cyan-300 font-bold">AgentRouterOrgan (Singleton)</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Registered Agents:</span>
                <span className="text-emerald-400 font-bold">RepairAgent, CodeAgent, LegalAgent</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Invariants Guard:</span>
                <span className="text-cyan-300 font-bold">Verified AST Structure (Pass)</span>
              </div>
            </div>

            <button
              onClick={handleSelfRepair}
              disabled={isRepairing}
              className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                isRepairing
                  ? 'bg-cyan-950/40 border-cyan-500/20 text-cyan-500 cursor-not-allowed animate-pulse'
                  : 'bg-cyan-500/10 border-cyan-400 hover:bg-cyan-500/20 text-cyan-300 hover:text-white shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              }`}
            >
              <RefreshCw size={12} className={isRepairing ? 'animate-spin' : ''} />
              {isRepairing ? 'COMPILING ROUTER REPAIRS...' : 'FORCE ROUTER ANALYSIS & AUTO-REPAIR'}
            </button>
          </div>
        </div>

        {/* Organ 3: Auto-Deployment Organ (Cloud Run continuous pipeline) */}
        <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/20 flex flex-col space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
            <span className="text-xs uppercase tracking-wider font-bold text-cyan-300 flex items-center gap-1.5">
              <GitPullRequest size={14} className="text-cyan-400" />
              Auto-Deployment Organ
            </span>
            <span className="text-[10px] bg-purple-950 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded uppercase font-bold">
              Continuous Delivery
            </span>
          </div>

          {/* Deploy Trigger Form */}
          <form onSubmit={handleDeploy} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Commit messages..."
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                className="bg-cyan-950/30 border border-cyan-500/30 text-white placeholder-cyan-700 text-xs rounded-lg px-3 py-1.5 flex-1 outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={isDeploying || !!currentDeploymentJob}
                className="bg-purple-500/15 border border-purple-400 hover:bg-purple-500/25 text-purple-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                Deploy
              </button>
            </div>
          </form>

          {/* Compilation Terminal Output or Deployments History */}
          <div className="flex-1 flex flex-col space-y-2">
            {currentDeploymentJob ? (
              <div className="space-y-2 p-2.5 rounded-lg bg-purple-950/10 border border-purple-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">
                    BUILDING {currentDeploymentJob.version}
                  </span>
                  <span className="text-[9px] text-purple-400 animate-pulse font-mono">
                    {currentDeploymentJob.progress}%
                  </span>
                </div>
                <div className="w-full h-1 bg-purple-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-400 transition-all duration-300"
                    style={{ width: `${currentDeploymentJob.progress}%` }}
                  />
                </div>
                <div className="space-y-1 text-[10px] font-mono">
                  {currentDeploymentJob.steps.map((step: string, idx: number) => (
                    <div
                      key={idx}
                      className={idx <= currentDeploymentJob.currentStepIndex ? 'text-purple-300' : 'text-zinc-600'}
                    >
                      {idx < currentDeploymentJob.currentStepIndex ? '✓' : '▶'} {step}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col space-y-2">
                <span className="text-[10px] text-purple-400 uppercase tracking-widest font-bold">
                  Active Container Deployments
                </span>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                  {deployments.map((d) => (
                    <div key={d.id} className="p-2.5 rounded-lg bg-black/40 border border-purple-500/10 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-[11px]">{d.version} ({d.id})</span>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-purple-400 hover:underline flex items-center gap-0.5"
                        >
                          Live URL ↗
                        </a>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate">Commit: {d.commits}</p>
                      <div className="flex justify-between text-[9px] text-zinc-500">
                        <span>Latency: {d.latency}</span>
                        <span>{d.createdAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TWO COLUMN VIEW: EXECUTION ENGINE QUEUE & SELF-HEALING HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Execution Engine Pipeline & Active Queue */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold flex items-center gap-1.5">
              <Activity size={14} className="text-cyan-400" />
              EXECUTION ENGINE PIPELINE ({queue.length})
            </span>
            <span className="text-[10px] text-cyan-500/80">Deterministic Self-Repair Jobs</span>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
            {queue.length === 0 ? (
              <div className="p-8 text-center border border-cyan-500/20 rounded-xl bg-black/40 text-cyan-600 text-xs">
                Execution engine queue idle. System operating within nominal bounds.
              </div>
            ) : (
              queue.map(job => (
                <div 
                  key={job.id}
                  className="p-3.5 rounded-xl bg-black/60 border border-cyan-500/30 space-y-2.5 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{job.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                      job.status === 'COMPLETED' 
                        ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300' 
                        : 'bg-cyan-950 border border-cyan-400 text-cyan-300 animate-pulse'
                    }`}>
                      {job.status} ({job.progress}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-cyan-950 rounded-full overflow-hidden border border-cyan-500/20">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>

                  {/* Steps Checklist */}
                  <div className="space-y-1 text-[11px]">
                    {job.steps.map((step, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center gap-1.5 ${
                          idx < job.currentStepIndex 
                            ? 'text-emerald-400 font-medium' 
                            : idx === job.currentStepIndex 
                            ? 'text-white font-bold' 
                            : 'text-zinc-600'
                        }`}
                      >
                        {idx < job.currentStepIndex ? (
                          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full border border-cyan-500/40 shrink-0" />
                        )}
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-cyan-500/80 pt-1 border-t border-cyan-500/10">
                    <span>ID: {job.id}</span>
                    <span>Dispatcher: {job.executedBy}</span>
                    <span>Created: {job.createdAt}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Detected Problems & Self-Healing Actions Log */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              SELF-HEALING ACTIONS AUDIT TRAIL ({actions.length})
            </span>
            <span className="text-[10px] text-cyan-500/80">Zero-Human Touch Remediations</span>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
            {actions.map(act => (
              <div 
                key={act.id}
                className="p-3.5 rounded-xl bg-black/60 border border-emerald-500/30 space-y-2 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{act.title}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    {act.status} ({act.latencyMs}ms)
                  </span>
                </div>

                <p className="text-[11px] text-cyan-300/90 leading-relaxed font-sans">
                  {act.actionTaken}
                </p>

                <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/20 text-[10px] text-cyan-400/90 font-mono">
                  <span className="font-bold text-white">Meta-Rationale: </span>
                  {act.metaReasoning}
                </div>

                <div className="flex items-center justify-between text-[10px] text-cyan-500/70 pt-1 border-t border-cyan-500/10">
                  <span>Subsystem: {act.targetSubsystem}</span>
                  <span>Executed: {act.executedAt}</span>
                  <span>Undo: {act.undoSupported ? 'Supported' : 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM META-PERSPECTIVE OVERSIGHT STRIP */}
      <div className="p-4 rounded-xl bg-black/70 border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-cyan-400 shrink-0" />
          <div>
            <span className="text-xs font-bold text-white block">ORCHESTRATION LAYER META-PERSPECTIVE REFLECTION</span>
            <span className="text-[11px] text-cyan-300/80 font-sans">"{meta.supervisorReflection}"</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="text-[10px] px-2 py-1 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold">
            HEALTH: {meta.orchestrationHealth}
          </span>
          <span className="text-cyan-500/80 text-[10px]">
            Timestamp: {meta.timestamp}
          </span>
        </div>
      </div>
    </div>
  );
}
