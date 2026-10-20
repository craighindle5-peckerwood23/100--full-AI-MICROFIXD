import {BackoffEngine} from '../utils/backoffEngine';
import {GovernedAdapterRuntime, type ToolEnvelope, type ToolOutcome} from '../tools/governedAdapterRuntime';

export interface MissionTask {
  taskId: string;
  missionId: string;
  endpoint: string;
  payload: Record<string, unknown>;
  maxRetries: number;
  timeoutMs: number;
  retrySafety?: 'read-only' | 'idempotent';
}
export interface DispatchResult {
  taskId: string;
  missionId: string;
  status: 'SUCCESS' | 'FAILED';
  adapterResponse?: ToolOutcome;
  error?: string;
  timestamp: string;
}
export class MissionDispatcher {
  private readonly maxConcurrentJobs: number;
  constructor(private readonly runtime: GovernedAdapterRuntime, maxConcurrency = 10) {
    if (!Number.isSafeInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 64) throw new RangeError('maxConcurrency must be between 1 and 64');
    this.maxConcurrentJobs = maxConcurrency;
  }
  async dispatchMissionBatch(tasks: MissionTask[]): Promise<DispatchResult[]> {
    if (!Array.isArray(tasks) || tasks.length > 1000) throw new RangeError('Batch size must not exceed 1000');
    const results = new Array<DispatchResult>(tasks.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < tasks.length) {
        const index = cursor++;
        results[index] = await this.executeSingleTaskWithRetry(tasks[index]);
      }
    };
    await Promise.all(Array.from({length: Math.min(this.maxConcurrentJobs, tasks.length)}, () => worker()));
    return results;
  }
  private async executeSingleTaskWithRetry(task: MissionTask): Promise<DispatchResult> {
    const stamp = () => new Date().toISOString();
    if (!task || typeof task.taskId !== 'string' || !task.taskId || typeof task.missionId !== 'string' || !task.missionId ||
        typeof task.endpoint !== 'string' || !task.endpoint || !task.payload || typeof task.payload !== 'object' || Array.isArray(task.payload) ||
        !Number.isSafeInteger(task.maxRetries) || task.maxRetries < 0 || task.maxRetries > 5 ||
        !Number.isSafeInteger(task.timeoutMs) || task.timeoutMs < 100 || task.timeoutMs > 120000) {
      return {taskId: task?.taskId ?? '', missionId: task?.missionId ?? '', status: 'FAILED', error: 'INVALID_TASK', timestamp: stamp()};
    }
    const envelope: ToolEnvelope = {
      missionId: task.missionId, subtaskId: task.taskId, tool: task.endpoint,
      arguments: task.payload, idempotencyKey: task.missionId + ':' + task.taskId
    };
    let lastError = 'Unknown execution error';
    for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
      try {
        const response = await this.runtime.execute(envelope, AbortSignal.timeout(task.timeoutMs));
        if (response.status === 'succeeded') return {taskId: task.taskId, missionId: task.missionId, status: 'SUCCESS', adapterResponse: response, timestamp: stamp()};
        lastError = response.error ?? 'Adapter execution failed';
        // Only explicitly idempotent or read-only operations may be retried.
        if (task.retrySafety && attempt < task.maxRetries) {
          await BackoffEngine.executeWait({baseDelayMs:100,maxDelayMs:Math.max(100,Math.min(task.timeoutMs,5000)),attempt:attempt+1});
          continue;
        }
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        // Authorization, missing registration and invalid input must never be retried.
        break;
      }
    }
    return {taskId: task.taskId, missionId: task.missionId, status: 'FAILED', error: lastError, timestamp: stamp()};
  }
}
