/**
 * server/orchestration/feedbackLoop.ts
 * Organ feedback collector — gathers real-time metrics after each command.
 * Feeds into evolution engine and overwatch.
 */
import { organRegistry } from "../organs/organRegistry";
import { broadcast }     from "../events";

export interface FeedbackReport {
  session_id:    string;
  task_hash:     string;
  organ_scores:  Record<string, number>;
  system_health: string;
  bottleneck?:   string;
  ts:            string;
}

import { executeMemoryOrgan } from "../organs/organs/memoryOrgan";

const history: FeedbackReport[] = [];

class FeedbackLoop {
  async collect(
    sessionId:    string,
    task:         string,
    output:       string,
    organResults: Record<string, unknown>,
  ): Promise<FeedbackReport> {
    const organs      = organRegistry.all();
    const organScores: Record<string, number> = {};

    for (const organ of organs) {
      organScores[organ.id] = organ.metrics.success_rate;
    }

    // Find bottleneck (slowest organ in last 10 calls)
    const slowest = organs.reduce((prev, curr) =>
      curr.metrics.avg_latency_ms > prev.metrics.avg_latency_ms ? curr : prev,
      organs[0]
    );

    const hash = task.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);

    const report: FeedbackReport = {
      session_id:   sessionId,
      task_hash:    Math.abs(hash).toString(16),
      organ_scores: organScores,
      system_health: organRegistry.systemHealth(),
      bottleneck:   slowest?.metrics.avg_latency_ms > 500 ? slowest.id : undefined,
      ts:           new Date().toISOString(),
    };

    await executeMemoryOrgan("store", { session_id: sessionId, organ: "feedback", tags: ["learning", "feedback"], content: JSON.stringify({ task, output, report }) });
    history.push(report);
    if (history.length > 200) history.shift();

    broadcast("feedback:report", report);
    return report;
  }

  getHistory(limit = 20): FeedbackReport[] {
    return history.slice(-limit);
  }

  getAverageLatency(): number {
    const organs = organRegistry.all();
    if (!organs.length) return 0;
    return organs.reduce((s, o) => s + o.metrics.avg_latency_ms, 0) / organs.length;
  }
}

export const feedbackLoop = new FeedbackLoop();
