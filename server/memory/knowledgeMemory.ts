/** Kraken-inspired memory semantics on Microfixd's canonical durable store. */
import {createHash, randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {contentHash, type Artifact, type Mission, type Subtask} from '../planner/executionSpine';

const TABLE = 'microfixd_memory_records';
const VERSION = 'knowledge-v1';
export const KNOWLEDGE_KINDS = ['fact', 'preference', 'goal', 'constraint', 'project_state'] as const;
type Kind = typeof KNOWLEDGE_KINDS[number];
export interface MemoryIdentity {tenant_id: string; session_id: string}
interface MemoryRow {
  id: string; tenant_id: string; content: string; created_at: string;
  metadata: Record<string, any>; tags?: string[]; importance?: number;
}
function identity(who: MemoryIdentity) {
  if (!who.tenant_id?.trim() || !who.session_id?.trim()) throw new Error('MEMORY_IDENTITY_REQUIRED');
}
function text(value: unknown, max: number, required = false): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('INVALID_KNOWLEDGE');
  return value.trim();
}
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
const idFor = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stopwords = new Set(['the', 'and', 'for', 'what', 'how', 'does', 'this', 'that', 'with', 'from', 'have', 'please', 'can', 'you', 'about']);
function words(value: string) {
  return [...new Set(normalize(value).match(/[\p{L}\p{N}_-]+/gu) ?? [])].filter(w => w.length > 1 && !stopwords.has(w));
}
function relevance(query: string, value: string) {
  const terms = words(query), haystack = new Set(words(value));
  return terms.reduce((score, word) => score + Number(haystack.has(word)), 0);
}
function check(error: any) {
  if (error) throw new Error(`Durable knowledge storage failed [${error.code ?? 'STORAGE_ERROR'}]`);
}

/** An assertion stays an assertion; a model-supplied confidence never certifies it. */
export async function rememberKnowledge(db: SupabaseClient, who: MemoryIdentity, input: Record<string, any>) {
  identity(who);
  const kind = input.kind ?? 'fact', scope = input.scope ?? 'tenant';
  if (!KNOWLEDGE_KINDS.includes(kind) || !['tenant', 'session'].includes(scope)) throw new Error('INVALID_KNOWLEDGE');
  const key = text(input.key, 160, true), content = text(input.content, 8000, true);
  const subject = text(input.subject, 160), predicate = text(input.predicate, 160), object = text(input.object, 500);
  if ([subject, predicate, object].some(Boolean) && ![subject, predicate, object].every(Boolean)) throw new Error('INCOMPLETE_RELATIONSHIP');
  const confidence = input.confidence ?? 0.5;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('INVALID_CONFIDENCE');
  const tags = Array.isArray(input.tags) ? input.tags.map(tag => text(tag, 80, true)) : [];
  if (tags.length > 20) throw new Error('INVALID_KNOWLEDGE');
  // A retry retains its original timestamp. A later correction, including a
  // change back to an earlier value, gets a new event and remains observable.
  const event = input.event_id ?? randomUUID();
  const metadata = {version: VERSION, type: 'knowledge', session_id: who.session_id, scope, kind,
    key: normalize(key), subject, predicate, object, confidence, source: 'recorded_assertion'};
  const id = `knowledge:${idFor([who.tenant_id, who.session_id, event, metadata, content, tags])}`;
  const {error} = await db.from(TABLE).upsert({id, tenant_id: who.tenant_id, agent_id: 'knowledge', kind: 'semantic',
    content, metadata, tags, importance: confidence}, {onConflict: 'id', ignoreDuplicates: true});
  check(error);
  return {stored: true, id, durable: true, source: 'supabase', trust: 'recorded_assertion'};
}

async function rows(db: SupabaseClient, who: MemoryIdentity, type: 'knowledge' | 'procedure', scope: 'tenant' | 'session') {
  let query = db.from(TABLE).select('id,tenant_id,content,created_at,metadata,tags,importance')
    .eq('tenant_id', who.tenant_id).eq('agent_id', type)
    .contains('metadata', {version: VERSION, type, scope, ...(scope === 'session' ? {session_id: who.session_id} : {})})
    .order('created_at', {ascending: false}).order('id', {ascending: false}).limit(200);
  const {data, error} = await query;
  check(error);
  return (data ?? []).filter((row: MemoryRow) => row.tenant_id === who.tenant_id) as MemoryRow[];
}

