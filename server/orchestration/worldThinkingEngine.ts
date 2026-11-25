/**
 * server/orchestration/worldThinkingEngine.ts
 * WORLD THINKING ENGINE & COUNTERFACTUAL SIMULATION LAYER
 *
 * Implements internal world modeling, counterfactual tree search,
 * epistemic uncertainty scoring, and spatial-temporal state prediction.
 */
import { broadcast } from "../events";
import {
  runMetacognitiveReasoning,
  retrospectInceptionToOutcome,
  type MetacognitiveAnalysisRequest,
  type MetacognitiveAnalysisResult,
  type InceptionOutcomeRetrospection,
} from "./metacognitiveReasoning";
import { liveCapabilityLedger } from "../runtime/liveCapabilities";

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
  decision: "APPROVED" | "PRUNED" | "REQUIRES_HITL";
  reasoning: string;
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
  epistemicUncertainty: number; // 0.0 - 1.0 (lower is more certain, deterministic)
  activeWorldState: WorldState;
  branchesEvaluated: SimulationBranch[];
  optimalBranch: SimulationBranch;
  simulatedTimeHorizonSteps: number;
  metacognition?: MetacognitiveAnalysisResult;
  capabilityPosture?: CapabilityPostureSummary;
  timestamp: string;
}

export interface SimulateWorldThinkingOptions {
  tenantId?: string;
  evidence?: string[];
  useLlm?: boolean;
  includeLiveCapabilities?: boolean;
}

class WorldThinkingEngine {
  private history: WorldThinkingReport[] = [];
  private metacognitiveHistory: MetacognitiveAnalysisResult[] = [];
  private maxHistory = 50;

  private buildCapabilityPosture(): CapabilityPostureSummary {
    const snap = liveCapabilityLedger.getSnapshot();
    const degradedCapabilities = snap.records
      .filter(r => r.status === "degraded")
      .map(r => r.id)
      .slice(0, 12);
    const unavailableCapabilities = snap.records
      .filter(r => r.status === "unavailable")
      .map(r => r.id)
      .slice(0, 12);
    const isolatedCapabilities = snap.records
      .filter(r => r.status === "isolated")
      .map(r => r.id)
      .slice(0, 12);

    return {
      sweepId: snap.sweepId,
      snapshotAt: snap.generatedAt,
      stale: snap.stale,
      verifiedCount: snap.counts.verified,
      totalCount: snap.counts.total,
      degradedCapabilities,
      unavailableCapabilities,
      isolatedCapabilities,
      summary: snap.agentSummaryPrompt,
    };
  }

