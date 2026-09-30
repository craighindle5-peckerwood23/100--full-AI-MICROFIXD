import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  KeyRound, 
  ShieldCheck, 
  ShieldAlert, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Layers, 
  Users, 
  Zap, 
  Terminal, 
  Lock, 
  Unlock, 
  UserCheck, 
  Cpu, 
  Sparkles,
  ArrowRight,
  GitBranch
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';

export interface DualKeyData {
  systemCheckPassed: boolean;
  systemCheckTimestamp?: number;
  systemCheckScore?: number;
  systemCheckDetails?: {
    paragonPassed: boolean;
    schemaIntegrityPassed: boolean;
    antiDriftPassed: boolean;
    organsHealthy: boolean;
  };
  humanApproved: boolean;
  humanApprover?: string;
  humanApprovalTimestamp?: number;
  isDualKeyAuthorized: boolean;
  expiresAt?: number;
}

export default function DualKeyPipelineManager() {
  const [dualKey, setDualKey] = useState<DualKeyData>({
    systemCheckPassed: false,
    humanApproved: false,
    isDualKeyAuthorized: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineTask, setPipelineTask] = useState('Execute multi-agent pipeline building, schema verification, and system updates');
  const [pipelineLogs, setPipelineLogs] = useState<any>(null);
  const [operatorName, setOperatorName] = useState('Lead Operator (You)');

  const fetchDualKeyStatus = async () => {
    try {
      const res = await fetch('/api/agents/dual-key');
      const data = await res.json();
      if (data?.dualKey) setDualKey(data.dualKey);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchDualKeyStatus();
    const interval = setInterval(fetchDualKeyStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRunSystemCheck = async () => {
    sound.playCognitivePulse();
    setIsLoading(true);
    try {
      const res = await fetch('/api/agents/dual-key/system-check', { method: 'POST' });
      const data = await res.json();
      if (data?.dualKey) {
        setDualKey(data.dualKey);
        sound.playSuccess();
        if (voice.isEnabled()) {
          voice.speak("Step 1 System Diagnostic Check complete. Key 1 engaged. Awaiting human operator approval.");
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantHumanApproval = async () => {
    sound.playWarp();
    setIsLoading(true);
    try {
      const res = await fetch('/api/agents/dual-key/human-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver: operatorName }),
      });
      const data = await res.json();
      if (data?.dualKey) {
        setDualKey(data.dualKey);
        sound.playSuccess();
        if (voice.isEnabled()) {
          voice.speak("Human operator signature verified. Key 2 engaged. Dual-key autonomous building bypass is active.");
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    sound.playTick();
    try {
      const res = await fetch('/api/agents/dual-key/revoke', { method: 'POST' });
      const data = await res.json();
      if (data?.dualKey) {
        setDualKey(data.dualKey);
        if (voice.isEnabled()) {
          voice.speak("Dual-key bypass revoked. Constitutional zero-trust building laws re-enforced.");
        }
      }
    } catch {}
  };

  const handleTriggerFleetPipeline = async () => {
    sound.playCognitivePulse();
    setPipelineRunning(true);
    setPipelineLogs(null);

    try {
      const res = await fetch('/api/agents/dispatch-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: pipelineTask }),
      });
      const data = await res.json();
      setPipelineLogs(data);

      if (res.ok) {
        sound.playSuccess();
        if (voice.isEnabled()) {
          voice.speak(`Fleet pipeline executed across all agents in ${data.durationMs || 450} milliseconds.`);
        }
      } else {
        if (voice.isEnabled()) {
          voice.speak("Pipeline blocked. Dual-Key Authorization is required.");
        }
      }
    } catch (err: any) {
      setPipelineLogs({ error: err?.message || String(err) });
    } finally {
      setPipelineRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 font-mono text-cyan-400">
      {/* Dual-Key Protocol Status Strip */}
      <div className={`p-4 rounded-2xl border transition-all ${
        dualKey.isDualKeyAuthorized
          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
          : 'bg-black/60 border-cyan-500/30'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              dualKey.isDualKeyAuthorized
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-400'
            }`}>
              <KeyRound size={18} className={dualKey.isDualKeyAuthorized ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wider">
                  2-STEP DUAL-KEY GOVERNANCE BYPASS PROTOCOL
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  dualKey.isDualKeyAuthorized
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {dualKey.isDualKeyAuthorized ? 'DUAL-KEY ACTIVE (SELF-BUILDING PERMITTED)' : 'ZERO-TRUST ENFORCED'}
                </span>
              </div>
              <span className="text-[10px] text-cyan-500/70">
                Rule-EV1 Override: Step 1 (System Check) + Step 2 (Human Sign-off) = Autonomous Self-Building Authorization
              </span>
            </div>
          </div>

          {dualKey.isDualKeyAuthorized && (
            <button
              onClick={handleRevoke}
              className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-xs text-red-200 font-bold transition-all"
            >
              Revoke Dual-Key Bypass
            </button>
          )}
        </div>

        {/* The 2 Keys Interactive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Key 1: System Diagnostic Check */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
            dualKey.systemCheckPassed
              ? 'bg-emerald-950/30 border-emerald-500/40'
              : 'bg-black/40 border-cyan-500/20'
          }`}>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck size={14} className={dualKey.systemCheckPassed ? 'text-emerald-400' : 'text-cyan-500'} />
                  KEY 1: SYSTEM INTEGRITY CHECK
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  dualKey.systemCheckPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-950 text-cyan-500/70'
                }`}>
                  {dualKey.systemCheckPassed ? 'PASS (100%)' : 'NOT RUN'}
                </span>
              </div>
              <p className="text-[11px] text-cyan-500/80 leading-relaxed">
                Automated Paragon Dissector audit, schema integrity, anti-drift check, and 235-organ health scan.
              </p>
            </div>

            <button
              onClick={handleRunSystemCheck}
              disabled={isLoading}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                dualKey.systemCheckPassed
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200 hover:bg-emerald-900'
                  : 'bg-cyan-500/20 border-cyan-400 text-white hover:bg-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
              }`}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>{dualKey.systemCheckPassed ? 'Re-Run System Check' : 'Execute Step 1: System Check'}</span>
            </button>
          </div>

          {/* Key 2: Human Operator Approval */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
            dualKey.humanApproved
              ? 'bg-emerald-950/30 border-emerald-500/40'
              : 'bg-black/40 border-cyan-500/20'
          }`}>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <UserCheck size={14} className={dualKey.humanApproved ? 'text-emerald-400' : 'text-cyan-500'} />
                  KEY 2: HUMAN OPERATOR APPROVAL
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  dualKey.humanApproved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-950 text-cyan-500/70'
                }`}>
                  {dualKey.humanApproved ? 'CONFIRMED' : 'PENDING'}
                </span>
              </div>
              <p className="text-[11px] text-cyan-500/80 leading-relaxed">
                Explicit cryptographic operator sign-off authorizing autonomous self-building and code patching.
              </p>
            </div>

            <button
              onClick={handleGrantHumanApproval}
              disabled={isLoading}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                dualKey.humanApproved
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200 hover:bg-emerald-900'
                  : 'bg-yellow-500/20 border-yellow-400 text-yellow-200 hover:bg-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>{dualKey.humanApproved ? 'Re-Confirm Operator Approval' : 'Grant Step 2: Operator Signature'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fleet Pipeline Builder Section */}
      <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/25 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs border-b border-cyan-500/15 pb-2.5">
          <div className="flex items-center gap-2 font-bold text-white uppercase tracking-wider">
            <Users size={15} className="text-cyan-400" />
            <span>ALL-AGENT FLEET RUN & PIPELINE BUILDING</span>
          </div>
          <span className="text-[10px] text-cyan-500/70">6 SYNTHETIC AGENTS &bull; MULTI-STAGE PIPELINE</span>
        </div>

        <div>
          <label className="text-[10px] text-cyan-500/80 block mb-1">Autonomous Fleet Pipeline Directive</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pipelineTask}
              onChange={e => setPipelineTask(e.target.value)}
              placeholder="Specify fleet pipeline objective..."
              className="flex-1 bg-black/80 border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
            />
            <button
              onClick={handleTriggerFleetPipeline}
              disabled={pipelineRunning}
              className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
                dualKey.isDualKeyAuthorized
                  ? 'bg-emerald-500/20 border-emerald-400 text-white hover:bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-cyan-500/20 border-cyan-400 text-white hover:bg-cyan-500/30'
              }`}
            >
              <Play size={13} className={pipelineRunning ? 'animate-spin' : ''} />
              <span>{pipelineRunning ? 'Building Pipeline...' : 'Run All Agents Pipeline'}</span>
            </button>
          </div>
        </div>

        {/* Pipeline Execution Output */}
        {pipelineLogs && (
          <div className="p-3 rounded-xl bg-[#030712] border border-cyan-500/20 text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold border-b border-cyan-500/15 pb-1.5">
              <span className={pipelineLogs.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                {pipelineLogs.status === 'ok' ? '✓ FLEET PIPELINE COMPLETE' : '⚠ PIPELINE HALTED'}
              </span>
              {pipelineLogs.durationMs && <span className="text-cyan-400">{pipelineLogs.durationMs}ms</span>}
            </div>

            {pipelineLogs.error ? (
              <div className="p-2 rounded bg-red-950/30 border border-red-500/30 text-red-300 text-[11px]">
                {pipelineLogs.error}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[10px]">
                {Object.entries(pipelineLogs.results || {}).map(([key, res]: [string, any]) => (
                  <div key={key} className="p-2 rounded bg-cyan-950/30 border border-cyan-500/15">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span className="uppercase">{key}</span>
                      <span className="text-emerald-400">✓</span>
                    </div>
                    <div className="text-cyan-500/70 truncate mt-0.5">{res.agent}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
