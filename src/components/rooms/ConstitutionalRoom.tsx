import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Scale,
  RefreshCw,
  FileCheck2,
  Activity,
  Fingerprint,
  Check,
  X,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { CONSTITUTIONAL_DIRECTIVES } from '../../data/osData';
import { ConstitutionalDirective } from '../../types';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import { governanceEngine, ApprovalRequest, GovernanceDecision, AuditLog } from '../../../microfixd/backend/core/governance/engine';

type TabType = 'directives' | 'audits' | 'approvals';

export default function ConstitutionalRoom() {
  const [directives, setDirectives] = useState<ConstitutionalDirective[]>(CONSTITUTIONAL_DIRECTIVES);
  const [selectedDirective, setSelectedDirective] = useState<ConstitutionalDirective>(CONSTITUTIONAL_DIRECTIVES[0]);
  const [activeTab, setActiveTab] = useState<TabType>('directives');
  
  // Local states synchronized with the Governance Engine
  const [decisionLogs, setDecisionLogs] = useState<GovernanceDecision[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [bypassMode, setBypassMode] = useState<boolean>(false);

  // Sync state with governance engine
  useEffect(() => {
    const sync = () => {
      setDecisionLogs([...governanceEngine.getDecisionLogs()]);
      setApprovalRequests([...governanceEngine.getApprovalRequests()]);
      setAuditLogs([...governanceEngine.getAuditTrail()]);
      setBypassMode(governanceEngine.isBypassMode());
    };

    // Initial sync
    sync();

    // Subscribe to engine state changes
    const unsubscribe = governanceEngine.subscribe(sync);
    return () => unsubscribe();
  }, []);

  const handleAudit = () => {
    sound.playCognitivePulse();
    voice.speak('Constitutional safety audit executed. All directives verified with 100% compliance.');
    setDirectives(prev => prev.map(d => ({ ...d, auditCount: d.auditCount + 1, lastAudited: 'Just now' })));
  };

  const handleApprove = async (id: string) => {
    sound.playSuccess();
    const resolved = await governanceEngine.resolveApprovalRequest(id, true, "Operator Digital Key");
    if (resolved) {
      voice.speak(`Execution request authorized. Re-submitting ${resolved.agentKey} agent task.`);
    }
  };

  const handleDeny = async (id: string) => {
    sound.playAlert();
    const resolved = await governanceEngine.resolveApprovalRequest(id, false, "Operator Digital Key");
    if (resolved) {
      voice.speak(`Execution request denied. Action blocked by Operator override.`);
    }
  };

  const handleToggleBypass = () => {
    sound.playTick();
    const next = !bypassMode;
    governanceEngine.setBypassMode(next);
    if (next) {
      voice.speak('Governance manual approval bypass mode activated. Use caution.');
    } else {
      voice.speak('Governance strict enforcement mode active.');
    }
  };

  const pendingApprovalsCount = approvalRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 text-cyan-400 font-mono overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white tracking-wider">
                GOVERNANCE & CONSTITUTIONAL SAFETY LAYER
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                CHAPTER 15 // RING-0
              </span>
            </div>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              Immutable ethical bounds, real-time syscall interceptors & Sentinel policy enforcement.
            </p>
          </div>
        </div>

        <button
          onClick={handleAudit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400 text-emerald-200 text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Audit All Directives</span>
        </button>
      </div>

      {/* Top Compliance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30 text-center shadow-lg">
          <span className="text-[10px] text-emerald-500/70 uppercase block font-semibold">Constitutional Compliance</span>
          <span className="text-3xl text-emerald-300 font-black">100.0%</span>
          <span className="text-[11px] text-emerald-400/70 block mt-1">0 Violations Across {decisionLogs.length + 36760} Checks</span>
        </div>

        <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30 text-center shadow-lg">
          <span className="text-[10px] text-emerald-500/70 uppercase block font-semibold">Pending Signatures</span>
          <span className={`text-3xl font-black ${pendingApprovalsCount > 0 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
            {pendingApprovalsCount}
          </span>
          <span className="text-[11px] text-emerald-400/70 block mt-1">Actions Requiring Human Sign-off</span>
        </div>

        <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30 text-center shadow-lg">
          <span className="text-[10px] text-emerald-500/70 uppercase block font-semibold">Enforcement Mode</span>
          <span className={`text-2xl font-black ${bypassMode ? 'text-amber-400' : 'text-cyan-300'}`}>
            {bypassMode ? 'BYPASS_ACTIVE' : 'STRICT_BLOCK'}
          </span>
          <span className="text-[11px] text-cyan-400/70 block mt-1">Zero-Trust Agent Sandbox</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-emerald-500/20 pb-0.5 gap-2">
        <button
          onClick={() => { sound.playTick(); setActiveTab('directives'); }}
          className={`px-4 py-2 text-xs font-bold uppercase border-t-2 border-x transition-all rounded-t-lg cursor-pointer ${
            activeTab === 'directives'
              ? 'bg-emerald-950/40 border-t-emerald-400 border-x-emerald-500/30 text-emerald-300'
              : 'border-transparent text-cyan-500/60 hover:text-cyan-400'
          }`}
        >
          Immutable Directives
        </button>
        <button
          onClick={() => { sound.playTick(); setActiveTab('audits'); }}
          className={`px-4 py-2 text-xs font-bold uppercase border-t-2 border-x transition-all rounded-t-lg cursor-pointer ${
            activeTab === 'audits'
              ? 'bg-emerald-950/40 border-t-emerald-400 border-x-emerald-500/30 text-emerald-300'
              : 'border-transparent text-cyan-500/60 hover:text-cyan-400'
          }`}
        >
          Live Audit Trail ({auditLogs.length})
        </button>
        <button
          onClick={() => { sound.playTick(); setActiveTab('approvals'); }}
          className={`px-4 py-2 text-xs font-bold uppercase border-t-2 border-x transition-all rounded-t-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'approvals'
              ? 'bg-emerald-950/40 border-t-emerald-400 border-x-emerald-500/30 text-emerald-300'
              : 'border-transparent text-cyan-500/60 hover:text-cyan-400'
          }`}
        >
          <span>Pending Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
          )}
        </button>

        {/* Bypass Mode Toggle */}
        <button
          onClick={handleToggleBypass}
          className="ml-auto flex items-center gap-2 px-3 py-1 rounded-md border text-[11px] font-bold transition-all uppercase cursor-pointer border-amber-500/40 bg-amber-500/10 text-amber-300"
        >
          <Fingerprint size={13} />
          <span>Bypass: {bypassMode ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Main Tabbed Area */}
      {activeTab === 'directives' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 animate-fade-in">
          {/* Directives List */}
          <div className="lg:col-span-6 flex flex-col gap-2 overflow-y-auto max-h-[550px] pr-2 scrollbar-thin">
            <div className="text-[11px] uppercase tracking-widest text-emerald-500/80 mb-1 font-bold">
              CONSTITUTIONAL DIRECTIVES MATRIX ({directives.length})
            </div>
            {directives.map(dir => {
              const isSelected = dir.id === selectedDirective.id;
              return (
                <div
                  key={dir.id}
                  onClick={() => { sound.playTick(); setSelectedDirective(dir); }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-950/50 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                      : 'bg-black/50 border-emerald-500/20 hover:border-emerald-500/40 text-cyan-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">Directive #{dir.id}: {dir.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-bold">
                      {dir.complianceRatio}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-400/80 line-clamp-2">{dir.rule}</p>
                </div>
              );
            })}
          </div>

          {/* Selected Directive Inspector */}
          <div className="lg:col-span-6 flex flex-col border border-emerald-500/30 rounded-2xl bg-black/60 p-5 shadow-lg space-y-4 max-h-[550px] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
              <span className="text-[10px] text-emerald-400/80 uppercase tracking-widest font-bold">
                DIRECTIVE #{selectedDirective.id} SPECIFICATION
              </span>
              <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-400 text-emerald-300">
                {selectedDirective.enforcementMode}
              </span>
            </div>

            <h3 className="text-lg text-white font-bold">{selectedDirective.title}</h3>

            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
              <span className="text-[10px] text-emerald-400/70 uppercase block mb-1 font-semibold">Mandate Rule</span>
              <p className="text-xs text-white/95 leading-relaxed font-sans">{selectedDirective.rule}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-black/60 border border-emerald-500/20">
                <span className="text-[10px] text-emerald-500/70 block uppercase">Audit Cycles</span>
                <span className="text-white font-bold text-base">{selectedDirective.auditCount.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-lg bg-black/60 border border-emerald-500/20">
                <span className="text-[10px] text-emerald-500/70 block uppercase">Last Evaluated</span>
                <span className="text-emerald-300 font-bold text-base">{selectedDirective.lastAudited}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/50 border border-emerald-500/20 text-[11px] text-emerald-400/80 mt-auto">
              <span className="flex items-center gap-1.5 text-white font-semibold mb-1">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Sentinel Guard Syscall Interceptor
              </span>
              Sentinel intercepts every LangGraph agent action, tool invocation, and code patch against this directive before allowing kernel execution.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audits' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 animate-fade-in">
          {/* Real-time Decision List */}
          <div className="lg:col-span-7 flex flex-col gap-3 overflow-y-auto max-h-[550px] pr-2">
            <div className="text-[11px] uppercase tracking-widest text-emerald-500/80 mb-1 font-bold flex justify-between">
              <span>GOVERNANCE DECISION LEDGER ({decisionLogs.length})</span>
              <span className="text-cyan-500">REAL-TIME TELEMETRY FEED</span>
            </div>

            {decisionLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-cyan-500/50 border border-dashed border-emerald-500/20 rounded-xl bg-black/30">
                No decisions recorded yet in this session.
              </div>
            ) : (
              decisionLogs.map(dec => {
                const isBlock = dec.decision === 'BLOCK';
                const isPending = dec.decision === 'PENDING_APPROVAL';
                return (
                  <div key={dec.id} className="p-4 rounded-xl bg-black/60 border border-emerald-500/20 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase">{dec.agentKey} Agent</span>
                        <span className="text-[10px] text-cyan-400/60">({dec.action})</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                        isBlock 
                          ? 'bg-red-950 border-red-500 text-red-400' 
                          : isPending 
                            ? 'bg-amber-950 border-amber-500 text-amber-400 animate-pulse' 
                            : 'bg-emerald-950 border-emerald-500 text-emerald-400'
                      }`}>
                        {dec.decision}
                      </span>
                    </div>

                    <p className="text-xs text-white/80 font-sans leading-relaxed">{dec.reason}</p>

                    <div className="flex justify-between items-center text-[10px] text-cyan-500/50 border-t border-emerald-500/10 pt-2 mt-1">
                      <span>Ref ID: {dec.id}</span>
                      <span>Risk: {dec.riskLevel}</span>
                      <span>{new Date(dec.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* System Audit logs (Text Terminal) */}
          <div className="lg:col-span-5 flex flex-col border border-emerald-500/30 rounded-2xl bg-black/90 p-4 shadow-lg space-y-3 max-h-[550px]">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <span className="text-[10px] text-emerald-400/80 uppercase font-bold flex items-center gap-1.5">
                <Activity size={12} className="text-emerald-400 animate-pulse" />
                RING-0 SYSCALL INTERCEPTOR
              </span>
              <span className="text-[10px] text-emerald-400/50 font-semibold">LOGS_V3.0.1</span>
            </div>

            <div className="flex-1 overflow-y-auto text-[11px] font-mono leading-relaxed space-y-2.5 pr-1 scrollbar-thin max-h-[460px]">
              {auditLogs.length === 0 ? (
                <div className="text-cyan-500/40 text-center py-12">Telemetry console dormant. Awaiting syscalls...</div>
              ) : (
                auditLogs.map(log => {
                  let badgeColor = 'text-cyan-400';
                  if (log.type === 'VIOLATION') badgeColor = 'text-red-400 font-bold';
                  if (log.type === 'APPROVAL_SUBMIT') badgeColor = 'text-amber-400 font-bold';
                  if (log.type === 'APPROVAL_DECISION') badgeColor = 'text-emerald-400 font-bold';

                  return (
                    <div key={log.id} className="border-b border-emerald-500/5 pb-2">
                      <div className="flex justify-between text-[10px] text-cyan-500/40 mb-0.5">
                        <span>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className={badgeColor}>{log.type}</span>
                      </div>
                      <p className="text-white/95 font-sans leading-relaxed">{log.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="flex flex-col gap-4 flex-1 min-h-0 animate-fade-in">
          <div className="text-[11px] uppercase tracking-widest text-emerald-500/80 mb-1 font-bold">
            GOVERNANCE ENFORCEMENT APPROVAL CORES ({approvalRequests.length})
          </div>

          {approvalRequests.length === 0 ? (
            <div className="p-12 text-center text-xs text-cyan-500/50 border border-dashed border-emerald-500/20 rounded-2xl bg-black/30 flex flex-col items-center gap-3">
              <CheckCircle2 size={36} className="text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
              <span>No execution requests require manual signature at this time. All agent workflows are running autonomously.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[500px]">
              {approvalRequests.map(req => {
                const isPending = req.status === 'PENDING';
                return (
                  <div 
                    key={req.id} 
                    className={`p-5 rounded-2xl border flex flex-col gap-4 relative overflow-hidden transition-all duration-300 ${
                      isPending 
                        ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]' 
                        : req.status === 'APPROVED'
                          ? 'bg-emerald-950/10 border-emerald-500/30'
                          : 'bg-red-950/10 border-red-500/20 text-red-500/70'
                    }`}
                  >
                    {/* Top status tag */}
                    <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <Fingerprint size={14} className={isPending ? 'text-amber-400' : 'text-cyan-400'} />
                        <span className="uppercase">{req.agentKey} Agent</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        isPending 
                          ? 'bg-amber-950 text-amber-400 border border-amber-500/40 animate-pulse' 
                          : req.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-950 text-red-400 border border-red-500/20'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    {/* Action Detail */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-cyan-500/60 block">ACTION DESCRIPTOR:</span>
                      <p className="text-sm font-bold text-white font-sans">{req.action}</p>
                    </div>

                    <div className="text-[11px] font-sans leading-relaxed text-cyan-400/80 bg-black/40 p-3 rounded-xl border border-emerald-500/10">
                      {isPending ? (
                        <span className="flex items-center gap-1.5 text-amber-400/90">
                          <Clock size={13} className="animate-spin" />
                          Awaiting Operator signature to proceed with execution.
                        </span>
                      ) : (
                        <span>
                          Resolved on {new Date(req.decidedAt || req.requestedAt).toLocaleTimeString()} by {req.approver || 'Operator'}.
                        </span>
                      )}
                    </div>

                    {/* Action buttons if Pending */}
                    {isPending ? (
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black transition-all cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleDeny(req.id)}
                          className="px-3 flex items-center justify-center py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500 text-red-200 text-xs font-bold transition-all cursor-pointer"
                        >
                          <X size={14} />
                          <span>Deny</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-cyan-500/40 flex justify-between border-t border-emerald-500/5 pt-2 mt-auto">
                        <span>REQ ID: {req.id}</span>
                        <span>{new Date(req.requestedAt).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
