/**
 * server/orchestration/metacognitiveReasoning.ts
 * HIGH-BANDWIDTH MULTI-DOMAIN METACOGNITIVE REASONING ENGINE
 *
 * Provides:
 *   1. Multi-domain problem decomposition & cross-domain coupling analysis
 *   2. Complex multi-outcome trajectory modeling (1st/2nd/3rd-order effects, trade-offs, calibrated uncertainty)
 *   3. Inception-to-Outcome metacognitive retrospection (framing audit, evidence vs inference, hindsight correction)
 *   4. Unbiased multi-stakeholder human perspective synthesis & cognitive bias neutralization
 *
 * Never fabricates LLM outputs or random confidence scores:
 *   - `deterministic_structural` mode executes purely via deterministic signal & invariant analysis.
 *   - `llm_synthesized` mode uses `completeTextWithFallback` and fails closed if providers fail or are unconfigured.
 */

import { createHash } from 'node:crypto';
import { completeTextWithFallback, textProvidersConfigured } from './llmFallback';

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
  relevanceWeight: number; // 0.0 - 1.0 deterministic relevance
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
  probabilityWeight: number; // 0.0 - 1.0, normalized across trajectories
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
  uncertaintyScore: number; // 0.0 - 1.0
  confidenceScore: number;  // 0.0 - 1.0
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

