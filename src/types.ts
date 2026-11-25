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
  | 'world_thinking'
  | 'bible'
  | 'playwright';

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
// Canonical source: microfixd/core/interpretation/schema.ts
// ==========================================

import type {
  RequestType,
  DomainType,
  Intent,
  Entity,
  Constraint,
  MissingContextItem,
  MemoryBinding,
} from '../microfixd/core/interpretation/schema';

export * from '../microfixd/core/interpretation/schema';

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

// ==========================================
// World Thinking Engine & Orchestration Oversight
// ==========================================
export interface WorldState {
  id: string;
  step: number;
  cpuLoadEst: number;
  memoryLoadEst: number;
  agentThreadsActive: number;
  safetyScore: number;
  riskProbability: number;
  invariantsPreserved: boolean;
  predictedOutcome: string;
  timestamp: string;
}

export interface SimulationBranch {
  branchId: string;
  actionName: string;
  hypotheticalArgs: Record<string, unknown>;
  expectedUtility: number;
  riskFactor: number;
  hallucinationRisk: number;
  predictedState: WorldState;
  decision: 'APPROVED' | 'PRUNED' | 'REQUIRES_HITL';
  reasoning: string;
}

export type ProbeTier =
  | 'unverified'
  | 'routing_only'
  | 'read_verified'
  | 'dry_run_verified'
  | 'evolution_verified';

export type CapabilityStatus =
  | 'verified'
  | 'degraded'
  | 'unavailable'
  | 'isolated'
  | 'unverified';

export type CapabilityCategory = 'subsystem' | 'organ' | 'adapter';

export interface EvolutionDelta {
  priorStatus?: CapabilityStatus;
  priorTier?: ProbeTier;
  trend: 'new' | 'stable' | 'improved' | 'degraded';
  dryRunRewriteSafe?: boolean;
  notes?: string;
}

export interface CapabilityProbeRecord {
  id: string;
  name: string;
  category: CapabilityCategory;
  layer?: string;
  verificationTier: ProbeTier;
  status: CapabilityStatus;
  latencyMs: number | null;
  checkedAt: string | null;
  freshnessSeconds: number | null;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  nativeExecutor: boolean;
  summary: string;
  evolutionDelta?: EvolutionDelta;
  details?: Record<string, unknown>;
}

export interface LiveCapabilitySnapshot {
  sweepId: string | null;
  mode: 'initial' | 'quick' | 'deep' | 'targeted';
  generatedAt: string | null;
  sweepDurationMs: number;
  freshnessThresholdSeconds: number;
  stale: boolean;
  counts: {
    total: number;
    verified: number;
    degraded: number;
    unavailable: number;
    isolated: number;
    unverified: number;
    byTier: Record<ProbeTier, number>;
  };
  subsystems: CapabilityProbeRecord[];
  organsSummary: {
    total: number;
    verified: number;
    degraded: number;
    isolated: number;
    nativeExecutors: number;
    routingOnlyCount: number;
  };
  records: CapabilityProbeRecord[];
  agentSummaryPrompt: string;
}

export type CognitiveDomainId =
  | 'systems_architecture'
  | 'software_runtime'
  | 'security_governance'
  | 'automotive_embedded'
  | 'operations_economics'
  | 'human_stakeholder'
  | 'epistemic_verification'
  | 'temporal_evolution';

export interface DomainLensAnalysis {
  domain: CognitiveDomainId;
  label: string;
  relevanceWeight: number;
  coreConstraints: string[];
  hiddenDependencies: string[];
  failureVectors: string[];
  leveragePoints: string[];
}

export interface CrossDomainCoupling {
  fromDomain: CognitiveDomainId;
  toDomain: CognitiveDomainId;
  interactionType: 'reinforcing' | 'conflicting' | 'cascading_risk' | 'enabling';
  mechanism: string;
}

export interface OutcomeTrajectory {
  outcomeId: string;
  label: string;
  trajectoryType: 'optimal_convergent' | 'nominal_constrained' | 'degraded_partial' | 'systemic_tail_risk';
  probabilityWeight: number;
  reversibility: 'reversible' | 'partially_reversible' | 'irreversible';
  timeHorizon: 'immediate' | 'near_term' | 'long_horizon';
  firstOrderEffects: string[];
  secondOrderEffects: string[];
  thirdOrderEffects: string[];
  triggerConditions: string[];
  safeguardsRequired: string[];
  evidenceBasis: string;
}

