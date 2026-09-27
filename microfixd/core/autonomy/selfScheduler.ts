// @ts-nocheck
/**
 * microfixd/core/autonomy/selfScheduler.ts
 * AUTONOMOUS SELF-SCHEDULER
 * Microfixd schedules its own maintenance tasks without user prompting.
 *
 * Scheduled jobs:
 *   - Memory consolidation (every 6h)
 *   - Episode analysis + pattern extraction (every 12h)
 *   - Organ health check (every 30min)
 *   - Evolution proposal generation (every 24h)
 *   - Paragon dissection of top episodes (every 24h)
 */
import { runCortex } from "../../langgraph/graph";
import { logEpisode } from "../episodes/episodeStore";
import { recallMemories, storeMemory } from "../memory/supabaseMemory";

interface ScheduledJob {
  id:           string;
  name:         string;
  intervalMs:   number;
  lastRun:      number;
  enabled:      boolean;
  fn:           () => Promise<void>;
}

class SelfScheduler {
  private jobs:     ScheduledJob[] = [];
  private timer:    NodeJS.Timeout | null = null;
  private running   = false;
  private tickMs    = 60_000; // Check every minute

  constructor() {
    this.registerBuiltInJobs();
  }

  private registerBuiltInJobs(): void {
    this.register({
      id:         "memory_consolidation",
      name:       "Memory Consolidation",
      intervalMs: 6 * 60 * 60 * 1000, // 6h
      fn:         this.memoryConsolidation.bind(this),
    });
    this.register({
      id:         "episode_analysis",
      name:       "Episode Pattern Analysis",
      intervalMs: 12 * 60 * 60 * 1000, // 12h
      fn:         this.episodeAnalysis.bind(this),
    });
    this.register({
      id:         "health_check",
      name:       "Organ Health Check",
      intervalMs: 30 * 60 * 1000, // 30min
      fn:         this.organHealthCheck.bind(this),
    });
    this.register({
      id:         "evolution_proposal",
      name:       "Evolution Engine Cycle",
      intervalMs: 24 * 60 * 60 * 1000, // 24h
      fn:         this.evolutionCycle.bind(this),
    });
  }

  register(job: Omit<ScheduledJob, "lastRun" | "enabled">): void {
    this.jobs.push({ ...job, lastRun: 0, enabled: true });
    console.log(`[self_scheduler] Registered: ${job.name} (every ${job.intervalMs / 60000}min)`);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer   = setInterval(() => this.tick(), this.tickMs);
    console.log("[self_scheduler] Started — autonomous task management active");
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.running = false;
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    for (const job of this.jobs) {
      if (!job.enabled) continue;
      if (now - job.lastRun >= job.intervalMs) {
        job.lastRun = now;
        console.log(`[self_scheduler] Running: ${job.name}`);
        job.fn().catch(err => console.warn(`[self_scheduler] ${job.name} failed:`, err));
      }
    }
  }

  // ── Built-in job implementations ─────────────────────────────────────────

  private async memoryConsolidation(): Promise<void> {
    const result = await runCortex(
      "Consolidate recent memory: identify patterns, prune redundant entries, strengthen important connections.",
      `scheduler_memory_${Date.now()}`
    );
    await logEpisode(result, ["scheduled", "memory_consolidation"]);
  }

  private async episodeAnalysis(): Promise<void> {
    const result = await runCortex(
      "Analyze recent episodes: identify success patterns, failure modes, and propose system improvements.",
      `scheduler_episode_${Date.now()}`
    );
    await storeMemory(result.final_output, ["episode_analysis", "pattern"], "scheduler");
    await logEpisode(result, ["scheduled", "episode_analysis"]);
  }

  private async organHealthCheck(): Promise<void> {
    const result = await runCortex(
      "Perform health check: verify all organs are responsive, check for errors, report any degraded systems.",
      `scheduler_health_${Date.now()}`
    );
    if (!result.success || result.eval_score < 0.5) {
      // Trigger HITL for health failures
      fetch("http://localhost:3001/api/hitl/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: "scheduler",
          artifact: {
            name:     "Health Check Failure",
            type:     "health_failure",
            severity: "major",
            score:    result.eval_score,
          },
          trigger: "health_check_failure",
        }),
      }).catch(() => {});
    }
  }

  private async evolutionCycle(): Promise<void> {
    const result = await runCortex(
      "Evolution cycle: review all episodes from the past 24h, propose organ upgrades, new tools, doctrine amendments, and architectural improvements. Be specific.",
      `scheduler_evolution_${Date.now()}`
    );
    await storeMemory(result.final_output, ["evolution", "proposal"], "evolution_engine");
    await logEpisode(result, ["scheduled", "evolution"]);
  }

  getJobs(): ScheduledJob[] { return this.jobs; }
  isRunning(): boolean       { return this.running; }
}

export const selfScheduler = new SelfScheduler();

// Auto-start in browser environment
if (typeof window !== "undefined") {
  selfScheduler.start();
}
