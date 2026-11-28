import type {SupabaseClient} from '@supabase/supabase-js';
import type {Artifact, Mission, Subtask} from '../planner/executionSpine';
import {procedureMemoryId, rememberProcedure} from './knowledgeMemory';

/** Read a durable receipt in the caller's tenant. A success label is not a receipt. */
export async function readProcedureConsolidation(db: SupabaseClient, tenant: string, missionId: string) {
  if (!tenant?.trim() || !missionId?.trim()) throw new Error('MEMORY_IDENTITY_REQUIRED');
  const {data:row,error} = await db.from('spine_rows').select('data')
    .eq('tenant_id',tenant).eq('kind','missions').eq('id',missionId).maybeSingle();
  if (error) throw new Error('CONSOLIDATION_STORAGE_UNAVAILABLE');
  if (!row || row.data.tenant_id !== tenant || row.data.mission_id !== missionId) return null;
  const mission = row.data as Mission;
  if (mission.status !== 'succeeded' || !mission.result_artifact_id) return {status:'not_eligible',mission_id:missionId,mission_status:mission.status,durable:false};
  const {data:receipt,error:readError} = await db.from('microfixd_memory_records').select('id,content,metadata,created_at')
    .eq('tenant_id',tenant).eq('agent_id','procedure')
    .eq('id',procedureMemoryId(tenant,missionId,mission.result_artifact_id)).maybeSingle();
  if (readError) throw new Error('CONSOLIDATION_STORAGE_UNAVAILABLE');
  return {status:receipt?'consolidated':'not_consolidated',mission_id:missionId,mission_status:mission.status,
    durable:Boolean(receipt),scope:'historical_tool_sequence',receipt:receipt??null,
    limitations:['Historical execution is planning context, not authority to replay actions or proof of factual truth or measured improvement.']};
}

/** Durable completed missions are the recovery source. This never runs a tool,
 * calls a model, changes mission state, or promotes a failed/paused outcome.
 * The scan wraps and retries failed writes; only the bounded cursor is in RAM. */
export async function recoverProcedureConsolidation(db: SupabaseClient, afterSequence = 0, batchSize = 5) {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) throw new Error('INVALID_CONSOLIDATION_WINDOW');
  const {data, error} = await db.from('spine_rows').select('id,tenant_id,mission_id,data,sequence')
    .eq('kind','missions').eq('data->>status','succeeded').gt('sequence',afterSequence).order('sequence').limit(batchSize);
  if (error) throw new Error('CONSOLIDATION_SCAN_UNAVAILABLE');
  const report = {nextCursor:0, scanned:0, consolidated:0, existing:0, failed:0};
  for (const row of data ?? []) {
    report.scanned++;
    try {
      const mission = row.data as Mission;
      if (row.tenant_id !== mission.tenant_id || row.id !== mission.mission_id || row.mission_id !== mission.mission_id
        || !mission.tenant_id || mission.status !== 'succeeded' || !mission.result_artifact_id) throw new Error('INVALID_CONSOLIDATION_SOURCE');
      const {data:existing,error:readError} = await db.from('microfixd_memory_records').select('id')
        .eq('tenant_id',mission.tenant_id).eq('agent_id','procedure')
        .eq('id',procedureMemoryId(mission.tenant_id,mission.mission_id,mission.result_artifact_id)).maybeSingle();
      if (readError) throw new Error('CONSOLIDATION_STORAGE_UNAVAILABLE');
      if (existing) {report.existing++;continue;}
      const {data:records,error:sourceError} = await db.from('spine_rows').select('kind,data')
        .eq('tenant_id',mission.tenant_id).eq('mission_id',mission.mission_id).in('kind',['artifacts','subtasks']).order('sequence').limit(128);
      if (sourceError) throw new Error('CONSOLIDATION_SOURCE_UNAVAILABLE');
      if (records?.length === 128) throw new Error('CONSOLIDATION_SOURCE_WINDOW_EXCEEDED');
      const artifacts = (records ?? []).filter(r => r.kind === 'artifacts').map(r => r.data as Artifact);
      const final = artifacts.find(a => a.artifact_id === mission.result_artifact_id);
      if (!final) throw new Error('CONSOLIDATION_FINAL_MISSING');
      const subtasks = (records ?? []).filter(r => r.kind === 'subtasks').map(r => r.data as Subtask);
      await rememberProcedure(db,mission,final,artifacts,subtasks);
      // A reasoning-only or legacy mission may be ineligible. Never count a
      // no-op as learning, and never use process-local state as a durable receipt.
      const {data:receipt,error:receiptError} = await db.from('microfixd_memory_records').select('id')
        .eq('tenant_id',mission.tenant_id).eq('agent_id','procedure')
        .eq('id',procedureMemoryId(mission.tenant_id,mission.mission_id,mission.result_artifact_id)).maybeSingle();
      if (receiptError) throw new Error('CONSOLIDATION_RECEIPT_UNAVAILABLE');
      if (receipt) report.consolidated++;
    } catch {report.failed++;}
  }
  // Keep making progress past an invalid record or a single-tenant outage.
  // Wrapping revisits every failed job and permits restart recovery from zero.
  if (data?.length === batchSize) {
    const last = Number(data[data.length-1].sequence);
    if (!Number.isSafeInteger(last) || last <= afterSequence) throw new Error('INVALID_CONSOLIDATION_CURSOR');
    report.nextCursor = last;
  }
  return report;
}
