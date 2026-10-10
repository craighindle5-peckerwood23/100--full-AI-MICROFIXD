import { createHash, randomUUID } from 'node:crypto';

export function canonicalJSON(value: unknown): string {
 if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(value[k])).join(',')+'}';
 const text=JSON.stringify(value);if(text===undefined)throw new Error('INVALID_JSON');return text;
}
export function contentHash(value: unknown): string {return createHash('sha256').update(canonicalJSON(value)).digest('hex');}
export const EXECUTION_POLICY_VERSION = 'spine-2026-10-09.1';
export type UUID = string;
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
export type JSONObject = { [key: string]: JSONValue };
export interface Budget { max_attempts: number; backoff_ms: number; max_subtasks: number }
export interface Mission {
  mission_id: UUID; tenant_id: string; created_at: string; created_by: string;
  objective: string; constraints: JSONObject; status: 'queued' | 'running' | 'waiting' | 'failed' | 'succeeded';
  result_artifact_id: UUID | null;
}
export interface Task {
  task_id: UUID; mission_id: UUID; tenant_id: string; agent_id: UUID | null;
  tool_permissions: string[]; input_context: JSONObject; expected_output_schema: JSONObject;
  status: 'queued' | 'running' | 'blocked' | 'failed' | 'succeeded'; attempts: number;
}
export interface Subtask {
  subtask_id: UUID; task_id: UUID; tenant_id: string; agent_id: UUID | null;
  tool_request: JSONObject | null; input: JSONValue;
  status: 'queued' | 'running' | 'waiting_input' | 'failed' | 'succeeded'; attempts: number;
  raw_output: JSONValue; normalized_output: JSONValue;
}
export type ArtifactType = 'text' | 'json' | 'screenshot' | 'audio' | 'obd_data' | 'mission_result';
export interface Artifact {
  artifact_id: UUID; mission_id: UUID; tenant_id: string; task_id: UUID | null; subtask_id: UUID | null;
  type: ArtifactType; content: JSONValue; evidence: JSONObject; hash: string;
}
export interface Message {
  message_id: UUID; tenant_id: string; from_agent: UUID; to_agent: UUID | null; mission_id: UUID;
  content: JSONValue; artifacts: UUID[]; confidence: number; created_at: string;
}
export interface MissionRepository {
  createMission(mission: Mission): Promise<void>;
  getMission(id: UUID): Promise<Mission>;
  updateMissionStatus(id: UUID, status: Mission['status']): Promise<void>;
  attachResultArtifact(id: UUID, artifactId: UUID): Promise<void>;
}
export interface TaskRepository {
  createTask(task: Task): Promise<void>;
  getTasks(missionId: UUID): Promise<Task[]>;
  updateTaskStatus(id: UUID, status: Task['status']): Promise<void>;
  incrementTaskAttempts(id: UUID): Promise<void>;
}
export interface SubtaskRepository {
  createSubtask(subtask: Subtask): Promise<void>;
  getSubtasks(taskId: UUID): Promise<Subtask[]>;
  updateSubtaskStatus(id: UUID, status: Subtask['status']): Promise<void>;
  incrementSubtaskAttempts(id: UUID): Promise<void>;
  setSubtaskAttempts(id: UUID, attempts: number): Promise<void>;
  setSubtaskOutputs(id: UUID, raw: JSONValue, normalized: JSONValue): Promise<void>;
}
export interface ArtifactRepository {
  createArtifact(artifact: Artifact): Promise<void>;
  getArtifacts(missionId: UUID): Promise<Artifact[]>;
}
export interface MessageRepository {
  createMessage(message: Message): Promise<void>;
  getMessagesForAgent(agentId: UUID, missionId: UUID): Promise<Message[]>;
}
export interface Repositories extends MissionRepository, TaskRepository, SubtaskRepository, ArtifactRepository, MessageRepository {}
export interface ExecutionResult { raw: JSONValue; normalized: JSONValue; evidence: JSONObject }
export interface ExecutionContext {
  tenant_id: string; mission_id: UUID; subtask_id: UUID; idempotency_key: string;
  constraints: JSONObject; tool_permissions: string[];
}
export interface PlannedTask {
  agent_id: UUID | null; tool_permissions: string[]; input_context: JSONObject;
  expected_output_schema: JSONObject;
  subtasks: { agent_id: UUID | null; tool_request: JSONObject | null; input: JSONValue }[];
}
export type SchemaValidator = (value: JSONValue, schema: JSONObject) => boolean;
export interface SupervisorDecision { approved: boolean; canonical_artifact_id: UUID | null; reason: string }
export class SupervisorService {
  constructor(private validate: SchemaValidator) {}
  evaluateTaskOutputs(task: Task, artifacts: Artifact[]): SupervisorDecision {
    const eligible = artifacts.filter(a => a.tenant_id === task.tenant_id && a.task_id === task.task_id
      && a.mission_id === task.mission_id && Object.keys(a.evidence).length > 0
      && a.hash===contentHash(a.content) && this.validate(a.content, task.expected_output_schema));
    if (!eligible.length) return { approved: false, canonical_artifact_id: null, reason: 'No schema-valid output with evidence' };
    return { approved: true, canonical_artifact_id: this.selectCanonicalArtifact(eligible).artifact_id, reason: 'Validated output' };
  }
  selectCanonicalArtifact(artifacts: Artifact[]): Artifact {
    if (!artifacts.length) throw new Error('NO_CANONICAL_ARTIFACT');
    const score = (a: Artifact) => {
      const c = a.evidence.confidence;
      return typeof c === 'number' && Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0;
    };
    return [...artifacts].sort((a, b) => score(b) - score(a) || a.artifact_id.localeCompare(b.artifact_id))[0];
  }
}
export class AgentBus {
  constructor(private repository: MessageRepository, private tenantId: string) {}
  async publishMessage(message: Message): Promise<void> {
    if (message.tenant_id !== this.tenantId || !Number.isFinite(message.confidence)
      || message.confidence < 0 || message.confidence > 1) throw new Error('INVALID_MESSAGE');
    await this.repository.createMessage(message);
  }
  getMessagesForAgent(agentId: UUID, missionId: UUID): Promise<Message[]> {
    return this.repository.getMessagesForAgent(agentId, missionId);
  }
}
export interface PlannerDependencies {
  // Transaction must commit all writes or none. Lock must span the entire callback.
  repository: Repositories;
  transaction<T>(work: (repository: Repositories) => Promise<T>): Promise<T>;
  withMissionLock<T>(tenantId: string, missionId: UUID, work: () => Promise<T>): Promise<T>;
  plan(mission: Mission): Promise<PlannedTask[]>;
  executeTool(request: JSONObject, context: ExecutionContext): Promise<ExecutionResult>;
  invokeAgent(input: JSONValue, agentId: UUID | undefined, context: ExecutionContext): Promise<ExecutionResult>;
  validate: SchemaValidator;
  // Append error events durably; never include keys or credentials.
  recordError(context: ExecutionContext, error: unknown, attempt: number): Promise<void>;
  retryable(error: unknown): boolean;
  onTaskDecision?(task: Task, decision: SupervisorDecision, artifacts: Artifact[]): Promise<void>;
  recoverAgent?(subtask: Subtask, context: ExecutionContext): Promise<ExecutionResult | null>;
  recoverTool?(subtask: Subtask, context: ExecutionContext): Promise<ExecutionResult | null>;
  budget: Budget;
  sleep?: (ms: number) => Promise<void>;
}
export function deadlineExceeded(mission:Mission,now=Date.now()):boolean {const deadline=mission.constraints.deadline_at;return deadline!==undefined&&(typeof deadline!=='string'||!Number.isFinite(Date.parse(deadline))||now>=Date.parse(deadline));}
const artifactId = (mission: UUID, unit: UUID) => createHash('sha256').update(`${mission}:${unit}`).digest('hex').slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
function makeArtifact(m: Mission, task: UUID | null, subtask: UUID | null, content: JSONValue, evidence: JSONObject): Artifact {
  const serialized = JSON.stringify(content);
  if (serialized === undefined) throw new Error('INVALID_ARTIFACT_CONTENT');
  return { artifact_id: artifactId(m.mission_id, subtask ?? 'final'), mission_id: m.mission_id,
    tenant_id: m.tenant_id, task_id: task, subtask_id: subtask, type: subtask ? 'json' : 'mission_result',
    content, evidence: {...evidence, policy_version: EXECUTION_POLICY_VERSION, constraints_hash: contentHash(m.constraints), objective_hash: contentHash(m.objective)}, hash: contentHash(content) };
}
export class PlannerService {
  private supervisor: SupervisorService;
  constructor(private d: PlannerDependencies) {
    const b = d.budget;
    if (!Number.isInteger(b.max_attempts) || b.max_attempts < 1 || b.max_attempts > 10
      || !Number.isInteger(b.max_subtasks) || b.max_subtasks < 1
      || !Number.isFinite(b.backoff_ms) || b.backoff_ms < 0 || b.backoff_ms > 60000) throw new Error('INVALID_BUDGET');
    this.supervisor = new SupervisorService(d.validate);
  }
  async planAndExecuteMission(mission: Mission): Promise<Mission> {
    return this.d.withMissionLock(mission.tenant_id, mission.mission_id, async () => {
      const r = this.d.repository;
      // createMission is insert-if-absent; it must never overwrite existing execution state.
      await r.createMission({ ...mission, objective: mission.objective.trim().replace(/\s+/g, ' ') });
      const current = await r.getMission(mission.mission_id);
      if (current.tenant_id !== mission.tenant_id) throw new Error('TENANT_MISMATCH');
      if (['succeeded', 'failed', 'waiting'].includes(current.status)) return current;
      if (!current.objective) throw new Error('EMPTY_OBJECTIVE');
      if(deadlineExceeded(current)){await r.updateMissionStatus(current.mission_id,'waiting');return r.getMission(current.mission_id);}
      let tasks = await r.getTasks(current.mission_id);
      if (!tasks.length) {
        let plan: PlannedTask[];
        try { plan = await this.d.plan(current); } catch (error) {
          await r.updateMissionStatus(current.mission_id, ['TOKEN_BUDGET_EXHAUSTED','PROVIDERS_EXHAUSTED'].includes((error as {code?:string})?.code) ? 'waiting' : 'failed');
          return r.getMission(current.mission_id);
        }
        const count = plan.reduce((n, t) => n + t.subtasks.length, 0);
        const allowed = current.constraints.tool_permissions;
        if (!plan.length || count > this.d.budget.max_subtasks || plan.some(t => !t.subtasks.length
          || !Object.keys(t.expected_output_schema).length || t.tool_permissions.some(p => !Array.isArray(allowed) || !allowed.includes(p))))
          {await r.updateMissionStatus(current.mission_id,'failed');return r.getMission(current.mission_id);}
        await this.d.transaction(async tx => {
          for (const p of plan) {
            const task: Task = { ...p, task_id: randomUUID(), mission_id: current.mission_id,
              tenant_id: current.tenant_id, status: 'queued', attempts: 0 };
            delete (task as Task & { subtasks?: unknown }).subtasks;
            await tx.createTask(task);
            for (const s of p.subtasks) await tx.createSubtask({ ...s, subtask_id: randomUUID(), task_id: task.task_id,
              tenant_id: current.tenant_id, status: 'queued', attempts: 0, raw_output: null, normalized_output: null });
          }
          await tx.updateMissionStatus(current.mission_id, 'running');
        });
        tasks = await r.getTasks(current.mission_id);
      } else await r.updateMissionStatus(current.mission_id, 'running');
      const canonical: Artifact[] = [];
      for (const task of tasks) {
        if (task.status === 'blocked' || task.status === 'failed') {
          await r.updateMissionStatus(current.mission_id, 'waiting'); return r.getMission(current.mission_id);
        }
        if(task.status!=='succeeded'){await r.updateTaskStatus(task.task_id, 'running');await r.incrementTaskAttempts(task.task_id);}
        const subtasks = await r.getSubtasks(task.task_id);
        for (const sub of subtasks) {
          if (sub.status === 'succeeded') continue;
          if (sub.status === 'waiting_input' || sub.status === 'failed') {
            await r.updateTaskStatus(task.task_id, 'blocked'); await r.updateMissionStatus(current.mission_id, 'waiting');
            return r.getMission(current.mission_id);
          }
          const context: ExecutionContext = { tenant_id: current.tenant_id, mission_id: current.mission_id,
            subtask_id: sub.subtask_id, idempotency_key: `${current.tenant_id}:${sub.subtask_id}`,
            constraints: current.constraints, tool_permissions: task.tool_permissions };
          let completed = false;
          const recover=sub.tool_request?this.d.recoverTool:this.d.recoverAgent;
          if (recover) {
            let recovered: ExecutionResult | null;
            try { recovered = await recover(sub, context); } catch (error) {
              if ((error as {code?:string})?.code !== 'RECONCILIATION_REQUIRED') throw error;
              await this.d.transaction(async tx => {await tx.updateSubtaskStatus(sub.subtask_id,'waiting_input');await tx.updateTaskStatus(task.task_id,'blocked');await tx.updateMissionStatus(current.mission_id,'waiting');});
              return r.getMission(current.mission_id);
            }
            if (recovered) {
              if (!this.d.validate(recovered.normalized, task.expected_output_schema)||!recovered.evidence||!Object.keys(recovered.evidence).length) throw new Error('INVALID_RECOVERED_OUTPUT');
              await this.d.transaction(async tx => {
                await tx.setSubtaskOutputs(sub.subtask_id,recovered.raw,recovered.normalized);
                await tx.createArtifact(makeArtifact(current,task.task_id,sub.subtask_id,recovered.normalized,recovered.evidence));
                await tx.updateSubtaskStatus(sub.subtask_id,'succeeded');
              });
              continue;
            }
          }
          for (let attempt = sub.attempts + 1; attempt <= this.d.budget.max_attempts; attempt++) {
            if(deadlineExceeded(current)){await this.d.recordError(context,Object.assign(new Error('MISSION_DEADLINE_EXCEEDED'),{code:'MISSION_DEADLINE_EXCEEDED'}),sub.attempts);await this.d.transaction(async tx=>{await tx.updateTaskStatus(task.task_id,'blocked');await tx.updateMissionStatus(current.mission_id,'waiting');});return r.getMission(current.mission_id);}
            await this.d.transaction(async tx => { await tx.incrementSubtaskAttempts(sub.subtask_id); await tx.updateSubtaskStatus(sub.subtask_id, 'running'); });
            let output: ExecutionResult;
            try {
              if (sub.tool_request && (typeof sub.tool_request.name !== 'string' || !task.tool_permissions.includes(sub.tool_request.name)))
                throw new Error('TOOL_NOT_PERMITTED');
              output = sub.tool_request ? await this.d.executeTool(sub.tool_request, context)
                : await this.d.invokeAgent(sub.input, sub.agent_id ?? undefined, context);
              if (!this.d.validate(output.normalized, task.expected_output_schema) || !Object.keys(output.evidence).length)
                throw new Error('INVALID_OUTPUT_OR_MISSING_EVIDENCE');
            } catch (error) {
              await this.d.recordError(context, error, attempt);
              if (['TOKEN_BUDGET_EXHAUSTED','PROVIDERS_EXHAUSTED'].includes((error as {code?:string})?.code) || (error as {code?:string})?.code === 'WAITING_APPROVAL' || (error as {code?:string})?.code === 'RECONCILIATION_REQUIRED') {
                await this.d.transaction(async tx => {if((error as {code?:string})?.code!=='RECONCILIATION_REQUIRED')await tx.setSubtaskAttempts(sub.subtask_id,attempt-1);await tx.updateSubtaskStatus(sub.subtask_id,'waiting_input');await tx.updateTaskStatus(task.task_id,'blocked');await tx.updateMissionStatus(current.mission_id,'waiting');});
                return r.getMission(current.mission_id);
              }
              if (!this.d.retryable(error) || attempt === this.d.budget.max_attempts) break;
              await r.updateSubtaskStatus(sub.subtask_id, 'queued');
              await (this.d.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(Math.min(60000, this.d.budget.backoff_ms * 2 ** (attempt - 1)));
              continue;
            }
            // Persistence failures propagate: never blindly retry a successful external effect.
            await this.d.transaction(async tx => {
              await tx.setSubtaskOutputs(sub.subtask_id, output.raw, output.normalized);
              await tx.createArtifact(makeArtifact(current, task.task_id, sub.subtask_id, output.normalized, output.evidence));
              await tx.updateSubtaskStatus(sub.subtask_id, 'succeeded');
            });
            completed = true; break;
          }
          if (!completed) {
            await this.d.transaction(async tx => { await tx.updateSubtaskStatus(sub.subtask_id, 'failed');
              await tx.updateTaskStatus(task.task_id, 'blocked'); await tx.updateMissionStatus(current.mission_id, 'waiting'); });
            return r.getMission(current.mission_id);
          }
        }
        const artifacts = (await r.getArtifacts(current.mission_id)).filter(a => a.task_id === task.task_id);
        const verified = artifacts.filter(a => this.supervisor.evaluateTaskOutputs(task, [a]).approved);
        const complete = subtasks.length > 0 && subtasks.every(sub => verified.some(a => a.subtask_id === sub.subtask_id));
        const decision: SupervisorDecision = complete ? this.supervisor.evaluateTaskOutputs(task, verified)
          : {approved:false, canonical_artifact_id:null, reason:'Missing or invalid evidence for a required subtask'};
        await this.d.onTaskDecision?.(task, decision, artifacts);
        if (!decision.approved) { await r.updateTaskStatus(task.task_id, 'blocked'); await r.updateMissionStatus(current.mission_id, 'waiting'); return r.getMission(current.mission_id); }
        canonical.push(artifacts.find(a => a.artifact_id === decision.canonical_artifact_id)!);
        await r.updateTaskStatus(task.task_id, 'succeeded');
      }
      // Deterministic assembly avoids an additional model call and retains every verified output.
      const artifacts = await r.getArtifacts(current.mission_id);
      const final = makeArtifact(current, null, null, { outputs: artifacts.filter(a => a.subtask_id !== null).map(a => ({ artifact_id: a.artifact_id, content: a.content })),
        canonical_artifacts: canonical.map(a => a.artifact_id) }, { artifact_ids: artifacts.filter(a => a.subtask_id !== null).map(a => a.artifact_id), provenance: artifacts.filter(a => a.subtask_id !== null).map(a => ({artifact_id:a.artifact_id, task_id:a.task_id, subtask_id:a.subtask_id, content_hash:a.hash, evidence_hash:contentHash(a.evidence)})) });
      await this.d.transaction(async tx => { await tx.createArtifact(final); await tx.attachResultArtifact(current.mission_id, final.artifact_id);
        await tx.updateMissionStatus(current.mission_id, 'succeeded'); });
      return r.getMission(current.mission_id);
    });
  }
}
export async function executeTool(_request: unknown): Promise<ExecutionResult> { throw new Error('TOOL_ADAPTER_NOT_CONFIGURED'); }
export async function invokeAgent(_input: unknown, _agentId?: string): Promise<ExecutionResult> { throw new Error('AGENT_ADAPTER_NOT_CONFIGURED'); }

export type Row = Mission | Task | Subtask | Artifact | Message;
export type Table = 'missions' | 'tasks' | 'subtasks' | 'artifacts' | 'messages';
export interface Database {
  // Adapter must add tenant predicates, stable ordering, parameterized SQL, and enforce parent tenant FKs.
  insertIfAbsent(table: Table, id: string, row: Row, tenantId: string): Promise<void>;
  get<T extends Row>(table: Table, id: string, tenantId: string): Promise<T>;
  list<T extends Row>(table: Table, filters: Record<string, string>, tenantId: string): Promise<T[]>;
  patch(table: Table, id: string, changes: Record<string, JSONValue>, tenantId: string): Promise<void>;
  increment(table: Table, id: string, field: 'attempts', tenantId: string): Promise<void>;
}
export class DatabaseRepositories implements Repositories {
  constructor(private db: Database, private tenantId: string) {}
  private insert(table: Table, id: string, row: Row) {
    if (row.tenant_id !== this.tenantId) throw new Error('TENANT_MISMATCH');
    return this.db.insertIfAbsent(table, id, row, this.tenantId);
  }
  createMission(m: Mission) { return this.insert('missions', m.mission_id, m); }
  getMission(id: UUID) { return this.db.get<Mission>('missions', id, this.tenantId); }
  updateMissionStatus(id: UUID, status: Mission['status']) { return this.db.patch('missions', id, { status }, this.tenantId); }
  attachResultArtifact(id: UUID, result_artifact_id: UUID) { return this.db.patch('missions', id, { result_artifact_id }, this.tenantId); }
  createTask(t: Task) { return this.insert('tasks', t.task_id, t); }
  getTasks(mission_id: UUID) { return this.db.list<Task>('tasks', { mission_id }, this.tenantId); }
  updateTaskStatus(id: UUID, status: Task['status']) { return this.db.patch('tasks', id, { status }, this.tenantId); }
  incrementTaskAttempts(id: UUID) { return this.db.increment('tasks', id, 'attempts', this.tenantId); }
  createSubtask(s: Subtask) { return this.insert('subtasks', s.subtask_id, s); }
  getSubtasks(task_id: UUID) { return this.db.list<Subtask>('subtasks', { task_id }, this.tenantId); }
  updateSubtaskStatus(id: UUID, status: Subtask['status']) { return this.db.patch('subtasks', id, { status }, this.tenantId); }
  setSubtaskAttempts(id: UUID, attempts: number) { return this.db.patch('subtasks',id,{attempts},this.tenantId); }
  incrementSubtaskAttempts(id: UUID) { return this.db.increment('subtasks', id, 'attempts', this.tenantId); }
  setSubtaskOutputs(id: UUID, raw_output: JSONValue, normalized_output: JSONValue) { return this.db.patch('subtasks', id, { raw_output, normalized_output }, this.tenantId); }
  createArtifact(a: Artifact) { return this.insert('artifacts', a.artifact_id, a); }
  getArtifacts(mission_id: UUID) { return this.db.list<Artifact>('artifacts', { mission_id }, this.tenantId); }
  createMessage(m: Message) { return this.insert('messages', m.message_id, m); }
  async getMessagesForAgent(agentId: UUID, mission_id: UUID) {
    const messages = await this.db.list<Message>('messages', { mission_id }, this.tenantId);
    return messages.filter(m => m.to_agent === null || m.to_agent === agentId);
  }
}
