import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { getPending as getPendingHitl, decide as decideHitl } from '../hitl/hitlManager';
import { ENABLED_TOOLS } from '../planner/governedTools';
import { plannerClient } from '../planner/supabaseRuntime';
import { submitMission } from '../planner/plannerRouter';
import { runCommand } from './commandCenter';
import { shapeIntelligentSpeech } from '../../src/voice/speechFeedbackCoordinator';

export type DecisionKind = 'approval' | 'hitl_review' | 'missing_info';

export interface PendingDecisionItem {
  id: string;
  kind: DecisionKind;
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

export interface AutoClassification {
  strategy: 'chat' | 'mission' | 'needs_input';
  reason: string;
  derivedOrigins: string[];
  missingFields?: string[];
  promptQuestion?: string;
}

function extractHttpsOrigins(text: string): string[] {
  const urls = [...text.matchAll(/https:\/\/[^\s<>"']+/g)].map((m) => m[0].replace(/[),.;!?]+$/, ''));
  const origins: string[] = [];
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && !origins.includes(parsed.origin)) {
        origins.push(parsed.origin);
      }
    } catch {
      // ignore invalid URL
    }
  }
  return origins;
}

export function classifyAutoGoal(task: string): AutoClassification {
  const trimmed = task.trim();
  const lower = trimmed.toLowerCase();
  const derivedOrigins = extractHttpsOrigins(trimmed);

  // Detect obvious missing critical targets for external/destructive requests before blind execution.
  if (
    /\b(browse|open|scrape|crawl|inspect|check)\s+(the\s+)?(site|website|webpage|page|url)\b/i.test(lower) &&
    derivedOrigins.length === 0 &&
    !/https?:\/\//i.test(trimmed)
  ) {
    return {
      strategy: 'needs_input',
      reason: 'A specific HTTPS website address is needed before opening a browser task.',
      derivedOrigins: [],
      missingFields: ['target_url'],
      promptQuestion: 'Which HTTPS website URL would you like me to inspect?',
    };
  }

  if (
    /\b(push|commit|write|upload)\b.*\b(github|repo|repository)\b/i.test(lower) &&
    !/[a-z0-9_.-]+\/[a-z0-9_.-]+/i.test(trimmed)
  ) {
    return {
      strategy: 'needs_input',
      reason: 'Repository owner/name and target path are required before modifying GitHub.',
      derivedOrigins,
      missingFields: ['repository', 'file_path'],
      promptQuestion: 'Which repository (owner/repo) and file path should this change target?',
    };
  }

  const missionSignals =
    derivedOrigins.length > 0 ||
    /\b(build|create|implement|deploy|repair|fix|patch|refactor|crawl|scrape|benchmark|stress test|run workflow|execute script|push file|mission|step by step)\b/i.test(
      lower,
    );

  if (missionSignals) {
    return {
      strategy: 'mission',
      reason: 'Multi-step or tool-backed task routed to the durable autonomous planner.',
      derivedOrigins,
    };
  }

  return {
    strategy: 'chat',
    reason: 'Direct analysis or question routed for immediate response.',
    derivedOrigins,
  };
}

export async function collectPendingDecisions(tenantId: string): Promise<{
  decisions: PendingDecisionItem[];
  durableAvailable: boolean;
}> {
  const decisions: PendingDecisionItem[] = [];
  let durableAvailable = false;

  // 1. Durable Supabase approvals & paused waiting_input missions for caller tenant
  try {
    const client = plannerClient();
    const [approvalsRes, missionsRes] = await Promise.all([
      client
        .from('spine_approvals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      client
        .from('spine_rows')
        .select('data')
        .eq('tenant_id', tenantId)
        .eq('kind', 'missions')
        .eq('data->>status', 'waiting')
        .order('sequence', { ascending: false })
        .limit(15),
    ]);

    if (!approvalsRes.error) {
      durableAvailable = true;
      const missionMap = new Map<string, string>();
      if (!missionsRes.error && Array.isArray(missionsRes.data)) {
        for (const row of missionsRes.data) {
          const m = (row as { data?: { mission_id?: string; objective?: string } }).data;
          if (m?.mission_id) {
            missionMap.set(m.mission_id, String(m.objective || 'Autonomous mission'));
          }
        }
      }

      for (const row of approvalsRes.data ?? []) {
        const reqObj = (row.request && typeof row.request === 'object'
          ? (row.request as Record<string, unknown>)
          : {}) as Record<string, unknown>;
        const actionName = String(reqObj.name || 'protected_action');
        const objective = missionMap.get(String(row.mission_id || '')) || 'Autonomous mission step';
        decisions.push({
          id: `approval:${row.mission_id}:${row.subtask_id}:${row.request_hash}`,
          kind: 'approval',
          title: `Approve ${actionName.replace(/_/g, ' ')}`,
          summary: `Paused while handling "${objective.slice(0, 120)}". Confirm to run ${actionName}.`,
          impactScope: actionName.includes('repair') || actionName.includes('push')
            ? 'Code or repository write operation'
            : actionName.includes('sandbox')
              ? 'Isolated code execution'
              : 'Protected autonomous action',
          urgency: 'critical',
          missionId: String(row.mission_id),
          subtaskId: String(row.subtask_id),
          requestHash: String(row.request_hash),
          actionName,
          createdAt: String(row.created_at || new Date().toISOString()),
        });
      }
    }
  } catch {
    durableAvailable = false;
  }

  // 2. Legacy/process HITL queue items (scoped to default or matching session prefix)
  for (const item of getPendingHitl()) {
    const itemSession = String(item.session_id || '');
    if (!itemSession.startsWith(`${tenantId}:`)) {
      continue;
    }
    decisions.push({
      id: `hitl:${item.hitl_id}`,
      kind: 'hitl_review',
      title: `Review: ${String(item.artifact?.name || 'System action')}`,
      summary: `Human sign-off requested (${item.trigger}) for ${String(item.artifact?.type || 'operation')}.`,
      impactScope: String(item.artifact?.type || 'Governed artifact'),
      urgency: 'critical',
      hitlId: item.hitl_id,
      createdAt: item.ts,
    });
  }

  decisions.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { decisions, durableAvailable };
}

export const autonomousHomeRouter = Router();

autonomousHomeRouter.post('/auto', async (req: Request, res: Response, next: NextFunction) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const task = typeof body.task === 'string' ? body.task.trim() : typeof body.objective === 'string' ? body.objective.trim() : '';
  const requestedMode = body.mode === 'chat' || body.mode === 'mission' ? body.mode : 'auto';

  if (!task || task.length > 16000) {
    res.status(400).json({ success: false, code: 'INVALID_TASK', error: 'A task or question (1-16000 chars) is required.' });
    return;
  }

  const tenantId = (req as any).microfixdTenantId ?? 'default';
  const sessionId = typeof body.session_id === 'string' && body.session_id.trim()
    ? body.session_id.trim()
    : randomUUID();
  const source = typeof body.source === 'string' ? body.source : 'os-home';
  const commandSource = body.source === 'voice' ? 'voice' : body.source === 'api' ? 'api' : 'chat';

  if (requestedMode === 'chat') {
    try {
      const result = await runCommand({
        task,
        tenant_id: tenantId,
        session_id: sessionId,
        source: commandSource,
        priority: 'normal',
        context: { ...(typeof body.context === 'object' && body.context ? (body.context as Record<string, unknown>) : {}), responseOnly: true },
      });
      const shaped = shapeIntelligentSpeech({ text: String(result.output || ''), source });
      res.json({ ...result, resolvedMode: 'chat', speechBrief: shaped });
      return;
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }
  }

  if (requestedMode === 'mission') {
    req.body = {
      ...body,
      objective: task,
    };
    if (!req.headers['idempotency-key']) {
      req.headers['idempotency-key'] = randomUUID();
    }
    return submitMission(req, res, next);
  }

  const classification = classifyAutoGoal(task);

  if (classification.strategy === 'needs_input') {
    const decision: PendingDecisionItem = {
      id: `missing:${randomUUID()}`,
      kind: 'missing_info',
      title: 'Additional Information Needed',
      summary: classification.promptQuestion || classification.reason,
      impactScope: classification.reason,
      urgency: 'high',
      missingFields: classification.missingFields,
      originalTask: task,
      createdAt: new Date().toISOString(),
    };
    res.json({
      success: true,
      resolvedMode: 'needs_input',
      needsInput: true,
      decision,
      output: decision.summary,
      speechBrief: shapeIntelligentSpeech({ text: decision.summary, urgency: 'high', source }),
    });
    return;
  }

  if (classification.strategy === 'mission') {
    req.body = {
      ...body,
      objective: task,
      browser_origins: Array.isArray(body.browser_origins) && body.browser_origins.length
        ? body.browser_origins
        : classification.derivedOrigins,
      tool_permissions: Array.isArray(body.tool_permissions) && body.tool_permissions.length
        ? body.tool_permissions
        : [...ENABLED_TOOLS],
    };
    if (!req.headers['idempotency-key']) {
      req.headers['idempotency-key'] = randomUUID();
    }
    res.locals.autoRoutingReason = classification.reason;
    return submitMission(req, res, next);
  }

  try {
    const result = await runCommand({
      task,
      tenant_id: tenantId,
      session_id: sessionId,
      source: commandSource,
      priority: 'normal',
      context: { ...(typeof body.context === 'object' && body.context ? (body.context as Record<string, unknown>) : {}), responseOnly: true },
    });
    const shaped = shapeIntelligentSpeech({ text: String(result.output || ''), source });
    res.json({ ...result, resolvedMode: 'chat', routingReason: classification.reason, speechBrief: shaped });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

autonomousHomeRouter.get('/decisions/pending', async (req: Request, res: Response) => {
  const tenantId = (req as any).microfixdTenantId ?? 'default';
  const result = await collectPendingDecisions(tenantId);
  res.json({
    decisions: result.decisions,
    count: result.decisions.length,
    durableAvailable: result.durableAvailable,
    ts: new Date().toISOString(),
  });
});

autonomousHomeRouter.post('/decisions/resolve', async (req: Request, res: Response, next: NextFunction) => {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const kind = body.kind as DecisionKind | undefined;
  const tenantId = (req as any).microfixdTenantId ?? 'default';
  const role = (req as any).microfixdRole;

  if (kind === 'approval') {
    if (role !== 'admin') {
      res.status(403).json({ code: 'ADMIN_REQUIRED', error: 'Admin role is required to approve or reject protected actions.' });
      return;
    }
    const missionId = String(body.missionId || '');
    const subtaskId = String(body.subtaskId || '');
    const requestHash = String(body.requestHash || '');
    const decision = body.decision;
    if (!missionId || !subtaskId || !requestHash || (decision !== 'approved' && decision !== 'rejected')) {
      res.status(400).json({ code: 'INVALID_DECISION', error: 'missionId, subtaskId, requestHash, and approved|rejected are required.' });
      return;
    }
    try {
      const { error } = await plannerClient().rpc('spine_decide', {
        p_tenant: tenantId,
        p_mission: missionId,
        p_subtask: subtaskId,
        p_hash: requestHash,
        p_decision: decision,
        p_actor: (req as any).microfixdUserId ?? 'admin',
      });
      if (error) {
        res.status(409).json({ code: 'DECISION_CONFLICT', error: 'Approval decision conflicted or already decided.' });
        return;
      }
      res.json({ success: true, kind, decision, missionId, subtaskId });
      return;
    } catch {
      res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Approval database unavailable.' });
      return;
    }
  }

  if (kind === 'hitl_review') {
    if (role !== 'admin') {
      res.status(403).json({ code: 'ADMIN_REQUIRED', error: 'Admin role is required to decide HITL items.' });
      return;
    }
    const hitlId = String(body.hitlId || '');
    const decision = body.decision;
    if (!hitlId || (decision !== 'approved' && decision !== 'rejected')) {
      res.status(400).json({ code: 'INVALID_HITL_DECISION', error: 'hitlId and approved|rejected required.' });
      return;
    }
    if (!getPendingHitl().some(item => item.hitl_id === hitlId && item.session_id.startsWith(`${tenantId}:`))) {
      res.status(404).json({ code: 'HITL_NOT_FOUND' });
      return;
    }
    const record = decideHitl(hitlId, decision, typeof body.notes === 'string' ? body.notes : undefined);
    if (!record) {
      res.status(404).json({ code: 'HITL_NOT_FOUND', error: 'Pending HITL item not found.' });
      return;
    }
    res.json({ success: true, kind, decision, record });
    return;
  }

  if (kind === 'missing_info') {
    const originalTask = typeof body.originalTask === 'string' ? body.originalTask.trim() : '';
    const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
    if (!originalTask || !answer) {
      res.status(400).json({ code: 'MISSING_CLARIFICATION', error: 'Both originalTask and answer are required.' });
      return;
    }
    const combinedTask = `${originalTask}\nProvided detail: ${answer}`;
    const classification = classifyAutoGoal(combinedTask);
    if (classification.strategy === 'mission') {
      req.body = {
        objective: combinedTask,
        browser_origins: classification.derivedOrigins,
        tool_permissions: [...ENABLED_TOOLS],
      };
      req.headers['idempotency-key'] = randomUUID();
      return submitMission(req, res, next);
    }
    try {
      const result = await runCommand({
        task: combinedTask,
        tenant_id: tenantId,
        session_id: randomUUID(),
        source: 'chat',
        priority: 'normal',
        context: { responseOnly: true },
      });
      res.json({ ...result, resolvedMode: 'chat', speechBrief: shapeIntelligentSpeech({ text: String(result.output || '') }) });
      return;
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }
  }

  res.status(400).json({ code: 'INVALID_DECISION_KIND', error: 'Unsupported decision kind.' });
});
