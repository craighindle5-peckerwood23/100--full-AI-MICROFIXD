/** Lossless duplicate compaction and whole-record budgeting. No model call. */
import {createHash} from 'node:crypto';
interface ContextRecord {id: string; content: string; created_at?: string; agent_id?: string; [key: string]: any}

function episode(record: ContextRecord): ContextRecord {
  let content = record.content;
  try {
    const value = JSON.parse(content);
    if (record.agent_id === 'brain' && Array.isArray(value.messages) && value.messages.length === 1
      && value.messages[0].role === 'user' && typeof value.messages[0].content === 'string' && typeof value.response === 'string'
      && Object.keys(value).every(key => ['messages', 'response'].includes(key))) {
      content = JSON.stringify({task: value.messages[0].content, output: value.response});
    }
  } catch { /* Plain-text episodes remain intact. */ }
  return {id: record.id, content, ...(record.created_at ? {created_at: record.created_at} : {})};
}

export function packMemoryContext(episodes: ContextRecord[], knowledge: ContextRecord[], maxChars: number) {
  if (!Number.isInteger(maxChars) || maxChars < 2) throw new Error('INVALID_CONTEXT_BUDGET');
  const compacted = new Map<string, ContextRecord>(), duplicateIds: string[] = [];
  for (const record of episodes.filter(row => row.agent_id !== 'delivery')) {
    const value = episode(record), hash = createHash('sha256').update(value.content).digest('hex');
    if (compacted.has(hash)) duplicateIds.push(record.id);
    else compacted.set(hash, value);
  }
  const selected: ContextRecord[] = [], omitted: string[] = [];
  // Structured knowledge is scoped and ranked by the caller. Conversation data
  // stays in chronological order after selecting the most recent whole records.
  const candidates = [...knowledge, ...compacted.values()];
  for (const record of candidates) {
    if (JSON.stringify([...selected, record]).length <= maxChars) selected.push(record);
    else omitted.push(record.id); // Keep scanning: one huge record cannot hide all smaller records.
  }
  const knowledgeIds = new Set(knowledge.map(record => record.id));
  const context = JSON.stringify([...selected.filter(record => knowledgeIds.has(record.id)),
    ...selected.filter(record => !knowledgeIds.has(record.id)).reverse()]);
  return {context, window: {returned: selected.length, max_chars: maxChars, used_chars: context.length,
    omitted: omitted.length, omitted_ids: omitted, deduplicated: duplicateIds.length, duplicate_ids: duplicateIds,
    compaction: 'whole_records_and_exact_duplicates', original_records_retained: true}};
}