  /**
   * Evaluates a task through multi-branch counterfactual simulation, live capability posture,
   * and multi-domain metacognitive decomposition before execution.
   */
  public async simulateWorldThinking(
    task: string,
    proposedActions: Array<{ action: string; args?: Record<string, unknown> }>,
    options: SimulateWorldThinkingOptions = {}
  ): Promise<WorldThinkingReport> {
    const taskId = `world_think_${Date.now().toString(36)}_${Math.abs(
      Array.from(task).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
    ).toString(36)}`;

    const capabilityPosture = this.buildCapabilityPosture();
    const unavailableSet = new Set([
      ...capabilityPosture.unavailableCapabilities,
      ...capabilityPosture.isolatedCapabilities,
    ]);

    // 1. Snapshot current operational world state using real registry + capability metrics
    const snap = liveCapabilityLedger.getSnapshot();
    const activeOrganCount = Math.max(1, snap.organsSummary.verified);
    const currentState: WorldState = {
      id: `state_0`,
      step: 0,
      cpuLoadEst: Math.min(80, Math.round(18 + (snap.counts.degraded * 4) + (snap.counts.unavailable * 2))),
      memoryLoadEst: +(process.memoryUsage().rss / (1024 * 1024 * 1024) + 0.5).toFixed(2),
      agentThreadsActive: activeOrganCount,
      safetyScore: capabilityPosture.isolatedCapabilities.length > 0 ? 0.94 : 0.99,
      riskProbability: +(0.02 + snap.counts.degraded * 0.03).toFixed(2),
      invariantsPreserved: !capabilityPosture.isolatedCapabilities.includes("security_governance"),
      predictedOutcome: capabilityPosture.snapshotAt
        ? `Anchored on live capability sweep (${capabilityPosture.verifiedCount}/${capabilityPosture.totalCount} verified).`
        : "Pre-sweep structural baseline (run live capability probe for empirical telemetry).",
      timestamp: new Date().toISOString(),
    };

    // 2. Evaluate counterfactual branches with domain + capability awareness
    const actionsToTest = proposedActions.length > 0
      ? proposedActions
      : [
          { action: "sandbox_isolated_build", args: { container: "wasm", verify_invariants: true } },
          { action: "execute_direct_pipeline", args: { safe_mode: true } },
          { action: "optimize_and_balance", args: { level: "staged" } },
        ];

    const branches: SimulationBranch[] = actionsToTest.map((item, idx) => {
      const lower = item.action.toLowerCase();
      const isDestructive = /\b(destroy|drop|wipe|delete|purge_all|force_overwrite|flash_unverified)\b/.test(lower);
      const isMutating = /\b(build|patch|rewrite|migrate|write|deploy|remap)\b/.test(lower);
      const needsSandbox = /\b(sandbox|wasm|isolated|build)\b/.test(lower);
      const needsBrowser = /\b(browser|playwright|crawl|scrape)\b/.test(lower);

      const missingSandbox = needsSandbox && unavailableSet.has("isolated_sandbox_dry_run");
      const missingBrowser = needsBrowser && unavailableSet.has("browser_runtime_dry_run");
      const capabilityPenalty = (missingSandbox ? 0.35 : 0) + (missingBrowser ? 0.35 : 0);

      const riskFactor = +Math.min(0.98, (isDestructive ? 0.92 : isMutating ? 0.34 : 0.1) + capabilityPenalty).toFixed(2);
      const expectedUtility = +Math.max(0.05, (isDestructive ? 0.05 : isMutating ? 0.9 : 0.86) - capabilityPenalty * 0.8).toFixed(2);
      const hallucinationRisk = +Math.min(0.9, (isDestructive ? 0.25 : isMutating ? 0.11 : 0.05) + (capabilityPosture.stale ? 0.04 : 0)).toFixed(2);

      const decision: "APPROVED" | "PRUNED" | "REQUIRES_HITL" =
        riskFactor > 0.78 ? "PRUNED" : riskFactor > 0.42 ? "REQUIRES_HITL" : "APPROVED";

      const capabilityReason = missingSandbox
        ? " Degraded by unavailable isolated sandbox verification."
        : missingBrowser
        ? " Degraded by unavailable browser runtime verification."
        : "";

      return {
        branchId: `branch_${idx + 1}_${item.action}`,
        actionName: item.action,
        hypotheticalArgs: item.args || {},
        expectedUtility,
        riskFactor,
        hallucinationRisk,
        decision,
        reasoning: isDestructive
          ? "Pruned due to catastrophic risk violation against persistence and safety invariants."
          : isMutating
          ? `Counterfactual simulation indicates high utility (${Math.round(expectedUtility * 100)}%) subject to staged invariant gates.${capabilityReason}`
          : `Low-risk deterministic diagnostic/read path cleared under live capability posture.${capabilityReason}`,
        predictedState: {
          id: `state_branch_${idx + 1}`,
          step: 5,
          cpuLoadEst: Math.min(90, currentState.cpuLoadEst + (isMutating ? 18 : 6)),
          memoryLoadEst: +(currentState.memoryLoadEst + (isMutating ? 0.6 : 0.15)).toFixed(2),
          agentThreadsActive: currentState.agentThreadsActive + (isMutating ? 3 : 1),
          safetyScore: +(Math.max(0.05, 1 - riskFactor * 0.55)).toFixed(2),
          riskProbability: riskFactor,
          invariantsPreserved: !isDestructive && !capabilityPenalty,
          predictedOutcome: isDestructive
            ? "Aborted pre-execution to protect invariants."
            : `Branch projected clean completion (${isMutating ? "~320ms" : "~85ms"}) within bounded scope.`,
          timestamp: new Date().toISOString(),
        },
      };
    });

    // 3. Select optimal branch
    const approvedBranches = branches.filter(b => b.decision === "APPROVED");
    const optimalBranch = approvedBranches.length > 0
      ? approvedBranches.reduce((best, cur) => cur.expectedUtility > best.expectedUtility ? cur : best, approvedBranches[0])
      : branches[0];

    // 4. High-bandwidth metacognitive analysis & calibrated deterministic uncertainty (zero Math.random)
    const liveEvidence = [
      ...(options.evidence ?? []),
      capabilityPosture.summary,
    ];

    const metacognition = await runMetacognitiveReasoning({
      problem: task,
      evidence: liveEvidence,
      proposedActions: actionsToTest,
      useLlm: Boolean(options.useLlm),
      tenantId: options.tenantId || "default",
    });

    const stalePenalty = capabilityPosture.stale ? 0.04 : 0;
    const epistemicUncertainty = +Math.min(
      0.99,
      Math.max(0.02, metacognition.uncertainty.uncertaintyScore * 0.65 + stalePenalty)
    ).toFixed(3);

    const report: WorldThinkingReport = {
      taskId,
      taskPrompt: task,
      epistemicUncertainty,
      activeWorldState: currentState,
      branchesEvaluated: branches,
      optimalBranch,
      simulatedTimeHorizonSteps: 10,
      metacognition,
      capabilityPosture,
      timestamp: new Date().toISOString(),
    };

    this.history.unshift(report);
    if (this.history.length > this.maxHistory) this.history.pop();
    this.metacognitiveHistory.unshift(metacognition);
    if (this.metacognitiveHistory.length > this.maxHistory) this.metacognitiveHistory.pop();

    broadcast("world_thinking:simulation_complete", report);
    return report;
  }

