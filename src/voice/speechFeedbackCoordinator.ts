export type SpeechUrgency = 'normal' | 'high' | 'critical';

export interface ShapeSpeechInput {
  text: string;
  source?: string;
  title?: string;
  urgency?: SpeechUrgency;
  maxSummaryChars?: number;
}

export interface ShapedSpeechResult {
  summary: string;
  expandableDetail: string;
  hasMore: boolean;
  condensed: boolean;
  urgency: SpeechUrgency;
  metricsExtracted: string[];
  suggestedFollowUps: string[];
}

export interface ProactiveSpeechDecision {
  shouldSpeak: boolean;
  urgency: SpeechUrgency;
  spokenBrief: string;
  fullDetail: string;
  dedupeKey: string;
  title: string;
}

const EXPAND_HINT = 'Ask me to expand if you want the full breakdown.';

export function sanitizeForSpeech(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();

  // Handle JSON payloads gracefully instead of reading braces and quotes aloud.
  if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        const parts: string[] = [];
        if (typeof obj.output === 'string') parts.push(obj.output);
        else if (typeof obj.message === 'string') parts.push(obj.message);
        else if (typeof obj.summary === 'string') parts.push(obj.summary);
        else if (typeof obj.status === 'string') parts.push(`Status is ${obj.status}.`);
        if (typeof obj.error === 'string') parts.push(`Error: ${obj.error}.`);
        if (Array.isArray(obj.organs_used) && obj.organs_used.length) {
          parts.push(`Executed across ${obj.organs_used.length} subsystems.`);
        }
        if (parts.length > 0) {
          cleaned = parts.join(' ');
        }
      }
    } catch {
      // Fall through to text cleanup if not valid JSON.
    }
  }

  return cleaned
    .replace(/```[\s\S]*?```/g, ' Code output is displayed in the console. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'the referenced link')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/^\|.*\|$/gm, ' ')
    .replace(/[*_~>|]/g, ' ')
    .replace(/^\s*[-+•]\s+/gm, '')
    .replace(/[{}[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeyMetrics(text: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /\b\d+\s*\/\s*\d+\s*(?:verified|passed|completed|failed|healthy|degraded|organs|tasks)\b/gi,
    /\b\d+(?:\.\d+)?%\b/g,
    /\b\d+\s*ms\b/gi,
    /\b(?:HTTP\s+)?[45]\d{2}\b/g,
    /\b[A-Z]{2,}(?:_[A-Z0-9]+){1,4}\b/g,
  ];
  for (const re of patterns) {
    const found = text.match(re);
    if (found) {
      for (const item of found) {
        if (!matches.includes(item) && matches.length < 5) {
          matches.push(item);
        }
      }
    }
  }
  return matches;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function shapeIntelligentSpeech(input: ShapeSpeechInput): ShapedSpeechResult {
  const maxSummaryChars = Math.max(120, Math.min(480, input.maxSummaryChars ?? 250));
  const cleanFull = sanitizeForSpeech(input.text);
  const metricsExtracted = extractKeyMetrics(cleanFull);

  let inferredUrgency: SpeechUrgency = input.urgency ?? 'normal';
  if (inferredUrgency === 'normal') {
    if (/\b(critical|emergency|blocked|rejected|security|unauthorized|tamper|kill)\b/i.test(cleanFull)) {
      inferredUrgency = 'critical';
    } else if (/\b(approval required|waiting for approval|degraded|failed|warning|unavailable)\b/i.test(cleanFull)) {
      inferredUrgency = 'high';
    }
  }

  if (!cleanFull) {
    return {
      summary: input.title ? `${input.title} completed.` : 'Operation completed.',
      expandableDetail: '',
      hasMore: false,
      condensed: false,
      urgency: inferredUrgency,
      metricsExtracted: [],
      suggestedFollowUps: [],
    };
  }

  if (cleanFull.length <= maxSummaryChars) {
    return {
      summary: cleanFull,
      expandableDetail: cleanFull,
      hasMore: false,
      condensed: false,
      urgency: inferredUrgency,
      metricsExtracted,
      suggestedFollowUps: inferredUrgency !== 'normal' ? ['Explain root cause', 'Open details'] : [],
    };
  }

  const sentences = splitSentences(cleanFull);
  const chosen: string[] = [];
  let charBudget = maxSummaryChars - EXPAND_HINT.length - 2;
  if (charBudget < 90) charBudget = maxSummaryChars;

  for (const sentence of sentences) {
    const nextLen = chosen.join(' ').length + (chosen.length ? 1 : 0) + sentence.length;
    if (nextLen <= charBudget || chosen.length === 0) {
      chosen.push(sentence.length > charBudget ? `${sentence.slice(0, charBudget - 1).trimEnd()}…` : sentence);
    } else {
      break;
    }
    if (chosen.length >= 2) break;
  }

  let lead = chosen.join(' ');
  if (!/[.!?…]$/.test(lead)) lead += '.';

  const remainingMetric = metricsExtracted.find((m) => !lead.includes(m));
  if (remainingMetric && lead.length + remainingMetric.length + 20 < maxSummaryChars) {
    lead += ` Key figure: ${remainingMetric}.`;
  }

  const summary = `${lead} ${EXPAND_HINT}`;
  const suggestedFollowUps = ['Expand full details'];
  if (inferredUrgency !== 'normal') suggestedFollowUps.push('Inspect affected subsystem');

  return {
    summary,
    expandableDetail: cleanFull,
    hasMore: true,
    condensed: true,
    urgency: inferredUrgency,
    metricsExtracted,
    suggestedFollowUps,
  };
}

export function matchesExpandIntent(utterance: string): boolean {
  const normalized = utterance.trim().toLowerCase();
  if (!normalized || normalized.length > 120) return false;
  return /^(?:please\s+|can you\s+|could you\s+|would you\s+)?(expand|tell me more|more details?|full (?:details?|breakdown|report|readout)|elaborate|read the rest|go deeper|details?)\b/.test(
    normalized,
  );
}

export function classifyServerEventForSpeech(
  event: { type?: string; payload?: unknown },
  options: { voiceActive: boolean; liveSessionActive?: boolean },
): ProactiveSpeechDecision {
  const type = String(event?.type ?? '');
  const payload = (event?.payload && typeof event.payload === 'object'
    ? (event.payload as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const silent = (key = type): ProactiveSpeechDecision => ({
    shouldSpeak: false,
    urgency: 'normal',
    spokenBrief: '',
    fullDetail: '',
    dedupeKey: key,
    title: type,
  });

  if (!options.voiceActive) {
    return silent(`muted:${type}`);
  }

  if (type === 'hitl:review_required') {
    const artifact = (payload.artifact && typeof payload.artifact === 'object'
      ? (payload.artifact as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const name = String(artifact.name || payload.trigger || 'governed action');
    const hitlId = String(payload.hitl_id || '');
    return {
      shouldSpeak: true,
      urgency: 'critical',
      title: 'HITL Approval Required',
      spokenBrief: `Attention: human approval is required for ${sanitizeForSpeech(name)}. Review the action before execution.`,
      fullDetail: `Approval gate triggered for ${name}. Trigger type: ${String(payload.trigger || 'approval')}. Review in Mission Control or HITL panel.`,
      dedupeKey: `hitl:${hitlId || name}`,
    };
  }

  if (type === 'mission:approval_required' || type === 'approval:required') {
    const action = String(payload.tool || payload.action || payload.subtask_id || 'a mission step');
    return {
      shouldSpeak: true,
      urgency: 'critical',
      title: 'Mission Approval Gate',
      spokenBrief: `Mission paused for human approval on ${sanitizeForSpeech(action)}.`,
      fullDetail: `Mission requires manual approval to execute ${action}.`,
      dedupeKey: `mission_approval:${String(payload.mission_id || action)}`,
    };
  }

  if (type === 'oversight:emergency_kill') {
    return {
      shouldSpeak: true,
      urgency: 'critical',
      title: 'Emergency Kill Engaged',
      spokenBrief: 'Critical alert: orchestration emergency kill switch engaged. Recursive execution has halted.',
      fullDetail: 'Oversight emergency kill was activated. Inspect World Thinking and Oversight to review recursion state before resuming.',
      dedupeKey: 'oversight:emergency_kill',
    };
  }

  if (type === 'security:blocked' || type === 'security:input_blocked' || type === 'governance:blocked') {
    const detail = sanitizeForSpeech(String(payload.error || payload.reason || payload.organ || 'policy violation'));
    return {
      shouldSpeak: true,
      urgency: 'critical',
      title: 'Security / Governance Block',
      spokenBrief: `Security alert: execution was blocked due to ${detail || 'constitutional policy enforcement'}.`,
      fullDetail: `Governance or security spine blocked an action (${type}): ${detail}.`,
      dedupeKey: `${type}:${detail.slice(0, 48)}`,
    };
  }

  if (type === 'security:drift_detected' || type === 'security:identity_drift') {
    return {
      shouldSpeak: true,
      urgency: 'critical',
      title: 'Identity / Drift Alert',
      spokenBrief: 'Security warning: runtime drift was detected. Audit constitutional state before continuing.',
      fullDetail: sanitizeForSpeech(JSON.stringify(payload)),
      dedupeKey: `${type}:${String(payload.ts || '')}`,
    };
  }

  if (type === 'capabilities:updated') {
    const counts = (payload.counts && typeof payload.counts === 'object'
      ? (payload.counts as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const degraded = Number(counts.degraded ?? 0);
    const unavailable = Number(counts.unavailable ?? 0);
    if (degraded <= 0 && unavailable <= 0) {
      return silent('capabilities:nominal');
    }
    const mode = String(payload.mode || 'probe');
    return {
      shouldSpeak: true,
      urgency: unavailable > 0 ? 'critical' : 'high',
      title: 'Live Capability Degradation',
      spokenBrief: `Runtime capability alert: ${unavailable} unavailable and ${degraded} degraded subsystems detected during ${mode} probe.`,
      fullDetail: `Live capability sweep (${mode}) reported ${unavailable} unavailable and ${degraded} degraded capabilities out of ${Number(counts.total ?? 0)}.`,
      dedupeKey: `cap_degraded:${unavailable}:${degraded}`,
    };
  }

  if (type === 'command:error') {
    const errText = sanitizeForSpeech(String(payload.error || 'Command execution failed.'));
    return {
      shouldSpeak: true,
      urgency: 'high',
      title: 'Command Failure',
      spokenBrief: `Command error: ${shapeIntelligentSpeech({ text: errText, urgency: 'high', maxSummaryChars: 200 }).summary}`,
      fullDetail: errText,
      dedupeKey: `cmd_err:${String(payload.cmdId || errText.slice(0, 40))}`,
    };
  }

  return silent();
}
