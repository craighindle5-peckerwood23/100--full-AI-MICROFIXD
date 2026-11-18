import {createHash, randomUUID} from 'node:crypto';

export const METACOGNITIVE_POLICY = Object.freeze({
  version: 'metacognition-v1', minReportedConfidence: 0.6, maxBranches: 8,
  scope: 'authenticated_api_and_durable_planner',
  rules: ['tenant_scope', 'emergency_stop', 'deadline', 'explicit_permissions',
    'existing_exact_action_approval', 'evidence_integrity', 'uncertainty', 'bounded_alternatives'] as const,
});
export type Verdict = 'allow' | 'quarantine' | 'escalate' | 'halt';
export interface Assessment {verdict: Verdict; reasons: string[]; correction: string | null}
export interface Confidence {score: number | null; source: 'unavailable' | 'reported'; calibrated: false}
export interface Alternative {
  id: string; kind: 'proceed' | 'defer' | 'observe' | 'stop';
  outcome: string; failure: string; evidence: string[]; uncertainty: 'unknown';
  human_view?: string; analytical_view?: string; missing_evidence?: string; authority?: 'model_report';
}
export interface Telemetry {
  schema_version: 1; policy_version: string; event_id: string; trace_id: string;
  tenant_id: string; mission_id: string | null; subtask_id: string | null;
  agent_id: string; action: string; phase: 'before' | 'candidate' | 'failed' | 'recovered';
  timestamp: string; duration_ms: number; input_hash: string; output_hash: string | null;
  confidence: Confidence; assessment: Assessment; alternatives: Alternative[];
  selected_alternative: string; exhaustive: false; error_code: string | null;
  metrics: {http_status?:number;tokens_used?:number;provider?:string;model?:string};
}
export interface Subject {
  tenant_id: string; mission_id?: string; subtask_id?: string; agent_id: string;
  action: string; input: unknown; deadline_at?: unknown; permitted?: boolean;
  alternatives?: Alternative[]; selected_alternative?: string;
}
export interface SupervisorStore {
  append(event: Telemetry): Promise<void>;
  halted(tenant: string): Promise<boolean>;
}
export class MetacognitiveIntervention extends Error {
  readonly code: string;
  constructor(readonly assessment: Assessment) {
    super('METACOGNITIVE_' + assessment.verdict.toUpperCase());
    this.code = this.message;
  }
}
export function digest(value: unknown): string {
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical((v as Record<string,unknown>)[k])).join(',') + '}';
    const s = JSON.stringify(v); if (s === undefined) throw new Error('INVALID_TELEMETRY_VALUE'); return s;
  };
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function reportedConfidence(value: unknown): Confidence {
  if (value === undefined || value === null) return {score:null,source:'unavailable',calibrated:false};
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new MetacognitiveIntervention({verdict:'quarantine',reasons:['INVALID_CONFIDENCE'],correction:'Regenerate a schema-valid candidate; do not execute external effects.'});
  return {score:value,source:'reported',calibrated:false};
}
export function alternatives(action: string, evidence: string[] = []): Alternative[] {
  return [
    {id:'proceed',kind:'proceed',outcome:'Perform the authorized action: '+action,failure:'Partial completion or an incorrect result may require reconciliation.',evidence,uncertainty:'unknown'},
    {id:'observe',kind:'observe',outcome:'Gather missing evidence before committing.',failure:'Observation may be unavailable or insufficient.',evidence:[],uncertainty:'unknown'},
    {id:'defer',kind:'defer',outcome:'Pause for an authorized operator decision.',failure:'Delay may prevent meeting the objective or deadline.',evidence:[],uncertainty:'unknown'},
    {id:'stop',kind:'stop',outcome:'Take no further action and retain the audit trail.',failure:'The objective remains incomplete; earlier effects are not reversed.',evidence:[],uncertainty:'unknown'},
  ];
}
const allow = (): Assessment => ({verdict:'allow',reasons:['POLICY_CHECKS_PASSED'],correction:null});
/** Deterministic control plane. Model reports cannot authorize tools or change this policy. */
export class MetacognitiveSupervisor {
  constructor(private readonly tenant: string, private readonly store: SupervisorStore,
    private readonly localHalted: () => boolean = () => false) {}

