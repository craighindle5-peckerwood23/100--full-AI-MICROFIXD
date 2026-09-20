// microfixd/core/autonomy/scheduler.ts
import { AgentRouterOrgan } from "../agents/agentRouter";
import { MemoryOrgan } from "../memory/memory";

export type TaskStatus = "pending" | "running" | "done" | "error";

export interface ScheduledTask {
  id: string;
  type: string;
  payload: any;
  status: TaskStatus;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class AutonomousSchedulerOrgan {
  private queue: ScheduledTask[] = [];
  private running = false;
  private intervalMs: number;

  constructor(
    private router: AgentRouterOrgan,
    private memory: MemoryOrgan,
    intervalMs: number = 1000
  ) {
    this.intervalMs = intervalMs;
  }

  addTask(type: string, payload: any): ScheduledTask {
    const task: ScheduledTask = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      payload,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.queue.push(task);
    this.memory.remember("scheduler_task_added", JSON.stringify(task), {
      type,
    });

    return task;
  }

  getQueue(): ScheduledTask[] {
    return [...this.queue];
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }

  private async loop() {
    while (this.running) {
      const next = this.queue.find((t) => t.status === "pending");

      if (!next) {
        await this.sleep(this.intervalMs);
        continue;
      }

      next.status = "running";
      next.updatedAt = new Date().toISOString();
      this.memory.remember("scheduler_task_running", JSON.stringify(next), {
        type: next.type,
      });

      try {
        const result = await this.router.route({
          type: next.type,
          payload: next.payload,
        });

        next.status = "done";
        next.result = result;
        next.updatedAt = new Date().toISOString();

        this.memory.remember("scheduler_task_done", JSON.stringify(next), {
          type: next.type,
        });
      } catch (err: any) {
        next.status = "error";
        next.error = err.message ?? String(err);
        next.updatedAt = new Date().toISOString();

        this.memory.remember("scheduler_task_error", JSON.stringify(next), {
          type: next.type,
        });
      }

      await this.sleep(this.intervalMs);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
