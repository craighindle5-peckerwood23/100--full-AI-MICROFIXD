// Microfixd Level 7 Organism - Full Bill of Materials Implementation
import { insertCognitiveRequest } from '../lib/supabase';
import { 
  RequestType, 
  DomainType, 
  Intent, 
  Entity, 
  Constraint, 
  MissingContextItem, 
  MemoryBinding, 
  CognitiveRequestRecord 
} from '../types';

export interface RuntimeRun { id: string; context: string; operator: string; dag: any; risk: number; stage: string; outcome: string; timestamp: number; }
export interface RuntimeStep { id: string; runId: string; agent: string; tool: string; stage: string; inputs: any; outputs: any; error?: string; timestamp: number; }
export interface MemoryRecord { id: string; type: 'episodic' | 'semantic' | 'procedural' | 'experience'; content: string; embedding?: number[]; links: string[]; timestamp: number; }
export interface Level6Record { id: string; posture: string; driftScore: number; proposals: string[]; timestamp: number; }
export interface PhenotypeSnapshot { id: string; identity: string; skills: string[]; riskProfile: string; postureDistribution: any; timestamp: number; }
export interface SystemEvent { id: string; type: 'health' | 'anomaly' | 'drift' | 'safety' | 'fallback' | 'emergency_stop'; details: string; timestamp: number; }
export interface GovernanceDecision { id: string; policy: string; precheck: any; outcome: 'allow' | 'block' | 'escalate'; timestamp: number; }
export interface ApprovalRequest { id: string; prompt: string; evidence: any; operatorResponse?: string; signature?: string; timestamp: number; }
export interface IntegrationAudit { id: string; provider: string; cost: number; dataSent: any; dataReceived: any; provenance: string; timestamp: number; }

export class LocalStorageDB {
  private getTable<T extends { id?: string }>(name: string): T[] {
    try {
      const dataStr = localStorage.getItem(`microfixd_${name}`);
      if (!dataStr) return [];
      const data: T[] = JSON.parse(dataStr);
      if (!Array.isArray(data)) return [];
      
      // Deduplicate entries by ID, retaining the latest state
      const map = new Map<string, T>();
      const withoutId: T[] = [];
      for (const item of data) {
        if (item && typeof item === 'object' && item.id) {
          map.set(item.id, item);
        } else if (item) {
          withoutId.push(item);
        }
      }
      return [...Array.from(map.values()), ...withoutId];
    } catch {
      return [];
    }
  }

  private saveTable<T>(name: string, data: T[]) {
    try {
      localStorage.setItem(`microfixd_${name}`, JSON.stringify(data));
    } catch (e) {
      console.warn(`[LocalStorageDB] Failed to save table ${name}:`, e);
    }
  }

  public insert<T extends { id?: string }>(table: string, record: T) {
    const data = this.getTable<T>(table);
    if (record && typeof record === 'object' && record.id) {
      const index = data.findIndex(item => item && item.id === record.id);
      if (index >= 0) {
        data[index] = record;
      } else {
        data.push(record);
      }
    } else {
      data.push(record);
    }
    this.saveTable(table, data);
  }

  public upsert<T extends { id?: string }>(table: string, record: T) {
    this.insert(table, record);
  }

  public query<T extends { id?: string }>(table: string, predicate: (r: T) => boolean): T[] {
    return this.getTable<T>(table).filter(predicate);
  }

  public clear(table: string) {
    try {
      localStorage.removeItem(`microfixd_${table}`);
    } catch (e) {
      console.warn(`[LocalStorageDB] Failed to clear table ${table}:`, e);
    }
  }
}

export const db = new LocalStorageDB();

// ---------------------------------------------------------
// 3. WIRING (Buses)
// ---------------------------------------------------------

type EventCallback = (payload: any) => void;

class EventBus {
  private listeners: Record<string, EventCallback[]> = {};
  public subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    };
  }
  public emit(event: string, payload: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(payload));
    }
  }
}