  private async checks(subject: Subject): Promise<Assessment> {
    if (!this.tenant || subject.tenant_id !== this.tenant) return {verdict:'halt',reasons:['TENANT_MISMATCH'],correction:'Restore authenticated tenant scope.'};
    if (this.localHalted() || await this.store.halted(this.tenant)) return {verdict:'halt',reasons:['EMERGENCY_STOP'],correction:'An administrator must review and reset the stop.'};
    if (subject.deadline_at !== undefined && (typeof subject.deadline_at !== 'string' || !Number.isFinite(Date.parse(subject.deadline_at)) || Date.now() >= Date.parse(subject.deadline_at))) return {verdict:'halt',reasons:['DEADLINE_EXCEEDED'],correction:'Review the deadline before resuming.'};
    if (subject.permitted === false) return {verdict:'halt',reasons:['ACTION_NOT_PERMITTED'],correction:'Use an explicitly permitted action.'};
    return allow();
  }
  private async record(subject: Subject, trace: string, phase: Telemetry['phase'], assessment: Assessment,
    started: number, output?: unknown, confidence: Confidence = reportedConfidence(null), errorCode: string | null = null): Promise<void> {
    const inputHash = digest(subject.input);
    const data=output&&typeof output==='object'?output as Record<string,any>:{};
    const evidence=data.evidence??{};
    const metrics:Telemetry['metrics']={};
    if(Number.isInteger(data.status)&&data.status>=100&&data.status<=599)metrics.http_status=data.status;
    const tokens=data.tokensUsed??evidence.tokens;
    if(typeof tokens==='number'&&Number.isFinite(tokens)&&tokens>=0)metrics.tokens_used=tokens;
    const provider=data.provider??evidence.provider,model=data.model??evidence.model;
    if(['groq','gemini','openrouter','cloudflare'].includes(provider))metrics.provider=provider;
    if(typeof model==='string'&&model.length<=120)metrics.model=model;
    const event: Telemetry = {
      schema_version:1,policy_version:METACOGNITIVE_POLICY.version,event_id:randomUUID(),trace_id:trace,
      tenant_id:this.tenant,mission_id:subject.mission_id??null,subtask_id:subject.subtask_id??null,
      agent_id:subject.agent_id,action:subject.action,phase,timestamp:new Date().toISOString(),
      duration_ms:Math.max(0,performance.now()-started),input_hash:inputHash,output_hash:output===undefined?null:digest(output),
      confidence,assessment,alternatives:subject.alternatives??alternatives(subject.action,[inputHash]),
      selected_alternative:assessment.verdict==='allow'?(subject.selected_alternative??'proceed'):assessment.verdict==='quarantine'?'observe':assessment.verdict==='escalate'?'defer':'stop',
      exhaustive:false,error_code:errorCode,metrics,
    };
    try {await this.store.append(event);} catch {throw new Error('METACOGNITIVE_TELEMETRY_UNAVAILABLE');}
  }
  async before(subject: Subject): Promise<string> {
    const trace=randomUUID(),started=performance.now();
    let decision:Assessment;
    try {decision=await this.checks(subject);} catch {throw new Error('METACOGNITIVE_CONTROL_UNAVAILABLE');}
    await this.record(subject,trace,'before',decision,started);
    if(decision.verdict!=='allow')throw new MetacognitiveIntervention(decision);
    return trace;
  }
  async candidate(subject: Subject, trace: string, output: unknown, options: {valid?: boolean; confidence?: unknown; recovered?: boolean;started?:number} = {}): Promise<void> {
    const started=options.started??performance.now();let decision=await this.checks(subject),confidence=reportedConfidence(null);
    if(decision.verdict==='allow'){
      try {confidence=reportedConfidence(options.confidence);} catch(error) {decision=(error as MetacognitiveIntervention).assessment;}
      if(options.valid===false)decision={verdict:'quarantine',reasons:['INVALID_OUTPUT_OR_EVIDENCE'],correction:'Retain the candidate hash and obtain a corrected output; reconcile any earlier external effect.'};
      else if(decision.verdict==='allow'&&confidence.score!==null&&confidence.score<METACOGNITIVE_POLICY.minReportedConfidence)decision={verdict:'escalate',reasons:['LOW_REPORTED_CONFIDENCE'],correction:'Gather independent evidence or request operator review before proceeding.'};
    }
    await this.record(subject,trace,options.recovered?'recovered':'candidate',decision,started,output,confidence);
    if(decision.verdict!=='allow')throw new MetacognitiveIntervention(decision);
  }
  async run<T>(subject: Subject, work: () => Promise<T>, validate: (output:T)=>boolean = () => true): Promise<T> {
    const trace=await this.before(subject),started=performance.now();
    try {
      const result=await work();
      await this.candidate(subject,trace,result,{valid:validate(result),started});
      return result;
    } catch(error) {
      if(!(error instanceof MetacognitiveIntervention)) {
        const raw=(error as {code?:unknown})?.code??(error instanceof Error?error.message:'');
        const code=typeof raw==='string'&&/^[A-Z][A-Z0-9_]{2,80}$/.test(raw)?raw:'EXECUTION_FAILED';
        await this.record(subject,trace,'failed',{verdict:'escalate',reasons:[code],correction:'Inspect failure evidence; retry only under the existing bounded retry and idempotency policy.'},started,undefined,reportedConfidence(null),code);
      }
      throw error;
    }
  }
}