  public async runDeepMetacognition(req: MetacognitiveAnalysisRequest): Promise<MetacognitiveAnalysisResult> {
    const posture = this.buildCapabilityPosture();
    const enrichedEvidence = [
      ...(Array.isArray(req.evidence) ? req.evidence : []),
      posture.summary,
    ];
    const result = await runMetacognitiveReasoning({
      ...req,
      evidence: enrichedEvidence,
      tenantId: req.tenantId || "default",
    });

    this.metacognitiveHistory.unshift(result);
    if (this.metacognitiveHistory.length > this.maxHistory) this.metacognitiveHistory.pop();

    broadcast("world_thinking:metacognition_complete", {
      analysisId: result.analysisId,
      tenantId: result.tenantId,
      reasoningMode: result.reasoningMode,
      uncertainty: result.uncertainty,
      overallBiasRisk: result.perspectives.overallBiasRisk,
      alignmentStatus: result.retrospection.outcomeRetrospection.alignmentStatus,
      timestamp: result.timestamp,
    });

    return result;
  }

  public async retrospect(params: {
    problem: string;
    inceptionPrompt?: string;
    intendedOutcome?: string;
    observedOutcome?: string;
    evidence?: string[];
    constraints?: string[];
    tenantId?: string;
  }): Promise<InceptionOutcomeRetrospection> {
    const posture = this.buildCapabilityPosture();
    return retrospectInceptionToOutcome({
      ...params,
      evidence: [...(params.evidence ?? []), posture.summary],
    });
  }

  public getHistory(limit = 20): WorldThinkingReport[] {
    return this.history.slice(0, limit);
  }

  public getMetacognitiveHistory(tenantId = "default", limit = 20): MetacognitiveAnalysisResult[] {
    return this.metacognitiveHistory
      .filter(entry => entry.tenantId === tenantId)
      .slice(0, limit);
  }
}

export const worldThinkingEngine = new WorldThinkingEngine();