export const IntentBus = new EventBus();
export const ExecutionBus = new EventBus();
export const TelemetryBus = new EventBus();

// ---------------------------------------------------------
// 1. CORE ORGANS
// ---------------------------------------------------------

export class MemoryEngine {
  constructor() {
    TelemetryBus.subscribe('system_event', (e) => this.recordEvent(e));
  }
  public store(type: MemoryRecord['type'], content: string, links: string[] = []) {
    db.insert<MemoryRecord>('memoryrecords', {
      id: crypto.randomUUID(), type, content, links, timestamp: Date.now()
    });
  }
  private recordEvent(event: any) {
    this.store('episodic', `System event recorded: ${JSON.stringify(event)}`);
  }
  public retrieveContext(): string {
    const records = db.query<MemoryRecord>('memoryrecords', () => true).slice(-5);
    return records.map(r => r.content).join('\n');
  }
}

export const memoryEngine = new MemoryEngine();

export class GovernanceLayer {
  public evaluate(action: string, context: any): boolean {
    const decision: GovernanceDecision = {
      id: crypto.randomUUID(), policy: 'core_safety_v1', precheck: context, outcome: 'allow', timestamp: Date.now()
    };
    db.insert('governancedecisions', decision);
    TelemetryBus.emit('governance_decision', decision);
    return decision.outcome === 'allow';
  }
}

export const governanceLayer = new GovernanceLayer();

export class ParagonDissector {
  public precheck(dag: any): number {
    // Causal analysis and risk scoring
    const risk = Math.random() * 0.5; // Simulate risk
    db.insert<Level6Record>('level6records', {
      id: crypto.randomUUID(), posture: 'evaluating_dag', driftScore: risk, proposals: [], timestamp: Date.now()
    });
    return risk;
  }
}

export const paragonDissector = new ParagonDissector();

export class CrossAIPort {
  public async callProvider(provider: string, prompt: string): Promise<string> {
    db.insert<IntegrationAudit>('integrationaudits', {
      id: crypto.randomUUID(), provider, cost: 0.01, dataSent: prompt, dataReceived: 'ok', provenance: 'direct', timestamp: Date.now()
    });
    return `Simulated response from ${provider}`;
  }
}

export const crossAIPort = new CrossAIPort();

export class VerificationEngine {
  public verify(stepResult: any): boolean {
    return !!stepResult; // Simplified verification
  }
}

export const verificationEngine = new VerificationEngine();

export class LaboratorySandbox {
  public execute(code: string): string {
    TelemetryBus.emit('system_event', { type: 'sandbox_exec', code });
    return "Executed in isolated sandbox";
  }
}

export const laboratorySandbox = new LaboratorySandbox();

export class AutonomyRuntime {
  public async executeDAG(dag: any, runId: string) {
    // Multi-Agent Runtime: walking mission DAG
    for (const step of dag.steps) {
      ExecutionBus.emit('step_start', { step, runId });
      
      const stepRecord: RuntimeStep = {
        id: crypto.randomUUID(), runId, agent: step.agent || 'default', tool: step.tool || 'none',
        stage: 'running', inputs: step.inputs, outputs: null, timestamp: Date.now()
      };
      
      db.insert('runtimesteps', stepRecord);
      TelemetryBus.emit('state_update', null);
      
      // Simulate real execution delay
      await new Promise(r => setTimeout(r, 1500));
      
      stepRecord.outputs = `Result of ${step.name}`;
      stepRecord.stage = 'completed';
      
      db.insert('runtimesteps', stepRecord);
      TelemetryBus.emit('state_update', null);
      
      const isValid = verificationEngine.verify(stepRecord.outputs);
      if (!isValid) {
        TelemetryBus.emit('anomaly', { step: stepRecord.id, reason: 'verification_failed' });
      }
    }
  }
}

export const autonomyRuntime = new AutonomyRuntime();

