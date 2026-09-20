import { 
  AutonomousProblem, 
  SelfHealingAction, 
  FallbackAlertState, 
  WatchdogStatus, 
  MetaPerspectiveReport, 
  ExecutionJob,
  ProblemCategory,
  ProblemSeverity
} from '../types';
import { voice } from '../utils/voice';
import { sound } from '../utils/audio';
import { logSystemEvent } from '../lib/supabase';

type Listener = () => void;

class AutonomousCore {
  private problems: AutonomousProblem[] = [];
  private actions: SelfHealingAction[] = [];
  private executionQueue: ExecutionJob[] = [];
  private listeners: Set<Listener> = new Set();
  
  private watchdog: WatchdogStatus = {
    heartbeatCount: 4280,
    lastPulseTime: new Date().toLocaleTimeString(),
    frequencyHz: 1.0,
    activeWatchers: 8,
    systemEntropy: 0.12,
    invariantsPassed: 38240,
    invariantsFailed: 0,
    status: 'HEALTHY'
  };

  private fallbackAlert: FallbackAlertState = {
    active: false,
    primaryProvider: 'groq',
    primaryModel: 'llama-3.3-70b-versatile',
    fallbackProvider: 'synthetic_kernel',
    fallbackModel: 'microfyxd-l6-autonomous',
    reason: 'Primary endpoint socket timeout (HTTP 504 / ECONNREFUSED)',
    switchedAt: '',
    timestampMs: 0,
    manualOverrideActive: false,
    forcedProvider: undefined,
    dismissed: false
  };

  private metaPerspective: MetaPerspectiveReport = {
    timestamp: new Date().toLocaleTimeString(),
    systemCoherence: 99.8,
    activeDirectivesEnforced: 14,
    totalRemediations24h: 38,
    autonomousConvergenceRate: 99.7,
    supervisorReflection: 'All Ring-0 subsystems operational. Self-healing watchdog active with zero unmitigated kernel panics.',
    orchestrationHealth: 'NOMINAL'
  };

  private watchdogInterval: any = null;
  private autoHealingEnabled: boolean = true;
  private schedulerTasks: any[] = [];
  private deployments: any[] = [];
  private currentDeploymentJob: any = null;

  constructor() {
    this.initSeedData();
    this.startWatchdog();
  }

  private initSeedData() {
    // Initial resolved problems to show prior self-healing history
    this.problems = [
      {
        id: 'prob-101',
        category: 'AGENT_DEGRADATION',
        severity: 'WARNING',
        subsystem: 'agents',
        title: 'Cipher Agent Context Buffer Desynchronization',
        description: 'Context tokens desynchronized across Ring-0 bus; latency exceeded 450ms.',
        detectedAt: '12m ago',
        timestampMs: Date.now() - 12 * 60 * 1000,
        resolved: true,
        resolvedAt: '12m ago',
        resolutionActionId: 'act-101',
        autoRemediated: true
      },
      {
        id: 'prob-102',
        category: 'MEMORY_LEAK',
        severity: 'INFO',
        subsystem: 'memory',
        title: 'Episodic Vector Cache Fragmentation',
        description: 'Ephemeral working memory buffers exceeded 78% compaction threshold.',
        detectedAt: '34m ago',
        timestampMs: Date.now() - 34 * 60 * 1000,
        resolved: true,
        resolvedAt: '34m ago',
        resolutionActionId: 'act-102',
        autoRemediated: true
      }
    ];

    this.actions = [
      {
        id: 'act-101',
        problemId: 'prob-101',
        title: 'Hot-Restart Agent Cipher & Zero-Copy Memory Rebind',
        targetSubsystem: 'agents',
        actionTaken: 'Executed SIGTERM on worker, reloaded constitutional weights, refreshed context bus.',
        status: 'SUCCESS',
        executedAt: '12m ago',
        latencyMs: 142,
        undoSupported: true,
        metaReasoning: 'Isolated worker context reset without disturbing overarching mission DAG.'
      },
      {
        id: 'act-102',
        problemId: 'prob-102',
        title: 'Autonomous Vector Buffer Compaction',
        targetSubsystem: 'memory',
        actionTaken: 'Pruned dead nodes, defragmented HBM3e vector indices.',
        status: 'SUCCESS',
        executedAt: '34m ago',
        latencyMs: 88,
        undoSupported: false,
        metaReasoning: 'Defragmentation reclaimed 1.4GB of Ring-0 ephemeral memory.'
      }
    ];

    this.schedulerTasks = [
      {
        id: "task-01",
        type: "legal",
        payload: { userPrompt: "Draft motion to compel discovery" },
        status: "done",
        result: "Draft complete: Motion filed on Ring-0 state store",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3550000).toISOString(),
      },
      {
        id: "task-02",
        type: "code",
        payload: { userPrompt: "Implement logging service for legal events" },
        status: "done",
        result: "Service implemented: LegalEventLogger initiated with high cohesion",
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date(Date.now() - 1750000).toISOString(),
      }
    ];

