/**
 * server/crawl/crawlQueue.ts
 * Priority crawl job queue.
 * Jobs with higher priority run first.
 * Supports: pause, resume, cancel, status.
 */
import { EventEmitter } from "eventemitter3";

export interface QueuedCrawlJob {
  id:       string;
  url:      string;
  priority: number; // 0 = highest
  status:   "queued" | "running" | "done" | "cancelled";
  addedAt:  number;
  opts:     Record<string, unknown>;
}

class CrawlQueue extends EventEmitter {
  private jobs:    QueuedCrawlJob[] = [];
  private running  = false;
  private paused   = false;

  enqueue(url: string, opts: Record<string, unknown> = {}, priority = 5): QueuedCrawlJob {
    const job: QueuedCrawlJob = {
      id:       `q_${Date.now().toString(36)}`,
      url, priority, opts,
      status:   "queued",
      addedAt:  Date.now(),
    };
    this.jobs.push(job);
    this.jobs.sort((a, b) => a.priority - b.priority);
    this.emit("enqueued", job);
    console.log(`[crawl_queue] Enqueued: ${url} (priority ${priority})`);
    return job;
  }

  dequeue(): QueuedCrawlJob | null {
    const job = this.jobs.find(j => j.status === "queued");
    if (job) job.status = "running";
    return job ?? null;
  }

  cancel(id: string): boolean {
    const job = this.jobs.find(j => j.id === id);
    if (job && job.status === "queued") { job.status = "cancelled"; return true; }
    return false;
  }

  pause():  void { this.paused = true;  this.emit("paused"); }
  resume(): void { this.paused = false; this.emit("resumed"); }

  getAll():     QueuedCrawlJob[] { return this.jobs; }
  getPending():  QueuedCrawlJob[] { return this.jobs.filter(j => j.status === "queued"); }
  getRunning():  QueuedCrawlJob[] { return this.jobs.filter(j => j.status === "running"); }
  isPaused():   boolean           { return this.paused; }
  size():       number            { return this.jobs.filter(j => j.status === "queued").length; }
}

export const crawlQueue = new CrawlQueue();
