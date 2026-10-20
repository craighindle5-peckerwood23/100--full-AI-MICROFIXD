import type {DispatchResult} from './missionDispatcher';

export interface DatabaseConnection {
  execute(query: string, params: readonly unknown[]): Promise<{rowCount: number; rows: Array<Record<string, unknown>>}>;
}
export interface MetricSummary {
  totalDispatched: number;
  successCount: number;
  failureCount: number;
  reliabilityRate: number;
}
const TABLE = 'mission_dispatch_logs';
export class DispatcherTrackingHook {
  constructor(private readonly db: DatabaseConnection) {}
  async logEvent(result: DispatchResult): Promise<boolean> {
    if (!result.taskId || !result.missionId || !['SUCCESS','FAILED'].includes(result.status) || !Number.isFinite(Date.parse(result.timestamp))) {
      throw new TypeError('Invalid dispatch result');
    }
    const query = `INSERT INTO public.${TABLE} (task_id,mission_id,status,response_payload,error_message,executed_at)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6::timestamptz)
      ON CONFLICT (mission_id,task_id) DO NOTHING`;
    const params = [result.taskId,result.missionId,result.status,result.adapterResponse ? JSON.stringify(result.adapterResponse) : null,result.error ?? null,result.timestamp];
    try {
      const outcome = await this.db.execute(query, params);
      if (outcome.rowCount !== 1) throw new Error('Dispatch event already recorded or not committed');
      return true;
    } catch (error) {
      throw new Error('Database tracking hook failure', {cause:error});
    }
  }
  async getMissionMetrics(missionId: string): Promise<MetricSummary> {
    if (!missionId) throw new TypeError('missionId is required');
    const query = `SELECT count(*) AS total, count(*) FILTER (WHERE status='SUCCESS') AS successes,
      count(*) FILTER (WHERE status='FAILED') AS failures FROM public.${TABLE} WHERE mission_id=$1`;
    try {
      const result = await this.db.execute(query,[missionId]);
      const row = result.rows[0];
      if (!row) throw new Error('Metric query returned no aggregate');
      const total = Number(row.total), successes = Number(row.successes), failures = Number(row.failures);
      if (![total,successes,failures].every(Number.isSafeInteger) || Math.min(total,successes,failures)<0 || successes+failures!==total) throw new Error('Invalid metric aggregation');
      return {totalDispatched:total,successCount:successes,failureCount:failures,reliabilityRate:total===0?100:Math.round(successes/total*10000)/100};
    } catch (error) {
      throw new Error('Database tracking aggregation failure', {cause:error});
    }
  }
}
