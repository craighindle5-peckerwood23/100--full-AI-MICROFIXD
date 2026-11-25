import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Send, ShieldAlert, XCircle } from 'lucide-react';

export interface PendingDecisionItem {
  id: string;
  kind: 'approval' | 'hitl_review' | 'missing_info';
  title: string;
  summary: string;
  impactScope: string;
  urgency: 'high' | 'critical';
  missionId?: string;
  subtaskId?: string;
  requestHash?: string;
  hitlId?: string;
  actionName?: string;
  missingFields?: string[];
  originalTask?: string;
  createdAt: string;
}

interface Props {
  decisions: PendingDecisionItem[];
  busyId: string | null;
  onApprove: (item: PendingDecisionItem, decision: 'approved' | 'rejected') => Promise<void>;
  onReplyMissingInfo: (item: PendingDecisionItem, answer: string) => Promise<void>;
  onOpenMission?: (missionId: string) => void;
}

export default function FocusedDecisionCard({
  decisions,
  busyId,
  onApprove,
  onReplyMissingInfo,
  onOpenMission,
}: Props) {
  const [replyText, setReplyText] = useState('');

  if (decisions.length === 0) return null;

  const active = decisions[0];
  const isBusy = busyId === active.id;

  return (
    <section
      aria-label="Decision Required"
      className="mb-2 rounded-lg border border-amber-400/50 bg-[#140e04]/95 p-3 text-xs text-amber-50 shadow-[0_6px_24px_rgba(217,119,6,0.16)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {active.kind === 'missing_info' ? (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          ) : (
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-300" />
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-xs font-semibold text-white">{active.title}</strong>
              <span className="rounded border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-200">
                {active.impactScope}
              </span>
              {decisions.length > 1 && (
                <span className="font-mono text-[10px] text-amber-300 tabular-nums">
                  1 of {decisions.length} waiting
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-amber-100/90">{active.summary}</p>
          </div>
        </div>
      </div>

      {active.kind === 'missing_info' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!replyText.trim() || isBusy) return;
            const answer = replyText.trim();
            setReplyText('');
            void onReplyMissingInfo(active, answer);
          }}
          className="mt-2.5 flex items-center gap-2"
        >
          <input
            type="text"
            value={replyText}
            disabled={isBusy}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Enter the requested information to continue..."
            className="flex-1 rounded border border-amber-400/35 bg-black/55 px-2.5 py-1.5 text-xs text-white placeholder:text-amber-200/50 focus:border-amber-300 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!replyText.trim() || isBusy}
            className="inline-flex items-center gap-1 rounded border border-amber-300/60 bg-amber-500/25 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500/35 disabled:opacity-40 whitespace-nowrap"
          >
            <Send size={12} />
            <span>Continue</span>
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void onApprove(active, 'rejected')}
            className="rounded border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10 whitespace-nowrap"
          >
            Dismiss
          </button>
        </form>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void onApprove(active, 'approved')}
            className="inline-flex items-center gap-1.5 rounded border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-40 whitespace-nowrap"
          >
            <CheckCircle2 size={13} />
            <span>{isBusy ? 'Applying…' : 'Approve & Continue'}</span>
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void onApprove(active, 'rejected')}
            className="inline-flex items-center gap-1.5 rounded border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/25 disabled:opacity-40 whitespace-nowrap"
          >
            <XCircle size={13} />
            <span>Decline</span>
          </button>
          {active.missionId && onOpenMission && (
            <button
              type="button"
              onClick={() => onOpenMission(active.missionId!)}
              className="ml-auto text-[11px] text-amber-200 hover:underline whitespace-nowrap"
            >
              Inspect Mission Details
            </button>
          )}
        </div>
      )}
    </section>
  );
}
