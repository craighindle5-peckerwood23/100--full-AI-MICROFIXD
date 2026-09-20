export type BootState = 'darkness' | 'particles' | 'hologram' | 'avatar' | 'orbit';

export type Subsystem = 
  | 'mission_control'
  | 'ai_core'
  | 'agents'
  | 'sandbox'
  | 'workspace'
  | 'infra'
  | 'telemetry'
  | 'memory'
  | 'learning'
  | 'automation'
  | 'autonomy'
  | 'supabase'
  | 'governance'
  | 'federation'
  | 'bible';

export type AvatarState = 'idle' | 'processing' | 'alert' | 'success' | 'learning';

export interface SystemMetrics {
  cpu: number;
  memory: number;
  gpu: number;
  network: number;
  activeAgents: number;
  quantumCoherence?: number;
  tokensPerSec?: number;
}

export type MissionStatus = 'planned' | 'queued' | 'running' | 'completed' | 'failed' | 'paused';

export interface MissionNode {
  id: string;
  label: string;
  type: 'task' | 'agent' | 'evaluator' | 'safety_gate' | 'output';
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgent?: string;
  duration?: string;
  output?: string;
}

export interface Mission {
  id: string;
  title: string;
  codeName: string;
  objective: string;
  status: MissionStatus;
  progress: number;
  priority: 'CRITICAL' | 'HIGH' | 'ROUTINE';
  assignedSquad: string[];
  nodes: MissionNode[];
  logs: string[];
  createdAt: string;
}

export type AgentStatus = 'active' | 'idle' | 'degraded' | 'isolated';

export interface AgentRecord {
  id: string;
  name: string;
  callsign: string;
  role: string;
  specialization: string;
  status: AgentStatus;
  autonomyLevel: number; // 1 to 6
  currentTask: string;
  memoryAllocated: string;
  activeContextTokens: number;
  constitutionalSafetyRating: number; // 0-100%
  capabilities: string[];
}

export interface SandboxJob {
  id: string;
  name: string;
  language: 'python' | 'node' | 'rust' | 'wasm';
  status: 'running' | 'completed' | 'queued' | 'isolated';
  executionTime: string;
  memoryUsed: string;
  output: string;
  securityViolations: number;
}

export interface SandboxWorkspace {
  id: string;
  name: string;
  environment: string;
  status: 'Running' | 'Protected' | 'Stopped';
  isolationTier: 'Hypervisor-v6' | 'WASM-Microkernel' | 'Memory-Sealed';
  jobs: SandboxJob[];
}

export interface MemoryNode {
  id: string;
  title: string;
  type: 'episodic' | 'semantic' | 'working' | 'constitutional';
  summary: string;
  weight: number; // 0.0 - 1.0
  connections: string[]; // ids of connected nodes
  timestamp: string;
  tags: string[];
}

export interface LearningCycle {
  id: string;
  epoch: number;
  topic: string;
  metaReflection: string;
  heuristicDelta: string;
  lossValue: number;
  status: 'stabilized' | 'converging' | 'active';
  timestamp: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  enabled: boolean;
  lastExecuted: string;
  executionCount: number;
}

export interface ConstitutionalDirective {
  id: number;
  title: string;
  rule: string;
  enforcementMode: 'STRICT_BLOCK' | 'QUARANTINE_ESCALATE' | 'HUMAN_VERIFY';
  auditCount: number;
  lastAudited: string;
  complianceRatio: string;
}

export interface CognitiveTraceStep {
  id: string;
  layer: string;
  thought: string;
  confidence: number;
  latencyMs: number;
  timestamp: string;
}

// Autonomous Core, Self-Healing, Watchdog, & Execution Engine
export type ProblemSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type ProblemCategory = 'CONNECTIVITY' | 'AGENT_DEGRADATION' | 'MEMORY_LEAK' | 'MISSION_STALL' | 'SANDBOX_SECURITY';

export interface AutonomousProblem {
  id: string;
  category: ProblemCategory;
  severity: ProblemSeverity;
  subsystem: string;
  title: string;
  description: string;
  detectedAt: string;
  timestampMs: number;
  resolved: boolean;
  resolvedAt?: string;
  resolutionActionId?: string;
  autoRemediated: boolean;
}

export interface SelfHealingAction {
  id: string;
  problemId: string;
  title: string;
  targetSubsystem: string;
  actionTaken: string;
  status: 'PENDING' | 'EXECUTING' | 'SUCCESS' | 'ROLLED_BACK';
  executedAt: string;
  latencyMs: number;
  undoSupported: boolean;
  metaReasoning: string;
}

export interface FallbackAlertState {
  active: boolean;
  primaryProvider: string;
  primaryModel: string;
  fallbackProvider: string;
  fallbackModel: string;
  reason: string;
  switchedAt: string;
  timestampMs: number;
  manualOverrideActive: boolean;
  forcedProvider?: string;
  dismissed: boolean;
}

export interface WatchdogStatus {
  heartbeatCount: number;
  lastPulseTime: string;
  frequencyHz: number;
  activeWatchers: number;
  systemEntropy: number; // 0.0 - 1.0
  invariantsPassed: number;
  invariantsFailed: number;
  status: 'HEALTHY' | 'DEGRADED' | 'REPAIRING';
}

export interface MetaPerspectiveReport {
  timestamp: string;
  systemCoherence: number; // 0 - 100%
  activeDirectivesEnforced: number;
  totalRemediations24h: number;
  autonomousConvergenceRate: number; // e.g. 99.4%
  supervisorReflection: string;
  orchestrationHealth: 'NOMINAL' | 'ELEVATED_HEALING' | 'MANUAL_SUPERVISION_REQUIRED';
}

export interface ExecutionJob {
  id: string;
  name: string;
  type: 'HEALING_PATCH' | 'CONNECTIVITY_FAILOVER' | 'AGENT_RESET' | 'MEMORY_COMPACT' | 'TASK_DISPATCH';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  progress: number;
  steps: string[];
  currentStepIndex: number;
  createdAt: string;
  executedBy: 'AUTONOMOUS_CORE' | 'MANUAL_OVERRIDE';
}

// ==========================================
// Cognitive Schema (Supabase & Attention Layer)
// Canonical source: microfyxd/core/interpretation/schema.ts
// ==========================================

import type {
  RequestType,
  DomainType,
  Intent,
  Entity,
  Constraint,
  MissingContextItem,
  MemoryBinding,
} from '../microfyxd/core/interpretation/schema';

export * from '../microfyxd/core/interpretation/schema';

export interface CognitiveRequestRecord {
  id: string;
  request_type: RequestType;
  domain_type: DomainType;
  raw_prompt?: string;
  intents: Intent[];
  entities: Entity[];
  constraints: Constraint[];
  missing_context: MissingContextItem[];
  memory_bindings: MemoryBinding[];
  confidence?: number;
  created_at?: string;
}