/** Newer values supersede older values for the same scoped key. History is immutable. */
export async function recallKnowledge(db: SupabaseClient, who: MemoryIdentity, query: string, limit = 8) {
  identity(who); text(query, 4000);
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error('INVALID_MEMORY_LIMIT');
  const batches = await Promise.all([rows(db, who, 'knowledge', 'tenant'), rows(db, who, 'knowledge', 'session')]);
  const candidates = batches.flat().sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const active = new Map<string, MemoryRow>(), older = new Map<string, string[]>();
  for (const row of candidates) {
    const meta = row.metadata;
    if (meta.version !== VERSION || !KNOWLEDGE_KINDS.includes(meta.kind) || typeof meta.key !== 'string') continue;
    const slot = `${meta.scope}:${meta.kind}:${meta.key}`;
    if (active.has(slot)) older.set(slot, [...(older.get(slot) ?? []), row.id]);
    else active.set(slot, row);
  }
  const scored = [...active.entries()].map(([slot, row]) => ({slot, row,
    score: relevance(query, [row.content, row.metadata.key, row.metadata.subject, row.metadata.object, ...(row.tags ?? [])].join(' '))}));
  const seeds = scored.filter(item => item.score > 0);
  const entities = new Set(seeds.flatMap(({row}) => [row.metadata.subject, row.metadata.object]).filter(Boolean).map(normalize));
  const memories = scored.map(item => ({...item, related: [item.row.metadata.subject, item.row.metadata.object].some(v => v && entities.has(normalize(v)))}))
    .filter(item => !query.trim() || item.score > 0 || item.related)
    .sort((a, b) => b.score - a.score || Number(b.related) - Number(a.related) || b.row.created_at.localeCompare(a.row.created_at))
    .slice(0, limit).map(({slot, row, score, related}) => ({id: row.id, content: row.content, created_at: row.created_at,
      kind: row.metadata.kind as Kind, scope: row.metadata.scope as string, key: row.metadata.key as string,
      confidence: row.metadata.confidence as number, trust: 'recorded_assertion',
      relationship: row.metadata.subject ? {subject: row.metadata.subject as string, predicate: row.metadata.predicate as string, object: row.metadata.object as string} : null,
      superseded_ids: (older.get(slot) ?? []).slice(0, 8), superseded_count: (older.get(slot) ?? []).length, score, related}));
  return {memories, count: memories.length, source: 'supabase', durable: true, candidate_limit_per_scope: 200,
    candidate_window_full: batches.some(batch => batch.length === 200)};
}

/** Save only artifact-backed tool sequences. This never grants execution authority. */
export async function rememberProcedure(db: SupabaseClient, mission: Mission, final: Artifact, sources: Artifact[], subtasks: Subtask[]) {
  const review = final.evidence.completion_review as any;
  if (!review || review.status !== 'complete') return;
  const selected = sources.filter(a => a.subtask_id !== null);
  if (final.tenant_id !== mission.tenant_id || final.mission_id !== mission.mission_id
    || final.type !== 'mission_result' || contentHash(final.content) !== final.hash
    || !['explicit_plan','model_review'].includes(review.method)
    || !Array.isArray(review.evidence_artifact_ids) || !review.evidence_artifact_ids.length
    || review.evidence_artifact_ids.some(id => !selected.some(a => a.artifact_id === id))
    || selected.some(a => a.tenant_id !== mission.tenant_id || a.mission_id !== mission.mission_id || contentHash(a.content) !== a.hash)) throw new Error('INVALID_PROCEDURE_EVIDENCE');
  const steps = subtasks.filter(sub => sub.tool_request).map(sub => {
    const artifact = selected.find(a => a.subtask_id === sub.subtask_id);
    if (sub.tenant_id !== mission.tenant_id || sub.status !== 'succeeded' || !artifact
      || artifact.evidence.tool !== sub.tool_request!.name
      || artifact.evidence.request_hash !== contentHash(sub.tool_request)) throw new Error('INVALID_PROCEDURE_EVIDENCE');
    const args = sub.tool_request!.arguments;
    return {tool: String(sub.tool_request!.name), argument_names: args && typeof args === 'object' ? Object.keys(args) : [],
      artifact_id: artifact.artifact_id, content_hash: artifact.hash};
  });
  if (!steps.length) return;
  // Do not copy credentials, old argument values, tool results or executable code.
  const content = JSON.stringify({objective: mission.objective, steps,
    instruction: 'Historical example only. Re-plan with current arguments, permissions and verification; never replay automatically.'});
  const id = `procedure:${idFor([mission.tenant_id, mission.mission_id, final.artifact_id])}`;
  const {error} = await db.from(TABLE).upsert({id, tenant_id: mission.tenant_id, agent_id: 'procedure', kind: 'semantic', content, tags: ['learned-procedure'],
    metadata: {version: VERSION, type: 'procedure', scope: 'tenant', session_id: `${mission.tenant_id}:${mission.mission_id}`,
      mission_id: mission.mission_id, final_artifact_id: final.artifact_id, review_method: review.method, trust: 'historical_execution'}, importance: 0.5},
    {onConflict: 'id', ignoreDuplicates: true});
  check(error);
}

export async function recallProcedures(db: SupabaseClient, who: MemoryIdentity, query: string, limit = 3) {
  identity(who); text(query, 4000);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('INVALID_MEMORY_LIMIT');
  const candidates = await rows(db, who, 'procedure', 'tenant');
  if (!candidates.length) return {procedures: [], count: 0, source: 'supabase', durable: true};
  const missions = [...new Set(candidates.map(row => row.metadata.mission_id).filter(id => typeof id === 'string'))];
  if (!missions.length) return {procedures: [], count: 0, source: 'supabase', durable: true};
  const {data, error} = await db.from('spine_rows').select('id,data').eq('tenant_id', who.tenant_id).eq('kind', 'missions').in('id', missions);
  check(error);
  const completed = new Map((data ?? []).filter(row => row.data.tenant_id === who.tenant_id && row.data.status === 'succeeded')
    .map(row => [row.id, row.data.result_artifact_id]));
  const procedures = candidates.filter(row => completed.get(row.metadata.mission_id) === row.metadata.final_artifact_id)
    .map(row => ({id: row.id, content: row.content, mission_id: row.metadata.mission_id as string, trust: 'historical_execution',
      score: relevance(query, row.content), created_at: row.created_at}))
    .filter(row => !query.trim() || row.score > 0).sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at)).slice(0, limit);
  return {procedures, count: procedures.length, source: 'supabase', durable: true};
}