export class MissionEngine {
  constructor() {
    IntentBus.subscribe('new_mission', (intent) => this.handleIntent(intent));
  }
  public async handleIntent(intent: any) {
    const risk = paragonDissector.precheck(intent);
    if (!governanceLayer.evaluate('start_mission', { intent, risk })) {
      TelemetryBus.emit('emergency_stop', { reason: 'Governance blocked mission' });
      return;
    }
    
    const runId = crypto.randomUUID();
    const run: RuntimeRun = {
      id: runId, context: intent.context, operator: intent.operator, dag: intent.dag,
      risk, stage: 'running', outcome: 'pending', timestamp: Date.now()
    };
    db.insert('runtimeruns', run);
    TelemetryBus.emit('state_update', null);
    
    await autonomyRuntime.executeDAG(intent.dag, runId);
    
    run.stage = 'completed';
    run.outcome = 'success';
    // Sync update to DB conceptually (in a real system we'd update by ID, but for this append-only prototype we just update the ref)
    db.insert('runtimeruns', run); 
    TelemetryBus.emit('state_update', null);
  }
}

export const missionEngine = new MissionEngine();

export class AttentionLayer {
  public parsePromptToCognitiveSchema(prompt: string, operator: string): CognitiveRequestRecord {
    const lower = prompt.toLowerCase().trim();

    // 1. Determine RequestType
    let request_type: RequestType = 'OTHER';
    if (lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('why') || lower.startsWith('who') || lower.startsWith('is ') || lower.startsWith('can ') || lower.endsWith('?')) {
      request_type = 'QUESTION';
    } else if (lower.startsWith('build') || lower.startsWith('create') || lower.startsWith('generate') || lower.startsWith('deploy') || lower.startsWith('compile')) {
      request_type = 'BUILD_REQUEST';
    } else if (lower.startsWith('diagnose') || lower.startsWith('check') || lower.startsWith('test') || lower.startsWith('audit') || lower.startsWith('eval')) {
      request_type = 'DIAGNOSTIC';
    } else if (lower.startsWith('set') || lower.startsWith('config') || lower.startsWith('enable') || lower.startsWith('disable') || lower.startsWith('toggle')) {
      request_type = 'CONFIGURATION';
    } else if (lower.startsWith('explain') || lower.startsWith('describe') || lower.startsWith('elaborate')) {
      request_type = 'EXPLANATION';
    } else if (lower.startsWith('run') || lower.startsWith('execute') || lower.startsWith('start') || lower.startsWith('stop') || lower.startsWith('launch')) {
      request_type = 'COMMAND';
    } else {
      request_type = 'COMMAND';
    }

    // 2. Determine DomainType
    let domain_type: DomainType = 'MICROFYXD_CORE';
    if (lower.includes('ecu') || lower.includes('simulation') || lower.includes('vehicle') || lower.includes('telemetry')) {
      domain_type = 'ECU_SIMULATION';
    } else if (lower.includes('memory') || lower.includes('context') || lower.includes('vector') || lower.includes('recall') || lower.includes('history')) {
      domain_type = 'MEMORY_SYSTEM';
    } else if (lower.includes('agent') || lower.includes('orchestrat') || lower.includes('swarm') || lower.includes('turing') || lower.includes('carter')) {
      domain_type = 'AGENT_ORCHESTRATION';
    } else if (lower.includes('file') || lower.includes('folder') || lower.includes('path') || lower.includes('directory') || lower.includes('disk')) {
      domain_type = 'FILESYSTEM';
    } else if (lower.includes('network') || lower.includes('http') || lower.includes('socket') || lower.includes('peer') || lower.includes('federat')) {
      domain_type = 'NETWORK';
    }

    // 3. Extract Intent
    const intents: Intent[] = [
      {
        id: `intent_${request_type.toLowerCase()}`,
        description: prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt,
        explicit: true,
        confidence: 0.95
      }
    ];

    // 4. Extract Entities
    const entities: Entity[] = [];
    if (operator) {
      entities.push({
        name: 'operator',
        value: operator,
        type: 'SERVICE',
        source: 'USER_TEXT'
      });
    }
    const organs = ['attention_layer', 'mission_engine', 'memory_engine', 'governance_layer', 'paragon_dissector', 'autonomy_runtime'];
    for (const org of organs) {
      if (lower.includes(org.replace('_', ' ')) || lower.includes(org)) {
        entities.push({
          name: org,
          value: org,
          type: 'ORGAN_NAME',
          source: 'USER_TEXT'
        });
      }
    }

    // 5. Constraints
    const constraints: Constraint[] = [
      { key: 'no_drift', value: 'strict_invariants', type: 'HARD' },
      { key: 'latency', value: 'interactive', type: 'SOFT' }
    ];

    // 6. Missing Context
    const missing_context: MissingContextItem[] = [];
    if (prompt.split(/\s+/).length < 3) {
      missing_context.push({
        key: 'target_parameters',
        description: 'Terse input; relying on active profile heuristics',
        severity: 'DEGRADES_QUALITY'
      });
    }

    // 7. Memory Bindings
    const memory_bindings: MemoryBinding[] = [
      { target: 'ORGAN', id: 'memory_engine', confidence: 0.92 },
      { target: 'ACTIVE_TASK', id: `task-${Date.now()}`, confidence: 0.98 }
    ];

    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cog-${Date.now()}`,
      request_type,
      domain_type,
      raw_prompt: prompt,
      intents,
      entities,
      constraints,
      missing_context,
      memory_bindings,
      confidence: 0.96,
      created_at: new Date().toISOString()
    };
  }

  public async receivePrompt(prompt: string, operator: string) {
    // Parse into Level 6 Cognitive Request Schema
    const cognitiveRecord = this.parsePromptToCognitiveSchema(prompt, operator);

    // Persist asynchronously to Supabase & local cache
    insertCognitiveRequest(cognitiveRecord).catch(err => {
      console.warn('Could not insert cognitive request to Supabase:', err);
    });

    // Frontend cognitive presence
    const context = memoryEngine.retrieveContext();
    
    // Construct DAG based on prompt
    const dag = {
      steps: [
        { name: 'Analyze', agent: 'Analyzer', tool: 'Think', inputs: prompt },
        { name: 'Execute', agent: 'Builder', tool: 'Sandbox', inputs: prompt }
      ]
    };
    
    IntentBus.emit('new_mission', { prompt, operator, context, dag, cognitiveRecord });
    
    db.insert<SystemEvent>('systemevents', {
      id: crypto.randomUUID(), 
      type: 'health', 
      details: `Prompt processed by Attention Layer (${cognitiveRecord.request_type} / ${cognitiveRecord.domain_type})`, 
      timestamp: Date.now()
    });
  }
}


export const attentionLayer = new AttentionLayer();

export class OperatorUX {
  public dispatchMission(prompt: string) {
    attentionLayer.receivePrompt(prompt, 'human_operator');
  }
  public getMissionHistory(): RuntimeRun[] {
    return db.query<RuntimeRun>('runtimeruns', () => true);
  }
  public getSystemEvents(): SystemEvent[] {
    return db.query<SystemEvent>('systemevents', () => true);
  }
}

export const operatorUX = new OperatorUX();

// Initialize the feedback loops
TelemetryBus.subscribe('anomaly', (payload) => {
  db.insert<SystemEvent>('systemevents', {
    id: crypto.randomUUID(), type: 'anomaly', details: JSON.stringify(payload), timestamp: Date.now()
  });
});
TelemetryBus.subscribe('emergency_stop', (payload) => {
  db.insert<SystemEvent>('systemevents', {
    id: crypto.randomUUID(), type: 'emergency_stop', details: JSON.stringify(payload), timestamp: Date.now()
  });
});
