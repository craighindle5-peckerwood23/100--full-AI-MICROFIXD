/** DeerFlow-inspired task continuity using the existing fenced Supabase spine. */
import type {SupabaseClient} from '@supabase/supabase-js';
import {contentHash, type Artifact, type ExecutionContext, type JSONObject, type Message} from './executionSpine';

const MAX_NOTES = 8, MAX_NOTE_CHARS = 750, PAGE_CHARS = 4000;
const noteKey = /^[a-zA-Z0-9_-]{1,40}$/;
const executor = '201b8150-d9f4-44b9-a88f-4b0442a36798';
function check(error: any) {if (error) throw new Error(`CONTINUITY_STORAGE_ERROR:${error.code ?? 'UNAVAILABLE'}`);}
function scope(tenant: string, mission: string) {
  if (!tenant?.trim() || !mission?.trim()) throw new Error('CONTINUITY_SCOPE_REQUIRED');
}
function verified(artifact: Artifact, tenant: string, mission: string) {
  if (!artifact || artifact.tenant_id !== tenant || artifact.mission_id !== mission
    || typeof artifact.hash !== 'string' || contentHash(artifact.content) !== artifact.hash) throw new Error('INVALID_ARTIFACT_EVIDENCE');
  return artifact;
}
/** Offsets count Unicode code points, including supplementary characters. */
export function artifactPreview(artifact: Artifact, chars = 1600) {
  const full = Array.from(JSON.stringify(artifact.content));
  return {artifact_id: artifact.artifact_id, hash: artifact.hash, content_preview: full.slice(0, chars).join(''),
    total_chars: full.length, truncated: full.length > chars, next_offset: full.length > chars ? chars : null,
    read_tool: 'read_mission_artifact', authority: 'untrusted_persisted_evidence'};
}
async function getArtifact(client: SupabaseClient, tenant: string, mission: string, id: string) {
  scope(tenant, mission);
  if (typeof id !== 'string' || !id.trim() || id.length > 200) throw new Error('INVALID_ARTIFACT_ID');
  const {data, error} = await client.from('spine_rows').select('data').eq('tenant_id', tenant)
    .eq('mission_id', mission).eq('kind', 'artifacts').eq('id', id).maybeSingle();
  check(error);
  if (!data) throw new Error('ARTIFACT_NOT_FOUND');
  const artifact = verified(data.data as Artifact, tenant, mission);
  if (artifact.artifact_id !== id) throw new Error('INVALID_ARTIFACT_EVIDENCE');
  return artifact;
}
export async function readMissionArtifact(client: SupabaseClient, tenant: string, mission: string, args: JSONObject) {
  const offset = args.offset ?? 0, limit = args.limit ?? PAGE_CHARS;
  if (!Number.isInteger(offset) || Number(offset) < 0 || !Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > PAGE_CHARS) throw new Error('INVALID_ARTIFACT_PAGE');
  const artifact = await getArtifact(client, tenant, mission, String(args.artifact_id ?? ''));
  const full = Array.from(JSON.stringify(artifact.content));
  if (Number(offset) > full.length) throw new Error('INVALID_ARTIFACT_PAGE');
  const end = Math.min(full.length, Number(offset) + Number(limit));
  return {artifact_id: artifact.artifact_id, hash: artifact.hash, text: full.slice(Number(offset), end).join(''),
    offset, total_chars: full.length, next_offset: end < full.length ? end : null,
    truncated: end < full.length || Number(offset) > 0, source_complete: true, authority: 'untrusted_persisted_evidence'};
}
export async function searchMissionHistory(client: SupabaseClient, tenant: string, mission: string, args: JSONObject) {
  scope(tenant, mission);
  if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 2000) throw new Error('INVALID_HISTORY_QUERY');
  const terms = args.query.trim().split(/\s+/u).slice(0, 12).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const match = new RegExp(terms.join('|'), 'iu');
  const {data, error} = await client.from('spine_rows').select('data').eq('tenant_id', tenant)
    .eq('mission_id', mission).eq('kind', 'artifacts').order('sequence', {ascending: false}).limit(64);
  check(error);
  const results = [];
  for (const row of data ?? []) {
    const artifact = verified(row.data as Artifact, tenant, mission), serialized = JSON.stringify(artifact.content);
    const found = match.exec(serialized);
    if (!found) continue;
    const chars = Array.from(serialized), start = Math.max(0, Array.from(serialized.slice(0, found.index)).length - 150);
    results.push({artifact_id: artifact.artifact_id, hash: artifact.hash, excerpt: chars.slice(start, start + 600).join(''),
      excerpt_start: start, excerpt_end: Math.min(chars.length, start + 600), total_chars: chars.length,
      read_tool: 'read_mission_artifact', authority: 'untrusted_persisted_evidence'});
    if (results.length === 8) break;
  }
  return {results, scanned_window_full: data?.length === 64, scope: 'current_mission', source: 'supabase'};
}
export async function loadMissionNotes(client: SupabaseClient, tenant: string, mission: string) {
  scope(tenant, mission);
  const {data, error} = await client.from('spine_rows').select('data').eq('tenant_id', tenant).eq('mission_id', mission)
    .eq('kind', 'messages').contains('data', {content: {kind: 'task_note'}}).order('sequence').limit(100);
  check(error);
  if (data?.length === 100) throw new Error('CONTINUITY_HISTORY_LIMIT');
  const latest = new Map<string, {key: string; content: string; source_artifact_ids: string[]; authority: string}>();
  for (const row of data ?? []) {
    const message = row.data as Message, note = message.content as any;
    if (message.tenant_id !== tenant || message.mission_id !== mission || note?.kind !== 'task_note' || typeof note.key !== 'string' || !noteKey.test(note.key)
      || typeof note.content !== 'string' || note.content.length > MAX_NOTE_CHARS || !Array.isArray(note.source_artifact_ids)
      || note.source_artifact_ids.length > 4 || note.source_artifact_ids.some(id => typeof id !== 'string')) throw new Error('INVALID_MISSION_NOTE');
    if (!note.content) latest.delete(note.key);
    else latest.set(note.key, {key: note.key, content: note.content, source_artifact_ids: note.source_artifact_ids, authority: 'model_report'});
  }
  if (latest.size > MAX_NOTES) throw new Error('NOTE_CAPACITY');
  return [...latest.values()];
}
export async function saveMissionNote(client: SupabaseClient, tenant: string, mission: string, owner: string, args: JSONObject, context: ExecutionContext) {
  scope(tenant, mission);
  if (context.tenant_id !== tenant || context.mission_id !== mission) throw new Error('TENANT_MISMATCH');
  if (typeof args.key !== 'string' || !noteKey.test(args.key) || typeof args.content !== 'string'
    || args.content.length > MAX_NOTE_CHARS || (args.source_artifact_ids !== undefined && typeof args.source_artifact_ids !== 'string')) throw new Error('INVALID_MISSION_NOTE');
  const sources = [...new Set(String(args.source_artifact_ids ?? '').split(',').map(id => id.trim()).filter(Boolean))];
  if (sources.length > 4) throw new Error('INVALID_NOTE_SOURCES');
  const notes = await loadMissionNotes(client, tenant, mission);
  if (args.content && !notes.some(note => note.key === args.key) && notes.length >= MAX_NOTES) throw new Error('NOTE_CAPACITY');
  await Promise.all(sources.map(id => getArtifact(client, tenant, mission, id)));
  const digest = contentHash({tenant, mission, subtask: context.subtask_id, args});
  const id = `${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20,32)}`;
  const message: Message = {message_id: id, tenant_id: tenant, mission_id: mission, from_agent: executor, to_agent: null,
    content: {kind: 'task_note', key: args.key, content: args.content, source_artifact_ids: sources, authority: 'model_report'},
    artifacts: sources, confidence: 0, created_at: new Date().toISOString()};
  const {error} = await client.rpc('spine_commit', {p_tenant: tenant, p_mission: mission, p_owner: owner,
    p_operations: [{op: 'insert', kind: 'messages', id, data: message}]});
  check(error);
  return {key: args.key, status: args.content ? 'saved' : 'deleted', message_id: id, cited: sources.length > 0,
    authority: 'model_report', durable: true};
}