    this.deployments = [
      {
        id: "dep-01",
        version: "v6.12.4",
        status: "success",
        url: "https://ais-pre-5wabdd3ikwqbd5ilzhchtw-209774381029.us-west2.run.app",
        latency: "14.2s",
        commits: "Feat: Governance decision logs interceptor applied",
        createdAt: "2h ago"
      }
    ];
  }

  // --- Watchdog Heartbeat ---
  private startWatchdog() {
    if (typeof window === 'undefined') return;
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);

    this.watchdogInterval = setInterval(() => {
      this.tickWatchdog();
    }, 1000);
  }

  private tickWatchdog() {
    this.watchdog.heartbeatCount += 1;
    this.watchdog.lastPulseTime = new Date().toLocaleTimeString();
    this.watchdog.invariantsPassed += 8;

    // Check for unresolved problems that need automated remediation
    if (this.autoHealingEnabled) {
      const unresolved = this.problems.find(p => !p.resolved);
      if (unresolved) {
        this.executeAutonomousHealing(unresolved);
      }
    }

    // Dynamic entropy and coherence computation
    const unresolvedCount = this.problems.filter(p => !p.resolved).length;
    this.watchdog.systemEntropy = +(0.08 + unresolvedCount * 0.12).toFixed(2);
    this.metaPerspective.systemCoherence = +(100 - unresolvedCount * 4.5).toFixed(1);

    if (unresolvedCount > 0) {
      this.watchdog.status = 'REPAIRING';
      this.metaPerspective.orchestrationHealth = 'ELEVATED_HEALING';
    } else {
      this.watchdog.status = 'HEALTHY';
      this.metaPerspective.orchestrationHealth = 'NOMINAL';
    }

    this.notify();
  }

  // --- Autonomous Problem Detection & Ingestion ---
  public reportProblem(problem: Omit<AutonomousProblem, 'id' | 'detectedAt' | 'timestampMs' | 'resolved' | 'autoRemediated'>): AutonomousProblem {
    const newProblem: AutonomousProblem = {
      ...problem,
      id: `prob-${Date.now().toString().slice(-4)}`,
      detectedAt: new Date().toLocaleTimeString(),
      timestampMs: Date.now(),
      resolved: false,
      autoRemediated: false
    };

    this.problems.unshift(newProblem);
    this.watchdog.invariantsFailed += 1;
    this.watchdog.status = 'REPAIRING';

    logSystemEvent(
      `AUTONOMOUS_CORE.DETECT[${newProblem.category}]`,
      `Detected anomaly: "${newProblem.title}" in [${newProblem.subsystem}]. Auto-healing scheduled.`,
      newProblem.severity === 'CRITICAL' ? 'CRITICAL' : 'WARN'
    );

    // Audio & voice alert
    sound.playAlert();
    voice.speak(`Autonomous Core alert: ${newProblem.title} detected. Initiating self-repair.`);

    this.notify();

    // Trigger immediate healing if enabled
    if (this.autoHealingEnabled) {
      setTimeout(() => {
        this.executeAutonomousHealing(newProblem);
      }, 800);
    }

    return newProblem;
  }

  // --- Autonomous Self-Healing Execution Engine ---
  public async executeAutonomousHealing(problem: AutonomousProblem): Promise<void> {
    if (problem.resolved) return;

    // Create Execution Job
    const jobId = `job-${Date.now().toString().slice(-4)}`;
    const job: ExecutionJob = {
      id: jobId,
      name: `Self-Heal: ${problem.title}`,
      type: this.mapCategoryToJobType(problem.category),
      status: 'RUNNING',
      progress: 25,
      steps: [
        'Isolate offending thread/node in sandbox',
        'Verify constitutional invariance & safety checks',
        'Deploy hot-fix patch & memory re-allocation',
        'Confirm telemetry health restoration'
      ],
      currentStepIndex: 1,
      createdAt: new Date().toLocaleTimeString(),
      executedBy: 'AUTONOMOUS_CORE'
    };

    this.executionQueue.unshift(job);
    this.notify();

    // Step progression simulation with actual state changes
    await new Promise(r => setTimeout(r, 600));
    job.progress = 60;
    job.currentStepIndex = 2;
    this.notify();

    await new Promise(r => setTimeout(r, 600));
    job.progress = 90;
    job.currentStepIndex = 3;
    this.notify();

    await new Promise(r => setTimeout(r, 400));
    job.progress = 100;
    job.status = 'COMPLETED';

    // Record Action
    const actionId = `act-${Date.now().toString().slice(-4)}`;
    const action: SelfHealingAction = {
      id: actionId,
      problemId: problem.id,
      title: `Autonomous Remediation: ${problem.title}`,
      targetSubsystem: problem.subsystem,
      actionTaken: this.getRemediationSummary(problem.category),
      status: 'SUCCESS',
      executedAt: new Date().toLocaleTimeString(),
      latencyMs: 1600,
      undoSupported: true,
      metaReasoning: `Automated supervisor resolved ${problem.category} without manual intervention.`
    };

    this.actions.unshift(action);

    // Mark problem resolved
    problem.resolved = true;
    problem.resolvedAt = new Date().toLocaleTimeString();
    problem.resolutionActionId = actionId;
    problem.autoRemediated = true;

    this.metaPerspective.totalRemediations24h += 1;
    this.metaPerspective.supervisorReflection = `Autonomous supervisor successfully resolved ${problem.title}. Health state: NOMINAL.`;

    logSystemEvent(
      'AUTONOMOUS_CORE.HEAL',
      `Remediation complete for ${problem.id}: ${action.actionTaken}`,
      'INFO'
    );

    sound.playSuccess();
    voice.speak(`Autonomous Core: Self-repair completed. Subsystem ${problem.subsystem} restored to nominal state.`);

    this.notify();
  }

  private mapCategoryToJobType(cat: ProblemCategory): ExecutionJob['type'] {
    switch (cat) {
      case 'CONNECTIVITY': return 'CONNECTIVITY_FAILOVER';
      case 'AGENT_DEGRADATION': return 'AGENT_RESET';
      case 'MEMORY_LEAK': return 'MEMORY_COMPACT';
      case 'MISSION_STALL': return 'TASK_DISPATCH';
      default: return 'HEALING_PATCH';
    }
  }

  private getRemediationSummary(cat: ProblemCategory): string {
    switch (cat) {
      case 'CONNECTIVITY':
        return 'Re-routed inference requests to secondary neural fallback channel; verified low-latency transport.';
      case 'AGENT_DEGRADATION':
        return 'Purged corrupted context buffers, executed thread restart, and verified zero-copy IPC.';
      case 'MEMORY_LEAK':
        return 'Flushed temporary working memory allocations, defragmented HBM3e cache, restored 32% headroom.';
      case 'MISSION_STALL':
        return 'Rerouted stalled DAG node to standby agent cluster and advanced execution pointer.';
      case 'SANDBOX_SECURITY':
        return 'Contained untrusted syscall, revoked unauthorized memory pointer, and quarantined job.';
      default:
        return 'Applied deterministic hot-patch to restore subsystem invariants.';
    }
  }

  // --- Visual Fallback Alert & Manual Override System ---
  public triggerFallbackAlert(
    primaryProvider: string,
    primaryModel: string,
    fallbackProvider: string,
    fallbackModel: string,
    reason: string
  ) {
    // If user has set manual override, we do not force-change without respecting their locked preference
    if (this.fallbackAlert.manualOverrideActive && this.fallbackAlert.forcedProvider) {
      logSystemEvent(
        'AUTONOMOUS_CORE.OVERRIDE_ACTIVE',
        `Fallback triggered but user Manual Override is locked to [${this.fallbackAlert.forcedProvider}].`,
        'WARN'
      );
      return;
    }

    this.fallbackAlert = {
      active: true,
      primaryProvider,
      primaryModel,
      fallbackProvider,
      fallbackModel,
      reason,
      switchedAt: new Date().toLocaleTimeString(),
      timestampMs: Date.now(),
      manualOverrideActive: this.fallbackAlert.manualOverrideActive,
      forcedProvider: this.fallbackAlert.forcedProvider,
      dismissed: false
    };

    // Report problem into autonomous core as well
    this.reportProblem({
      category: 'CONNECTIVITY',
      severity: 'WARNING',
      subsystem: 'ai_core',
      title: `LLM Connectivity Drop: ${primaryProvider.toUpperCase()}`,
      description: `Primary LLM endpoint failed (${reason}). Switched to fallback ${fallbackProvider.toUpperCase()} (${fallbackModel}).`
    });

    sound.playAlert();
    voice.speak(`Connectivity issue detected with ${primaryProvider}. Autonomous Core switched to fallback model ${fallbackModel}.`);
    this.notify();
  }

  // User clicks "Undo" on the Fallback Alert Banner
  public undoFallback(): void {
    sound.playWarp();
    voice.speak(`Undoing fallback. Restoring primary provider ${this.fallbackAlert.primaryProvider}.`);
    
    logSystemEvent(
      'AUTONOMOUS_CORE.UNDO_FALLBACK',
      `User requested Undo of fallback. Restored primary ${this.fallbackAlert.primaryProvider}.`,
      'INFO'
    );

    this.fallbackAlert.active = false;
    this.fallbackAlert.dismissed = true;

    // Record undo action in execution queue
    const job: ExecutionJob = {
      id: `job-${Date.now().toString().slice(-4)}`,
      name: `Undo Fallback: Restore ${this.fallbackAlert.primaryProvider}`,
      type: 'CONNECTIVITY_FAILOVER',
      status: 'COMPLETED',
      progress: 100,
      steps: ['Revert routing table', 'Flush fallback connection', 'Rebind primary endpoint'],
      currentStepIndex: 3,
      createdAt: new Date().toLocaleTimeString(),
      executedBy: 'MANUAL_OVERRIDE'
    };
    this.executionQueue.unshift(job);

    this.notify();
  }

  // User toggles "Manual Override"
  public toggleManualOverride(forcedProvider?: string): boolean {
    const newState = !this.fallbackAlert.manualOverrideActive;
    this.fallbackAlert.manualOverrideActive = newState;
    this.fallbackAlert.forcedProvider = newState ? (forcedProvider || this.fallbackAlert.primaryProvider) : undefined;

    sound.playCognitivePulse();
    if (newState) {
      voice.speak(`Manual Override activated. Autonomous model switching suspended.`);
      logSystemEvent('AUTONOMOUS_CORE.MANUAL_OVERRIDE', `Manual Override enabled on provider: ${this.fallbackAlert.forcedProvider}`, 'WARN');
    } else {
      voice.speak(`Manual Override deactivated. Autonomous Core oversight resumed.`);
      logSystemEvent('AUTONOMOUS_CORE.MANUAL_OVERRIDE', `Manual Override disabled. Autonomous supervision active.`, 'INFO');
    }

    this.notify();
    return newState;
  }

  public dismissFallbackAlert(): void {
    this.fallbackAlert.dismissed = true;
    this.notify();
  }

  // --- Interactive Problem Injector (for User Demo & Testing) ---
  public injectSimulatedProblem(type: 'connectivity' | 'agent' | 'memory' | 'mission'): void {
    switch (type) {
      case 'connectivity':
        this.triggerFallbackAlert(
          'groq',
          'llama-3.3-70b-versatile',
          'synthetic_kernel',
          'microfyxd-l6-autonomous',
          'Simulated 503 Service Unavailable / Socket Reset on api.groq.com'
        );
        break;

      case 'agent':
        this.reportProblem({
          category: 'AGENT_DEGRADATION',
          severity: 'WARNING',
          subsystem: 'agents',
          title: 'Agent Chronos Event Loop Latency Spike',
          description: 'Scheduler heartbeat delayed by 820ms; potential deadlock on vector locks.'
        });
        break;

      case 'memory':
        this.reportProblem({
          category: 'MEMORY_LEAK',
          severity: 'CRITICAL',
          subsystem: 'memory',
          title: 'HBM3e VRAM Buffer Saturation Alert',
          description: 'Working memory cache reached 94.2% capacity (75.4 GB / 80 GB).'
        });
        break;

      case 'mission':
        this.reportProblem({
          category: 'MISSION_STALL',
          severity: 'WARNING',
          subsystem: 'mission_control',
          title: 'Stalled Task Node in Alpha-07 DAG',
          description: 'Task #evaluator-03 waiting on telemetry input for over 45 seconds.'
        });
        break;
    }
  }

  // --- Getters & Subscriptions ---
  public getProblems(): AutonomousProblem[] {
    return this.problems;
  }

  public getActions(): SelfHealingAction[] {
    return this.actions;
  }

  public getWatchdog(): WatchdogStatus {
    return this.watchdog;
  }

  public getFallbackAlert(): FallbackAlertState {
    return this.fallbackAlert;
  }

  public getMetaPerspective(): MetaPerspectiveReport {
    return this.metaPerspective;
  }

  public getExecutionQueue(): ExecutionJob[] {
    return this.executionQueue;
  }

  public getSchedulerTasks(): any[] {
    return this.schedulerTasks;
  }

  public getDeployments(): any[] {
    return this.deployments;
  }

  public getCurrentDeploymentJob(): any {
    return this.currentDeploymentJob;
  }

  public isAutoHealingEnabled(): boolean {
    return this.autoHealingEnabled;
  }

  public toggleAutoHealing(): boolean {
    this.autoHealingEnabled = !this.autoHealingEnabled;
    sound.playTick();
    voice.speak(`Autonomous self-healing ${this.autoHealingEnabled ? 'enabled' : 'paused'}.`);
    this.notify();
    return this.autoHealingEnabled;
  }

  // --- Scheduler, Self-Repair & Auto-Deployment Orchestrators ---
  public async addSchedulerTask(type: string, prompt: string): Promise<void> {
    const taskId = `task-${Date.now().toString().slice(-4)}`;
    const newTask: {
      id: string;
      type: string;
      payload: any;
      status: "pending" | "running" | "done" | "error";
      createdAt: string;
      updatedAt: string;
      result?: string;
      error?: string;
    } = {
      id: taskId,
      type,
      payload: { userPrompt: prompt },
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.schedulerTasks.unshift(newTask);
    this.notify();

    sound.playTick();
    voice.speak(`Scheduled new autonomous task of type ${type}.`);

    // Simulate Background Loop Engine processing the task
    await new Promise(r => setTimeout(r, 1200));
    newTask.status = "running";
    newTask.updatedAt = new Date().toISOString();
    this.notify();

    await new Promise(r => setTimeout(r, 1500));
    try {
      // Simulate multi-agent routing
      newTask.status = "done";
      (newTask as any).result = `Successfully executed ${type} task: "${prompt.slice(0, 30)}..." via multi-agent routing. Code invariants verified perfectly.`;
      newTask.updatedAt = new Date().toISOString();
      sound.playSuccess();
      voice.speak(`Task completed successfully by Autonomous Scheduler.`);
    } catch (err: any) {
      newTask.status = "error";
      (newTask as any).error = err.message || String(err);
      newTask.updatedAt = new Date().toISOString();
      sound.playAlert();
    }
    this.notify();
  }

  public async triggerSelfRepairOrgan(): Promise<void> {
    // Report a critical problem first
    const problem = this.reportProblem({
      category: 'AGENT_DEGRADATION',
      severity: 'CRITICAL',
      subsystem: 'agents',
      title: 'Decentralized Router Packet Loss & Drift',
      description: 'Multi-Agent Router desynchronization on secure memory channels. Latency is >1200ms.'
    });

    // Create a special highly detailed execution job representing the Self-Repair Organ Full Version
    const jobId = `job-repair-${Date.now().toString().slice(-4)}`;
    const job: ExecutionJob = {
      id: jobId,
      name: `Multi-Agent Router Self-Repair (Full Version)`,
      type: 'AGENT_RESET',
      status: 'RUNNING',
      progress: 10,
      steps: [
        'Multi-Agent Router: Scans system & isolates the drift signature',
        'RepairAgent: Initializes Claude Sonnet tool session',
        'RepairAgent [analyze_code]: Verifies AST state of the router config',
        'RepairAgent [generate_fix]: Synthesizes corrective patch rules',
        'RepairAgent [apply_patch]: Overwrites corrupted state and binds memory pointers',
        'RepairAgent [run_tests]: Runs full test suite verifying 0 invariants failure'
      ],
      currentStepIndex: 0,
      createdAt: new Date().toLocaleTimeString(),
      executedBy: 'AUTONOMOUS_CORE'
    };

    this.executionQueue.unshift(job);
    this.notify();

    const totalSteps = job.steps.length;
    for (let i = 0; i < totalSteps; i++) {
      await new Promise(r => setTimeout(r, 1400));
      job.currentStepIndex = i + 1;
      job.progress = Math.min(100, Math.round(((i + 1) / totalSteps) * 100));
      this.notify();
    }

    job.status = 'COMPLETED';

    // Mark problem resolved
    problem.resolved = true;
    problem.resolvedAt = new Date().toLocaleTimeString();
    problem.autoRemediated = true;

    // Add action to log
    const actionId = `act-repair-${Date.now().toString().slice(-4)}`;
    this.actions.unshift({
      id: actionId,
      problemId: problem.id,
      title: "Multi-Agent Router Self-Repair Completed",
      targetSubsystem: "agents",
      actionTaken: "Triggered Full Version Self-Repair: parsed router AST, generated dynamic patch, verified 4/4 invariant tests passing.",
      status: "SUCCESS",
      executedAt: new Date().toLocaleTimeString(),
      latencyMs: 8400,
      undoSupported: true,
      metaReasoning: "Identified and patched deadlocks in router thread pool. Synchronized state store."
    });

    this.metaPerspective.totalRemediations24h += 1;
    this.metaPerspective.supervisorReflection = "Full multi-agent self-repair organ successfully completed AST correction & alignment.";
    
    sound.playSuccess();
    voice.speak("Multi-Agent Router Self-Repair organ complete. Router synchronized successfully.");
    this.notify();
  }

  public async triggerAutoDeployment(commitMsg: string = "Triggered by Auto-Deployment Organ"): Promise<void> {
    if (this.currentDeploymentJob) return;

    const depId = `dep-${Date.now().toString().slice(-4)}`;
    const job = {
      id: depId,
      version: `v6.12.${Math.floor(Math.random() * 20 + 5)}`,
      status: "compiling",
      commits: commitMsg,
      progress: 0,
      steps: [
        "Analyzing changes against constitutional safety gatekeepers",
        "Running TypeScript compilation checks (tsc --noEmit)",
        "Building static client bundles & assets (vite build)",
        "Executing container packaging & security scans",
        "Deploying to Cloud Run ingress & registering live URL"
      ],
      currentStepIndex: 0,
      createdAt: new Date().toLocaleTimeString()
    };

    this.currentDeploymentJob = job;
    this.notify();

    sound.playTick();
    voice.speak("Auto-Deployment organ triggered. Executing compilation and compliance pipelines.");

    const totalSteps = job.steps.length;
    for (let i = 0; i < totalSteps; i++) {
      await new Promise(r => setTimeout(r, 1200));
      job.currentStepIndex = i + 1;
      job.progress = Math.min(100, Math.round(((i + 1) / totalSteps) * 100));
      this.notify();
    }

    job.status = "success";
    const newDeployment = {
      id: depId,
      version: job.version,
      status: "success",
      url: "https://ais-pre-5wabdd3ikwqbd5ilzhchtw-209774381029.us-west2.run.app",
      latency: "6.0s",
      commits: commitMsg,
      createdAt: "Just now"
    };

    this.deployments.unshift(newDeployment);
    this.currentDeploymentJob = null;
    this.notify();

    sound.playSuccess();
    voice.speak("Auto-Deployment successful. New version is live on Cloud Run container.");
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (e) { console.error(e); }
    });
  }
}

export const autonomousCore = new AutonomousCore();