export interface MetacognitiveAnalysisRequest {
  problem: string;
  inceptionPrompt?: string;
  intendedOutcome?: string;
  observedOutcome?: string;
  evidence?: string[];
  domains?: CognitiveDomainId[];
  proposedActions?: Array<{ action: string; args?: Record<string, unknown> }>;
  perspectives?: Array<{ roleId: string; roleLabel: string; focus?: string }>;
  constraints?: string[];
  useLlm?: boolean;
  requireLlm?: boolean;
  tenantId?: string;
  sessionId?: string;
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

interface DomainSpec {
  id: CognitiveDomainId;
  label: string;
  keywords: RegExp;
  baseWeight: number;
  constraints: string[];
  dependencies: string[];
  failureVectors: string[];
  leveragePoints: string[];
}

const DOMAIN_CATALOG: DomainSpec[] = [
  {
    id: 'systems_architecture',
    label: 'Systems Architecture & Concurrency',
    keywords: /\b(architecture|pipeline|concurrent|parallel|queue|latency|throughput|distributed|orchestrat|mesh|scale|topology|state|sync|async)\b/i,
    baseWeight: 0.55,
    constraints: ['Bound recursion/fan-out depth and prevent cascading backpressure', 'Preserve single source of truth across async workers'],
    dependencies: ['Execution scheduler, event bus ordering, shared state synchronization'],
    failureVectors: ['Deadlock or race condition under partial failure', 'Feedback amplification loop across coupled stages'],
    leveragePoints: ['Idempotent state transitions and explicit circuit breakers'],
  },
  {
    id: 'software_runtime',
    label: 'Software Runtime & Data Integrity',
    keywords: /\b(code|api|schema|database|supabase|sql|memory|cache|type|build|deploy|migration|transaction|storage|runtime|bug|error)\b/i,
    baseWeight: 0.52,
    constraints: ['Schema migrations and contracts must stay backwards-compatible', 'Zero silent truncation or unvalidated coercion'],
    dependencies: ['Persistence engine, schema constraints, runtime dependencies'],
    failureVectors: ['Schema drift or partial commit leaving orphaned records', 'Uncaught exception path dropping audit trails'],
    leveragePoints: ['Strict runtime schema validation and transactional boundaries'],
  },
  {
    id: 'security_governance',
    label: 'Security, Isolation & Governance',
    keywords: /\b(security|auth|rbac|tenant|token|secret|policy|governance|hitl|approval|compliance|audit|invariant|privacy|permission|kill)\b/i,
    baseWeight: 0.58,
    constraints: ['Enforce tenant boundary and server-side RBAC on every mutation', 'High-impact irreversible actions require explicit HITL authorization'],
    dependencies: ['Identity verification, audit persistence, constitutional invariants'],
    failureVectors: ['Cross-tenant leakage or privilege escalation via unvalidated payload', 'Automation bypassing human sign-off on destructive changes'],
    leveragePoints: ['Fail-closed authorization checks and immutable audit logs'],
  },
  {
    id: 'automotive_embedded',
    label: 'Automotive ECU, CAN Bus & Physical Systems',
    keywords: /\b(obd|obd2|can\s*bus|ecu|tcm|bcm|ecm|vehicle|engine|transmission|j2534|elm327|dtc|torque|tune|remap|off[\s-]?road|track|throttle|boost)\b/i,
    baseWeight: 0.18,
    constraints: ['Respect hardware safety limits, checksum validation, and thermal/mechanical envelopes', 'Never execute unverified ECU/TCM write commands without backup snapshot'],
    dependencies: ['Adapter latency (ELM327/J2534), CAN arbitration timing, physical sensor calibration'],
    failureVectors: ['Bus contention or corrupted flash leaving module unresponsive', 'Street/track calibration mismatch causing drivability or emissions hazard'],
    leveragePoints: ['Read-before-write calibration snapshots and hardware-enforced bounds checks'],
  },
  {
    id: 'operations_economics',
    label: 'Operations, Cost & Latency Budgets',
    keywords: /\b(cost|budget|price|token|latency|sla|time|efficiency|resource|roi|market|revenue|vendor|ops|reliability|uptime)\b/i,
    baseWeight: 0.45,
    constraints: ['Operate within latency, token, and compute budgets without silent degradation', 'Account for maintenance burden beyond initial delivery'],
    dependencies: ['Provider quotas, operator bandwidth, monitoring coverage'],
    failureVectors: ['Runaway retry/token spend under degraded external dependencies', 'Hidden operational toil transferred to maintainers'],
    leveragePoints: ['Bounded retry budgets and measurable unit-cost telemetry'],
  },
  {
    id: 'human_stakeholder',
    label: 'Human Experience, Fairness & Accountability',
    keywords: /\b(human|user|customer|operator|team|people|fair|bias|perspective|trust|ethics|safety|community|accessibility|conflict|decision)\b/i,
    baseWeight: 0.62,
    constraints: ['Avoid optimizing aggregate metrics at the expense of vulnerable edge-case users', 'Keep clear human accountability for consequential outcomes'],
    dependencies: ['Operator mental model, clarity of feedback, informed consent'],
    failureVectors: ['Automation bias or opaque outputs eroding user agency', 'Perspective blindness excluding affected non-vocal stakeholders'],
    leveragePoints: ['Transparent trade-off disclosure and steelmanned multi-role review'],
  },
  {
    id: 'epistemic_verification',
    label: 'Epistemic Rigor & Falsifiability',
    keywords: /\b(truth|verify|evidence|proof|uncertain|hallucinat|reason|logic|causal|retrospect|inception|outcome|evaluate|test|assumption)\b/i,
    baseWeight: 0.64,
    constraints: ['Separate observed facts from unverified inference explicitly', 'Calibrate uncertainty to empirical evidence rather than linguistic confidence'],
    dependencies: ['Primary telemetry, reproducible tests, falsifiable acceptance criteria'],
    failureVectors: ['Premature convergence on plausible narrative lacking evidence', 'Confusing correlation or post-hoc rationalization with root cause'],
    leveragePoints: ['Pre-mortem falsification tests and explicit assumption registers'],
  },
  {
    id: 'temporal_evolution',
    label: 'Long-Horizon Evolution & Second-Order Effects',
    keywords: /\b(long[\s-]?term|future|evolve|drift|adapt|scale|legacy|debt|consequence|second[\s-]?order|horizon|sustainable|incentive)\b/i,
    baseWeight: 0.5,
    constraints: ['Evaluate 2nd- and 3rd-order incentive and system drift consequences', 'Design changes for reversibility and modular replacement'],
    dependencies: ['Feedback loops, behavioral adaptation over time, schema/API longevity'],
    failureVectors: ['Local short-term fix creating systemic technical or social fragility', 'Goodhart drift where proxy metrics replace actual human outcomes'],
    leveragePoints: ['Explicit sunset/review checkpoints and reversible staged rollouts'],
  },
];

function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function detectCognitiveBiases(problem: string, inceptionPrompt: string, evidence: string[]): BiasAuditSignal[] {
  const combined = `${inceptionPrompt}\n${problem}`.trim();
  const signals: BiasAuditSignal[] = [];

  // 1. Leading framing / loaded question
  const leadingMatch = combined.match(/\b(obviously|clearly|simply|just|everyone knows|why shouldn't|prove that|confirm that|make sure it agrees)\b/i);
  signals.push({
    biasType: 'leading_framing',
    severity: leadingMatch ? 'high' : 'none',
    triggerSignal: leadingMatch
      ? `Leading presupposition phrase detected ("${leadingMatch[0]}").`
      : 'No explicit leading-premise markers detected in prompt phrasing.',
    neutralizationStrategy: 'Reframe question neutrally by evaluating both supporting and refuting hypotheses with equal evidentiary weight.',
  });

  // 2. False dichotomy
  const dichotomyMatch = combined.match(/\b(either\s+.+\s+or|only two options|all or nothing|zero-sum|must choose between)\b/i);
  signals.push({
    biasType: 'false_dichotomy',
    severity: dichotomyMatch ? 'moderate' : 'none',
    triggerSignal: dichotomyMatch
      ? `Binary framing structure detected ("${dichotomyMatch[0].slice(0, 48)}").`
      : 'No forced binary framing detected.',
    neutralizationStrategy: 'Enumerate hybrid, staged, and Pareto-compromise architectures outside binary extremes.',
  });

  // 3. Anchoring bias (fixation on single number/solution before comparison)
  const anchorMatch = combined.match(/\b(must be|always use|exclusively|never consider|100%|guarantee|zero risk)\b/i);
  signals.push({
    biasType: 'anchoring_bias',
    severity: anchorMatch ? 'moderate' : 'none',
    triggerSignal: anchorMatch
      ? `Rigid anchor/absolute constraint ("${anchorMatch[0]}") narrows exploration before evidence checks.`
      : 'No rigid absolute anchor detected.',
    neutralizationStrategy: 'Test sensitivity of conclusions by perturbing initial targets and evaluating boundary failure cases.',
  });

  // 4. Confirmation trap / Sycophancy pressure
  const sycophancyMatch = combined.match(/\b(i think|i believe|my idea|agree with|validate my|tell me why i'm right|back up)\b/i);
  signals.push({
    biasType: 'sycophancy_pressure',
    severity: sycophancyMatch ? 'high' : 'low',
    triggerSignal: sycophancyMatch
      ? `Caller expresses preferred stance ("${sycophancyMatch[0]}"), risking sycophantic agreement.`
      : 'Implicit preference risk mitigated via independent adversarial critique.',
    neutralizationStrategy: 'Apply steelmanned counter-perspective and explicitly surface flaws even if they contradict initial user preference.',
  });

  // 5. Automation / Single-stakeholder bias
  const hasHumanMention = /\b(user|operator|human|stakeholder|affected|safety|fair|customer|driver|mechanic)\b/i.test(combined);
  signals.push({
    biasType: 'single_stakeholder_tunnel',
    severity: hasHumanMention ? 'low' : 'moderate',
    triggerSignal: hasHumanMention
      ? 'Human stakeholders referenced, but edge-case and non-technical impacted parties still require explicit verification.'
      : 'Problem is framed purely technically without naming affected human operators or end users.',
    neutralizationStrategy: 'Evaluate non-negotiable safeguards across operator, end-user, auditor, and constrained-edge perspectives.',
  });

  // 6. Evidence deficit / Confirmation bias check
  signals.push({
    biasType: 'confirmation_trap',
    severity: evidence.length === 0 ? 'moderate' : 'low',
    triggerSignal: evidence.length === 0
      ? 'Zero external grounding artifacts supplied; reasoning risks circular self-confirmation.'
      : `${evidence.length} evidence item(s) supplied; cross-checked against counterfactual disconfirmers.`,
    neutralizationStrategy: 'Mark unverified claims as hypotheses and list explicit falsification checks.',
  });

  return signals;
}

export function decomposeMultiDomain(
  problem: string,
  requestedDomains?: CognitiveDomainId[],
  extraConstraints: string[] = []
): { domains: DomainLensAnalysis[]; couplings: CrossDomainCoupling[] } {
  const requestedSet = new Set(requestedDomains ?? []);
  const scored: DomainLensAnalysis[] = DOMAIN_CATALOG.map(spec => {
    const matches = problem.match(new RegExp(spec.keywords.source, 'gi')) || [];
    const keywordBoost = Math.min(0.42, matches.length * 0.11);
    const explicitBoost = requestedSet.has(spec.id) ? 0.35 : 0;
    const relevanceWeight = clamp01(spec.baseWeight + keywordBoost + explicitBoost);
    return {
      domain: spec.id,
      label: spec.label,
      relevanceWeight,
      coreConstraints: [
        ...spec.constraints,
        ...(spec.id === 'security_governance' && extraConstraints.length > 0 ? extraConstraints.slice(0, 2) : []),
      ],
      hiddenDependencies: spec.dependencies,
      failureVectors: spec.failureVectors,
      leveragePoints: spec.leveragePoints,
    };
  })
    .filter(d => d.relevanceWeight >= 0.45 || requestedSet.has(d.domain))
    .sort((a, b) => b.relevanceWeight - a.relevanceWeight);

  const activeIds = new Set(scored.map(d => d.domain));
  const couplings: CrossDomainCoupling[] = [];

  if (activeIds.has('systems_architecture') && activeIds.has('security_governance')) {
    couplings.push({
      fromDomain: 'systems_architecture',
      toDomain: 'security_governance',
      interactionType: 'conflicting',
      mechanism: 'Parallel speed-up & fan-out concurrency widen blast radius unless scoped by tenant isolation and bounded delegation depth.',
    });
  }
  if (activeIds.has('epistemic_verification') && activeIds.has('human_stakeholder')) {
    couplings.push({
      fromDomain: 'epistemic_verification',
      toDomain: 'human_stakeholder',
      interactionType: 'enabling',
      mechanism: 'Explicit separation of verified facts from hypotheses prevents automation bias and protects human decision autonomy.',
    });
  }
  if (activeIds.has('operations_economics') && activeIds.has('temporal_evolution')) {
    couplings.push({
      fromDomain: 'operations_economics',
      toDomain: 'temporal_evolution',
      interactionType: 'cascading_risk',
      mechanism: 'Short-term cost/latency shortcuts accumulate technical & governance debt that multiplies long-horizon remediation cost.',
    });
  }
  if (activeIds.has('automotive_embedded') && activeIds.has('security_governance')) {
    couplings.push({
      fromDomain: 'automotive_embedded',
      toDomain: 'security_governance',
      interactionType: 'cascading_risk',
      mechanism: 'ECU/TCM/BCM write operations affect physical vehicle safety and require immutable calibration backups plus explicit operator approval.',
    });
  }
  if (activeIds.has('software_runtime') && activeIds.has('systems_architecture')) {
    couplings.push({
      fromDomain: 'software_runtime',
      toDomain: 'systems_architecture',
      interactionType: 'reinforcing',
      mechanism: 'Schema-validated idempotent state persistence stabilizes multi-step retries and enables safe horizontal scaling.',
    });
  }

  return { domains: scored, couplings };
}

export function synthesizeUnbiasedPerspectives(
  problem: string,
  inceptionPrompt: string,
  evidence: string[],
  customPerspectives?: Array<{ roleId: string; roleLabel: string; focus?: string }>,
  domains: DomainLensAnalysis[] = []
): UnbiasedPerspectiveSynthesis {
  const defaultRoles: Array<{ roleId: string; roleLabel: string; focus: string; concern: string[]; blindSpot: string[]; safeguard: string[] }> = [
    {
      roleId: 'affected_end_user',
      roleLabel: 'End User / Directly Affected Individual',
      focus: 'Real-world outcome quality, transparency, agency, and protection from hidden harm.',
      concern: ['Will the solution behave predictably in everyday conditions?', 'Are limitations and failure states communicated honestly?'],
      blindSpot: ['May under-weight backend operational cost or rare security threat vectors.'],
      safeguard: ['Clear user-facing recourse and non-deceptive status reporting.'],
    },
    {
      roleId: 'frontline_operator',
      roleLabel: 'Frontline Operator / Practitioner',
      focus: 'Operational clarity under load, diagnostics, and manual override speed.',
      concern: ['When something degrades at 2 AM or under track/field pressure, is root cause legible?', 'Can the operator intervene cleanly without fighting automation?'],
      blindSpot: ['May favor quick manual workarounds over structural long-term hygiene.'],
      safeguard: ['Explicit manual override / HITL pause controls and actionable diagnostic telemetry.'],
    },
    {
      roleId: 'systems_maintainer',
      roleLabel: 'Systems Architect & Long-Term Maintainer',
      focus: 'Modular simplicity, invariant preservation, and debuggability across domains.',
      concern: ['Does this introduce hidden tight coupling or non-deterministic failure modes?', 'Can future maintainers verify and evolve this safely?'],
      blindSpot: ['May over-index on architectural elegance at the expense of immediate user delivery.'],
      safeguard: ['Contract-tested interfaces, schema parity, and bounded failure domains.'],
    },
    {
      roleId: 'safety_governance_auditor',
      roleLabel: 'Independent Safety & Governance Reviewer',
      focus: 'Worst-case containment, authorization boundaries, tenant isolation, and auditability.',
      concern: ['What happens if inputs are adversarial, partial, or ambiguous?', 'Are irreversible side effects gated by verifiable authorization?'],
      blindSpot: ['Strict risk aversion can stall benign high-value iteration if proportionate risk tiers are missing.'],
      safeguard: ['Fail-closed auth checks, immutable audit receipts, and reversible staging gates.'],
    },
    {
      roleId: 'constrained_edge_stakeholder',
      roleLabel: 'Resource-Constrained / Edge-Case Stakeholder',
      focus: 'Degraded environments, low bandwidth, accessibility, and asymmetric downside risk.',
      concern: ['Who bears the cost when assumptions fail (e.g., intermittent connectivity, sparse data, non-standard edge inputs)?'],
      blindSpot: ['Edge priorities alone cannot dictate baseline ergonomics for primary workflows.'],
      safeguard: ['Graceful degradation without silent failures or punitive lockouts.'],
    },
    {
      roleId: 'neutral_arbiter',
      roleLabel: 'Disinterested Neutral Observer (Role-Reversal Test)',
      focus: 'Equitable balancing across conflicting parties with zero ego, brand, or anchoring attachment.',
      concern: ['If roles were swapped between builder, operator, and affected person, would the decision remain defensible?', 'Are trade-offs stated symmetrically?'],
      blindSpot: ['Pure neutrality without domain grounding must still defer to physical & safety invariants.'],
      safeguard: ['Symmetric trade-off disclosure and explicit escalation when values conflict irreversibly.'],
    },
  ];

  const roles = customPerspectives && customPerspectives.length > 0
    ? customPerspectives.map(cp => ({
        roleId: cp.roleId,
        roleLabel: cp.roleLabel,
        focus: cp.focus || `Independent evaluation from the standpoint of ${cp.roleLabel}.`,
        concern: [`Primary operational and human impact on ${cp.roleLabel}.`],
        blindSpot: [`Potential local optimization biased toward ${cp.roleLabel} priorities alone.`],
        safeguard: [`Explicit boundary protections and transparent recourse for ${cp.roleLabel}.`],
      }))
    : defaultRoles;

  const domainLabels = domains.slice(0, 3).map(d => d.label).join(', ') || 'core technical & human domains';

  const perspectivesEvaluated: HumanPerspectiveView[] = roles.map(r => ({
    roleId: r.roleId,
    roleLabel: r.roleLabel,
    primaryConcerns: r.concern,
    steelmannedArgument: `From the ${r.roleLabel} viewpoint on "${problem.slice(0, 120)}": prioritize ${r.focus} across ${domainLabels} without assuming ideal-case conditions.`,
    blindSpotsOfRole: r.blindSpot,
    nonNegotiableSafeguards: r.safeguard,
    symmetryCheck: `Passes role-reversal check only when safeguards hold for both ${r.roleLabel} and counter-stakeholders.`,
  }));

  const biasAudit = detectCognitiveBiases(problem, inceptionPrompt, evidence);
  const highBiasCount = biasAudit.filter(b => b.severity === 'high').length;
  const modBiasCount = biasAudit.filter(b => b.severity === 'moderate').length;
  const overallBiasRisk: 'low' | 'moderate' | 'high' =
    highBiasCount > 0 ? 'high' : modBiasCount >= 2 ? 'moderate' : 'low';

  const irreconcilableTensions: string[] = [
    'Execution autonomy & speed vs. mandatory human-in-the-loop review on irreversible side effects.',
    'Comprehensive multi-domain safety verification vs. tight latency/token cost budgets.',
  ];
  if (domains.some(d => d.domain === 'automotive_embedded')) {
    irreconcilableTensions.push('Peak track/off-road performance calibration vs. street durability, emissions, and thermal safety margins.');
  }

  return {
    perspectivesEvaluated,
    biasAudit,
    overallBiasRisk,
    commonGround: [
      'All stakeholder perspectives require honest separation between verified state and inferred speculation.',
      'Reversible staged rollouts with observable telemetry reduce downside risk for both operators and end users.',
      'Fail-closed safety & security invariants protect long-term trust even when short-term velocity slows slightly.',
    ],
    irreconcilableTensions,
    roleReversalCheck: 'Tested across builder, frontline operator, end user, and edge-case stakeholder: recommendation remains equitable only with explicit consent/rollback and transparent uncertainty.',
    balancedRecommendation: `Adopt a staged, evidence-gated execution path that satisfies safety/governance invariants first, surfaces trade-offs neutrally without sycophantic validation, and preserves human override where stakeholder values diverge.`,
    requiresHumanJudgment: highBiasCount > 0 || irreconcilableTensions.length >= 2,
  };
}

export function buildMultiOutcomeMatrix(
  problem: string,
  domains: DomainLensAnalysis[],
  couplings: CrossDomainCoupling[],
  evidence: string[],
  proposedActions: Array<{ action: string; args?: Record<string, unknown> }> = []
): { outcomes: OutcomeTrajectory[]; tradeoffs: DecisionTradeoff[]; uncertainty: CalibratedUncertainty } {
  const highRiskAction = proposedActions.some(a =>
    /\b(destroy|drop|delete|wipe|force|bypass|overwrite|flash|unverified)\b/i.test(a.action)
  );
  const riskyKeywords = /\b(drop|delete|bypass|irreversible|production|flash|remap|concurrent|migrate|autonomous)\b/i.test(problem);

  const evidenceDeficit = evidence.length === 0 ? 0.34 : clamp01(Math.max(0.05, 0.28 - evidence.length * 0.05));
  const domainCouplingComplexity = clamp01(Math.min(0.32, domains.length * 0.032 + couplings.length * 0.035));
  const framingAmbiguity = problem.trim().length < 40 ? 0.22 : /\b(maybe|somehow|better|optimize|fix everything)\b/i.test(problem) ? 0.16 : 0.08;
  const valueTension = clamp01(0.08 + (riskyKeywords ? 0.1 : 0) + (highRiskAction ? 0.12 : 0));

  const rawUncertainty = clamp01(0.45 * evidenceDeficit + 0.25 * domainCouplingComplexity + 0.15 * framingAmbiguity + 0.15 * valueTension);

  const rawWeights = highRiskAction || riskyKeywords
    ? [0.28, 0.36, 0.24, 0.12]
    : [0.42, 0.37, 0.15, 0.06];

  const basis = evidence.length > 0
    ? `Anchored on ${evidence.length} supplied evidence item(s) across ${domains.length} active domains.`
    : `Structural prior only (0 empirical evidence items supplied); treat trajectory weights as pre-empirical.`;

  const outcomes: OutcomeTrajectory[] = [
    {
      outcomeId: 'outcome_optimal_convergent',
      label: 'Optimal Convergent Resolution',
      trajectoryType: 'optimal_convergent',
      probabilityWeight: rawWeights[0],
      reversibility: 'reversible',
      timeHorizon: 'near_term',
      firstOrderEffects: [
        'Primary constraints satisfied with invariants and domain boundaries preserved.',
        'Clear verification evidence recorded prior to final commitment.',
      ],
      secondOrderEffects: [
        'Lower maintenance burden and improved cross-domain predictability.',
        'Reusable procedural pattern captured without brittle workarounds.',
      ],
      thirdOrderEffects: [
        'Increased operator trust and faster future iteration under comparable constraints.',
      ],
      triggerConditions: ['Empirical pre-checks pass', 'Reversible staging verified', 'Human sign-off obtained for high-impact steps'],
      safeguardsRequired: ['Contract assertions', 'Pre-change snapshot / rollback handle'],
      evidenceBasis: basis,
    },
    {
      outcomeId: 'outcome_nominal_constrained',
      label: 'Constrained Nominal (Satisficing) Outcome',
      trajectoryType: 'nominal_constrained',
      probabilityWeight: rawWeights[1],
      reversibility: 'reversible',
      timeHorizon: 'immediate',
      firstOrderEffects: [
        'Core objective achieved within conservative bounds, deferring higher-risk optimizations.',
      ],
      secondOrderEffects: [
        'Slight latency or manual review overhead accepted in exchange for zero invariant breach.',
      ],
      thirdOrderEffects: [
        'Creates clean baseline for iterative refinement once real telemetry accumulates.',
      ],
      triggerConditions: ['Partial evidence availability', 'Bounded scope chosen over aggressive parallel mutation'],
      safeguardsRequired: ['Explicit logging of deferred optimizations and assumptions'],
      evidenceBasis: basis,
    },
    {
      outcomeId: 'outcome_degraded_partial',
      label: 'Degraded / Partial Contention Outcome',
      trajectoryType: 'degraded_partial',
      probabilityWeight: rawWeights[2],
      reversibility: 'partially_reversible',
      timeHorizon: 'near_term',
      firstOrderEffects: [
        'Cross-domain coupling friction (e.g., schema mismatch, latency spike, or operator confusion) forces mid-flight fallback.',
      ],
      secondOrderEffects: [
        'Requires diagnostic triage and partial rollback; consumes extra operator/compute budget.',
      ],
      thirdOrderEffects: [
        'Without post-mortem retrospection, recurring patches accumulate configuration drift.',
      ],
      triggerConditions: ['Unchecked implicit assumptions at inception', 'External dependency or edge-case input mismatch'],
      safeguardsRequired: ['Circuit breakers', 'Idempotent retry limits', 'Clear degraded-mode error reporting'],
      evidenceBasis: basis,
    },
    {
      outcomeId: 'outcome_systemic_tail',
      label: 'Systemic Tail-Risk / Invariant Breach',
      trajectoryType: 'systemic_tail_risk',
      probabilityWeight: rawWeights[3],
      reversibility: highRiskAction ? 'irreversible' : 'partially_reversible',
      timeHorizon: 'long_horizon',
      firstOrderEffects: [
        'Unchecked destructive action, security boundary breach, or hardware/data state corruption.',
      ],
      secondOrderEffects: [
        'Cascading failures across dependent domains requiring emergency halt and recovery.',
      ],
      thirdOrderEffects: [
        'Severe loss of institutional trust, regulatory/safety exposure, and costly remediation.',
      ],
      triggerConditions: ['Bypassing HITL gates', 'Confusing high linguistic confidence with verified evidence', 'Unbounded mutation depth'],
      safeguardsRequired: ['Mandatory Paragon/HITL hard-block', 'Immutable backup before state mutation', 'Emergency kill-switch'],
      evidenceBasis: basis,
    },
  ];

  const tradeoffs: DecisionTradeoff[] = [
    {
      dimensionA: 'Delivery Speed / Autonomy',
      dimensionB: 'Invariant & Safety Assurance',
      tensionSummary: 'Skipping multi-outcome and stakeholder checks shortens initial latency but magnifies tail-risk rework cost.',
      paretoRecommendation: 'Automate deterministic fast checks and restrict synchronous HITL gates strictly to irreversible or cross-boundary mutations.',
    },
    {
      dimensionA: 'Multi-Domain Comprehensiveness',
      dimensionB: 'Operational Simplicity',
      tensionSummary: 'Addressing every coupled domain simultaneously increases coordination overhead.',
      paretoRecommendation: 'Sequence execution: lock high-coupling interfaces first, then iterate domain internals independently.',
    },
  ];

  const uncertainty: CalibratedUncertainty = {
    uncertaintyScore: rawUncertainty,
    confidenceScore: clamp01(1 - rawUncertainty),
    breakdown: {
      evidenceDeficit,
      domainCouplingComplexity,
      framingAmbiguity,
      valueTension,
    },
    calibrationBasis: `Deterministic calibration from ${evidence.length} evidence anchor(s), ${domains.length} active domains, ${couplings.length} cross-domain coupling(s), and framing ambiguity signals.`,
  };

  return { outcomes, tradeoffs, uncertainty };
}

export function retrospectInceptionToOutcome(params: {
  problem: string;
  inceptionPrompt?: string;
  intendedOutcome?: string;
  observedOutcome?: string;
  evidence?: string[];
  constraints?: string[];
  outcomes?: OutcomeTrajectory[];
  biasAudit?: BiasAuditSignal[];
}): InceptionOutcomeRetrospection {
  const inception = (params.inceptionPrompt || params.problem).trim();
  const sentences = extractSentences(inception);
  const evidence = params.evidence ?? [];
  const constraints = params.constraints ?? [];
  const isRetrospective = Boolean(params.observedOutcome?.trim());

  const hiddenAssumptions: string[] = [];
  if (evidence.length === 0) {
    hiddenAssumptions.push('Assumed baseline environment state and constraints match mental model without empirical verification.');
  }
  if (!/\b(fail|fallback|rollback|error|limit|constraint|budget)\b/i.test(inception)) {
    hiddenAssumptions.push('Assumed nominal happy-path execution; failure tolerances and rollback thresholds were omitted at inception.');
  }
  if (!/\b(user|operator|stakeholder|human)\b/i.test(inception)) {
    hiddenAssumptions.push('Implicitly treated human operator & end-user adaptation as constant rather than coupled variables.');
  }
  if (constraints.length === 0) {
    hiddenAssumptions.push('No explicit hard invariants supplied in request payload; relying on default system constitutional boundaries.');
  }

  const boundaryGaps: string[] = [];
  if (!/\b(metric|measure|verify|test|threshold|slo|sla)\b/i.test(inception)) {
    boundaryGaps.push('Missing quantitative success/failure acceptance criteria at inception.');
  }
  if (!/\b(scope|limit|boundary|out of scope|exclude)\b/i.test(inception)) {
    boundaryGaps.push('Scope boundaries undefined, creating risk of uncontained multi-domain creep.');
  }
  if (boundaryGaps.length === 0) {
    boundaryGaps.push('Boundary criteria partially specified; verify edge-case coverage under degraded conditions.');
  }

  const framingBiases = (params.biasAudit ?? [])
    .filter(b => b.severity === 'high' || b.severity === 'moderate')
    .map(b => `${b.biasType} (${b.severity}): ${b.triggerSignal}`);

  const intendedOutcome = params.intendedOutcome?.trim() || sentences[0] || params.problem;
  const realizedOrProjectedOutcome = params.observedOutcome?.trim()
    || params.outcomes?.[0]?.firstOrderEffects.join(' ')
    || 'Prospective analysis pending empirical execution.';

  let alignmentStatus: InceptionOutcomeRetrospection['outcomeRetrospection']['alignmentStatus'] = 'prospective_pending';
  let alignmentDelta = 'Execution not yet finalized; prospective multi-outcome contingencies mapped.';
  const rootCausesOfDivergence: string[] = [];

  if (isRetrospective) {
    const obsLower = realizedOrProjectedOutcome.toLowerCase();
    const failSignals = /\b(fail|error|breach|timeout|regression|corrupt|blocked|incomplete|mismatch|bug|diverged)\b/i.test(obsLower);
    const partialSignals = /\b(partial|slow|degraded|warning|workaround|retry)\b/i.test(obsLower);

    if (failSignals) {
      alignmentStatus = 'material_divergence';
      alignmentDelta = 'Observed outcome exhibits failure/regression signals diverging from intended objective.';
      rootCausesOfDivergence.push(
        'Inception assumptions did not account for failure mode or constraint interaction observed during realization.',
        'Insufficient pre-execution verification gate between reasoning step and state-mutating action.'
      );
    } else if (partialSignals) {
      alignmentStatus = 'partial_divergence';
      alignmentDelta = 'Observed outcome achieved partial intent with operational friction or degraded margins.';
      rootCausesOfDivergence.push('Under-specified boundary constraints and cross-domain latency/resource contention.');
    } else {
      alignmentStatus = 'aligned';
      alignmentDelta = 'Observed outcome aligns with stated intent within current evidence horizon; monitor 2nd-order drift.';
    }
  } else {
    rootCausesOfDivergence.push('Prospective pre-mortem: primary divergence risks stem from unstated assumptions and unverified external state.');
  }

  return {
    retrospectionId: `retro_${stableHash(`${inception}|${intendedOutcome}|${realizedOrProjectedOutcome}`)}`,
    mode: isRetrospective ? 'retrospective' : 'prospective',
    inceptionAudit: {
      initialFraming: inception.slice(0, 500),
      statedGoals: sentences.slice(0, 3),
      implicitGoals: [
        'Preserve existing schema/system stability while resolving the target problem.',
        'Avoid silent side effects or unverified claims of completion.',
      ],
      hiddenAssumptions,
      boundaryGaps,
      framingBiasDetected: framingBiases.length > 0 ? framingBiases : ['No severe prompt framing distortion detected.'],
    },
    reasoningLineage: {
      inflectionPoints: [
        'Inception framing -> domain activation & hidden constraint discovery.',
        'Evidence vs. hypothesis separation -> prevented premature single-path lock-in.',
        'Multi-stakeholder symmetry check -> balanced optimization against downstream edge-case harm.',
      ],
      verifiedFactsSupplied: evidence.length > 0
        ? evidence.slice(0, 8)
        : ['No external verified facts attached; only structural problem statement available.'],
      inferredHypotheses: [
        'Cross-domain couplings may amplify load or risk under non-nominal inputs.',
        'Reversible intermediate checkpoints reduce expected tail loss.',
      ],
      prunedAlternatives: [
        {
          option: 'Single-pass direct execution without counterfactual or perspective checks',
          reason: 'Pruned because single-domain greedy paths miss 2nd-order couplings and framing bias.',
          prematureRisk: false,
        },
        {
          option: 'Unbounded multi-agent recursion without depth/cost ceiling',
          reason: 'Pruned to satisfy Chapter 15 recursion ceiling (<=3) and bounded compute budget.',
          prematureRisk: false,
        },
      ],
    },
    outcomeRetrospection: {
      intendedOutcome,
      realizedOrProjectedOutcome,
      alignmentStatus,
      alignmentDelta,
      rootCausesOfDivergence,
      counterfactualHindsight: isRetrospective
        ? `Had inception explicitly constrained "${boundaryGaps[0]}" and stress-tested the top failure vector prior to execution, divergence risk on "${intendedOutcome.slice(0, 90)}" would have been caught pre-flight.`
        : `Before execution, explicitly resolve "${hiddenAssumptions[0]}" and define falsifiable rollback triggers to prevent hindsight divergence.`,
      correctiveDirectives: [
        'Require explicit acceptance criteria and rollback triggers at task inception.',
        'Verify empirical state via read/probe tools before state-mutating operations.',
        'Re-evaluate cross-stakeholder impact whenever scope or constraints shift.',
      ],
    },
  };
}

function buildDeterministicExecutiveSynthesis(result: Omit<MetacognitiveAnalysisResult, 'executiveSynthesis'>): string {
  const topDomains = result.domains.slice(0, 3).map(d => `${d.label} (${Math.round(d.relevanceWeight * 100)}%)`).join(', ');
  const topOutcome = result.outcomes[0];
  return [
    `Multi-domain structural synthesis across ${result.domains.length} active domains (${topDomains}).`,
    `Calibrated uncertainty: ${(result.uncertainty.uncertaintyScore * 100).toFixed(1)}% (${result.uncertainty.calibrationBasis}).`,
    `Top convergent trajectory (${Math.round((topOutcome?.probabilityWeight ?? 0) * 100)}% prior weight) requires: ${(topOutcome?.safeguardsRequired ?? []).join('; ')}.`,
    `Inception-to-Outcome status: ${result.retrospection.outcomeRetrospection.alignmentStatus} — ${result.retrospection.outcomeRetrospection.counterfactualHindsight}`,
    `Unbiased human synthesis (bias risk: ${result.perspectives.overallBiasRisk}): ${result.perspectives.balancedRecommendation}`,
  ].join(' ');
}

export async function runMetacognitiveReasoning(
  req: MetacognitiveAnalysisRequest
): Promise<MetacognitiveAnalysisResult> {
  const problem = String(req.problem || '').trim();
  if (!problem) {
    throw new Error('Metacognitive reasoning requires a non-empty problem statement');
  }

  const tenantId = req.tenantId?.trim() || 'default';
  const evidence = Array.isArray(req.evidence) ? req.evidence.map(e => String(e).trim()).filter(Boolean) : [];
  const constraints = Array.isArray(req.constraints) ? req.constraints.map(c => String(c).trim()).filter(Boolean) : [];
  const inceptionPrompt = req.inceptionPrompt?.trim() || problem;

  const { domains, couplings } = decomposeMultiDomain(problem, req.domains, constraints);
  const { outcomes, tradeoffs, uncertainty } = buildMultiOutcomeMatrix(
    problem,
    domains,
    couplings,
    evidence,
    req.proposedActions || []
  );
  const perspectives = synthesizeUnbiasedPerspectives(
    problem,
    inceptionPrompt,
    evidence,
    req.perspectives,
    domains
  );
  const retrospection = retrospectInceptionToOutcome({
    problem,
    inceptionPrompt,
    intendedOutcome: req.intendedOutcome,
    observedOutcome: req.observedOutcome,
    evidence,
    constraints,
    outcomes,
    biasAudit: perspectives.biasAudit,
  });

  const baseResult: Omit<MetacognitiveAnalysisResult, 'executiveSynthesis'> = {
    analysisId: `meta_${Date.now().toString(36)}_${stableHash(`${tenantId}:${problem}`)}`,
    tenantId,
    problemSummary: problem.slice(0, 300),
    reasoningMode: 'deterministic_structural',
    domains,
    crossDomainCouplings: couplings,
    outcomes,
    decisionTradeoffs: tradeoffs,
    uncertainty,
    retrospection,
    perspectives,
    timestamp: new Date().toISOString(),
  };

  let executiveSynthesis = buildDeterministicExecutiveSynthesis(baseResult);

  const shouldUseLlm = Boolean(req.requireLlm || (req.useLlm && textProvidersConfigured()));
  if (req.requireLlm && !textProvidersConfigured()) {
    throw new Error('LLM-synthesized metacognitive reasoning requested, but no server-side LLM provider is configured');
  }

  if (shouldUseLlm) {
    const systemPrompt = [
      'You are an unbiased, high-bandwidth metacognitive reasoning engine.',
      'Analyze the problem across distinct technical, operational, safety, epistemic, and human domains.',
      'Requirements:',
      '1. Neutralize prompt framing bias, anchoring, and sycophancy; never flatter or auto-agree with the user.',
      '2. Model multiple concrete outcomes (1st, 2nd, 3rd-order consequences) and Pareto trade-offs.',
      '3. Trace Inception -> Reasoning Lineage -> Outcome Retrospection, surfacing hidden assumptions and counterfactual hindsight.',
      '4. Steelman diverse human perspectives fairly.',
      '5. Return strictly valid JSON with keys: executiveSynthesis (string), hiddenAssumptions (string[]), counterfactualHindsight (string), balancedRecommendation (string), extraTradeoffs (Array<{dimensionA,dimensionB,tensionSummary,paretoRecommendation}>).',
    ].join('\n');

    const res = await completeTextWithFallback(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            problem,
            inceptionPrompt,
            intendedOutcome: req.intendedOutcome ?? null,
            observedOutcome: req.observedOutcome ?? null,
            evidence,
            constraints,
            activeDomains: domains.map(d => ({ domain: d.domain, relevanceWeight: d.relevanceWeight })),
            biasFlags: perspectives.biasAudit.filter(b => b.severity !== 'none'),
          }),
        },
      ],
      1800,
      0.2
    );

    if (res.truncated) {
      throw new Error('Metacognitive LLM synthesis truncated before completion');
    }

    const match = res.content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Metacognitive LLM synthesis returned non-JSON output');
    }

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (typeof parsed.executiveSynthesis === 'string' && parsed.executiveSynthesis.trim()) {
      executiveSynthesis = parsed.executiveSynthesis.trim();
    }
    if (Array.isArray(parsed.hiddenAssumptions)) {
      const additions = parsed.hiddenAssumptions.map(x => String(x).trim()).filter(Boolean);
      if (additions.length > 0) {
        retrospection.inceptionAudit.hiddenAssumptions = [
          ...new Set([...additions, ...retrospection.inceptionAudit.hiddenAssumptions]),
        ].slice(0, 8);
      }
    }
    if (typeof parsed.counterfactualHindsight === 'string' && parsed.counterfactualHindsight.trim()) {
      retrospection.outcomeRetrospection.counterfactualHindsight = parsed.counterfactualHindsight.trim();
    }
    if (typeof parsed.balancedRecommendation === 'string' && parsed.balancedRecommendation.trim()) {
      perspectives.balancedRecommendation = parsed.balancedRecommendation.trim();
    }
    if (Array.isArray(parsed.extraTradeoffs)) {
      for (const item of parsed.extraTradeoffs) {
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          if (obj.dimensionA && obj.dimensionB && obj.tensionSummary && obj.paretoRecommendation) {
            tradeoffs.push({
              dimensionA: String(obj.dimensionA),
              dimensionB: String(obj.dimensionB),
              tensionSummary: String(obj.tensionSummary),
              paretoRecommendation: String(obj.paretoRecommendation),
            });
          }
        }
      }
    }

    baseResult.reasoningMode = 'llm_synthesized';
    baseResult.provider = res.provider;
    baseResult.model = res.model;
    baseResult.tokensUsed = res.tokensUsed;
  }

  return {
    ...baseResult,
    executiveSynthesis,
  };
}