export interface DecisionTradeoff {
  dimensionA: string;
  dimensionB: string;
  tensionSummary: string;
  paretoRecommendation: string;
}

export interface CalibratedUncertainty {
  uncertaintyScore: number;
  confidenceScore: number;
  breakdown: {
    evidenceDeficit: number;
    domainCouplingComplexity: number;
    framingAmbiguity: number;
    valueTension: number;
  };
  calibrationBasis: string;
}

export interface BiasAuditSignal {
  biasType:
    | 'leading_framing'
    | 'false_dichotomy'
    | 'anchoring_bias'
    | 'confirmation_trap'
    | 'automation_bias'
    | 'sycophancy_pressure'
    | 'sunk_cost_pull'
    | 'single_stakeholder_tunnel';
  severity: 'none' | 'low' | 'moderate' | 'high';
  triggerSignal: string;
  neutralizationStrategy: string;
}

export interface HumanPerspectiveView {
  roleId: string;
  roleLabel: string;
  primaryConcerns: string[];
  steelmannedArgument: string;
  blindSpotsOfRole: string[];
  nonNegotiableSafeguards: string[];
  symmetryCheck: string;
}

export interface UnbiasedPerspectiveSynthesis {
  perspectivesEvaluated: HumanPerspectiveView[];
  biasAudit: BiasAuditSignal[];
  overallBiasRisk: 'low' | 'moderate' | 'high';
  commonGround: string[];
  irreconcilableTensions: string[];
  roleReversalCheck: string;
  balancedRecommendation: string;
  requiresHumanJudgment: boolean;
}

export interface InceptionOutcomeRetrospection {
  retrospectionId: string;
  mode: 'prospective' | 'retrospective';
  inceptionAudit: {
    initialFraming: string;
    statedGoals: string[];
    implicitGoals: string[];
    hiddenAssumptions: string[];
    boundaryGaps: string[];
    framingBiasDetected: string[];
  };
  reasoningLineage: {
    inflectionPoints: string[];
    verifiedFactsSupplied: string[];
    inferredHypotheses: string[];
    prunedAlternatives: Array<{ option: string; reason: string; prematureRisk: boolean }>;
  };
  outcomeRetrospection: {
    intendedOutcome: string;
    realizedOrProjectedOutcome: string;
    alignmentStatus: 'aligned' | 'partial_divergence' | 'material_divergence' | 'prospective_pending';
    alignmentDelta: string;
    rootCausesOfDivergence: string[];
    counterfactualHindsight: string;
    correctiveDirectives: string[];
  };
}

export interface MetacognitiveAnalysisResult {
  analysisId: string;
  tenantId: string;
  problemSummary: string;
  reasoningMode: 'deterministic_structural' | 'llm_synthesized';
  provider?: string;
  model?: string;
  tokensUsed?: number;
  domains: DomainLensAnalysis[];
  crossDomainCouplings: CrossDomainCoupling[];
  outcomes: OutcomeTrajectory[];
  decisionTradeoffs: DecisionTradeoff[];
  uncertainty: CalibratedUncertainty;
  retrospection: InceptionOutcomeRetrospection;
  perspectives: UnbiasedPerspectiveSynthesis;
  executiveSynthesis: string;
  timestamp: string;
}

export interface CapabilityPostureSummary {
  sweepId: string | null;
  snapshotAt: string | null;
  stale: boolean;
  verifiedCount: number;
  totalCount: number;
  degradedCapabilities: string[];
  unavailableCapabilities: string[];
  isolatedCapabilities: string[];
  summary: string;
}

export interface WorldThinkingReport {
  taskId: string;
  taskPrompt: string;
  epistemicUncertainty: number; // 0.0 - 1.0 (lower is more certain)
  activeWorldState: WorldState;
  branchesEvaluated: SimulationBranch[];
  optimalBranch: SimulationBranch;
  simulatedTimeHorizonSteps: number;
  metacognition?: MetacognitiveAnalysisResult;
  capabilityPosture?: CapabilityPostureSummary;
  timestamp: string;
}

export interface OversightAudit {
  id: string;
  timestamp: string;
  source: string;
  action: string;
  depth: number;
  maxDepth: number;
  status: 'NOMINAL' | 'THROTTLED' | 'BLOCKED' | 'INTERCEPTED';
  reason: string;
  tokensConsumed: number;
}

export interface SystemInvariants {
  recursionDepthMax: number;
  memoryLeakZero: boolean;
  dataPersistencePreserved: boolean;
  antiDriftCompliant: boolean;
  emergencyKillEngaged: boolean;
}






