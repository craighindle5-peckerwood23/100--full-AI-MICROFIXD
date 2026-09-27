// microfixd/backend/core/telemetry/grid.ts

export interface TelemetryPoint {
  channel: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface SystemMetricPoint {
  time: Date;
  cpu: number;
  memory: number;
  networkRateMBps: number;
  networkLatencyMs: number;
  status: 'NOMINAL' | 'ELEVATED_HEALING' | 'MANUAL_SUPERVISION_REQUIRED';
}

export interface AutonomousRepairEvent {
  id: string;
  subsystem: string;
  action: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: number;
  details: string;
  durationMs: number;
}

export class TelemetryGrid {
  private buffer: TelemetryPoint[] = [];
  private metricsHistory: SystemMetricPoint[] = [];
  private repairLogs: AutonomousRepairEvent[] = [];
  private autoRepairEnabled: boolean = true;
  
  private metricsSubscribers: ((latest: SystemMetricPoint, history: SystemMetricPoint[]) => void)[] = [];
  private repairsSubscribers: ((repair: AutonomousRepairEvent) => void)[] = [];
  
  private intervalId: any = null;

  constructor() {
    // Generate some initial seed history of metrics (25 items) so graphs look full immediately
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      this.metricsHistory.push({
        time: new Date(now - i * 1500),
        cpu: Math.floor(25 + Math.random() * 20),
        memory: Math.floor(35 + Math.random() * 15),
        networkRateMBps: Math.floor(40 + Math.random() * 20),
        networkLatencyMs: Math.floor(10 + Math.random() * 5),
        status: 'NOMINAL'
      });
    }

    // Only start active polling in browser environment to avoid Node.js CPU leak or Jest/Vite server hanging
    if (typeof window !== 'undefined') {
      this.startMetricsSimulation();
    }
  }

  private startMetricsSimulation() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.tickMetrics();
    }, 1500);
  }

  private tickMetrics() {
    const last = this.metricsHistory[this.metricsHistory.length - 1];
    let nextCpu = Math.floor(25 + Math.random() * 20);
    let nextMem = Math.floor(35 + Math.random() * 15);
    let nextNet = Math.floor(40 + Math.random() * 20);
    let nextLatency = Math.floor(10 + Math.random() * 5);

    // If there was a spike, gradually decay or sustain depending on repair
    if (last) {
      if (last.cpu > 70) {
        nextCpu = last.cpu - Math.floor(Math.random() * 5);
      }
      if (last.memory > 70) {
        nextMem = last.memory - Math.floor(Math.random() * 3);
      }
      if (last.networkRateMBps > 80) {
        nextNet = last.networkRateMBps - Math.floor(Math.random() * 6);
        nextLatency = last.networkLatencyMs - Math.floor(Math.random() * 2);
      }
    }

    // Constraints & Threshold check for self-healing trigger
    let status: 'NOMINAL' | 'ELEVATED_HEALING' | 'MANUAL_SUPERVISION_REQUIRED' = 'NOMINAL';
    let triggeredAutoHeal = false;
    let targetSubsystem: 'cpu' | 'memory' | 'network' | 'all' = 'all';
    let healingDetails = '';

    if (nextCpu > 80) {
      status = 'ELEVATED_HEALING';
      if (this.autoRepairEnabled) {
        triggeredAutoHeal = true;
        targetSubsystem = 'cpu';
        healingDetails = `Thread congestion detected on CPU cluster 2. Re-balancing task queue and shedding non-essential agent cycles.`;
      }
    } else if (nextMem > 75) {
      status = 'ELEVATED_HEALING';
      if (this.autoRepairEnabled) {
        triggeredAutoHeal = true;
        targetSubsystem = 'memory';
        healingDetails = `Garbage collection threshold breached in sandbox Node.js runtimes. Compacting heap heap-v6 and purging idle context layers.`;
      }
    } else if (nextNet > 85) {
      status = 'ELEVATED_HEALING';
      if (this.autoRepairEnabled) {
        triggeredAutoHeal = true;
        targetSubsystem = 'network';
        healingDetails = `Inbound throughput surge on telemetry websocket bus. Purging redundant telemetry points and flush-competing cache queues.`;
      }
    }

    if (triggeredAutoHeal) {
      // Execute the healing action right away on the next metric point
      if (targetSubsystem === 'cpu') nextCpu = Math.floor(30 + Math.random() * 15);
      if (targetSubsystem === 'memory') nextMem = Math.floor(40 + Math.random() * 10);
      if (targetSubsystem === 'network') {
        nextNet = Math.floor(45 + Math.random() * 15);
        nextLatency = Math.floor(12 + Math.random() * 4);
      }
      status = 'NOMINAL';

      // Log the repair
      const action = targetSubsystem === 'cpu' ? 'RESOURCE_REBALANCING' : targetSubsystem === 'memory' ? 'HEAP_COMPACTION' : 'BUFFER_FLUSH';
      this.logRepairAction(targetSubsystem, action, healingDetails);
    }

    const nextPoint: SystemMetricPoint = {
      time: new Date(),
      cpu: Math.max(0, Math.min(100, nextCpu)),
      memory: Math.max(0, Math.min(100, nextMem)),
      networkRateMBps: Math.max(0, nextNet),
      networkLatencyMs: Math.max(1, nextLatency),
      status
    };

    this.metricsHistory.push(nextPoint);
    if (this.metricsHistory.length > 50) {
      this.metricsHistory.shift();
    }

    // Broadcast to metrics subscribers
    this.notifyMetricsSubscribers(nextPoint);
  }

  private notifyMetricsSubscribers(latest: SystemMetricPoint) {
    this.metricsSubscribers.forEach(sub => {
      try {
        sub(latest, [...this.metricsHistory]);
      } catch (e) {
        console.error('Error in metrics subscriber callback:', e);
      }
    });
  }

  private logRepairAction(subsystem: string, action: string, details: string) {
    const event: AutonomousRepairEvent = {
      id: `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      subsystem: subsystem.toUpperCase(),
      action,
      severity: 'WARNING',
      timestamp: Date.now(),
      details,
      durationMs: Math.floor(150 + Math.random() * 200)
    };

    this.repairLogs.unshift(event);
    if (this.repairLogs.length > 30) {
      this.repairLogs.pop();
    }

    // Broadcast to repairs subscribers
    this.repairsSubscribers.forEach(sub => {
      try {
        sub(event);
      } catch (e) {
        console.error('Error in repairs subscriber callback:', e);
      }
    });
  }

  // API used by SystemMonitorWidget.tsx:36
  public isAutoRepairEnabled(): boolean {
    return this.autoRepairEnabled;
  }

  public getLatestMetrics(): { cpu: number; memory: number; network: number; deployTrigger?: boolean } {
    const last = this.metricsHistory[this.metricsHistory.length - 1];
    return {
      cpu: last ? last.cpu / 100 : 0.35,
      memory: last ? last.memory / 100 : 0.40,
      network: last ? last.networkRateMBps / 100 : 0.20,
      deployTrigger: Math.random() > 0.95
    };
  }

  // API used by SystemMonitorWidget.tsx:37
  public getRepairLogs(limit: number = 10): AutonomousRepairEvent[] {
    return this.repairLogs.slice(0, limit);
  }

  // API used by SystemMonitorWidget.tsx:40
  public subscribeMetrics(callback: (latest: SystemMetricPoint, history: SystemMetricPoint[]) => void): () => void {
    this.metricsSubscribers.push(callback);
    // Call once immediately with current values
    if (this.metricsHistory.length > 0) {
      callback(this.metricsHistory[this.metricsHistory.length - 1], [...this.metricsHistory]);
    }
    return () => {
      this.metricsSubscribers = this.metricsSubscribers.filter(sub => sub !== callback);
    };
  }

  // API used by SystemMonitorWidget.tsx:46
  public subscribeRepairs(callback: (repair: AutonomousRepairEvent) => void): () => void {
    this.repairsSubscribers.push(callback);
    return () => {
      this.repairsSubscribers = this.repairsSubscribers.filter(sub => sub !== callback);
    };
  }

  // API used by SystemMonitorWidget.tsx:71
  public setAutoRepair(enabled: boolean): void {
    this.autoRepairEnabled = enabled;
  }

  // API used by SystemMonitorWidget.tsx:77
  public executeAutonomousRepair(target: 'cpu' | 'memory' | 'network' | 'all', reason: string): void {
    const latest: SystemMetricPoint = this.metricsHistory[this.metricsHistory.length - 1] || { 
      time: new Date(), 
      cpu: 50, 
      memory: 50, 
      networkRateMBps: 50, 
      networkLatencyMs: 15,
      status: 'NOMINAL'
    };
    
    let healingDetails = '';
    let action = '';

    if (target === 'cpu' || target === 'all') {
      latest.cpu = Math.floor(20 + Math.random() * 15);
      healingDetails += `Forced re-allocation on CPU cluster. Purged zombie worker threads. `;
      action = 'MANUAL_REBALANCE';
    }
    if (target === 'memory' || target === 'all') {
      latest.memory = Math.floor(30 + Math.random() * 10);
      healingDetails += `Completed manual garbage collection sequence, reclaiming ${(35 + Math.random() * 10).toFixed(1)} GB from memory sandbox heap. `;
      action = action ? 'FULL_HEALTH_HEAL' : 'MANUAL_HEAP_COMPACTION';
    }
    if (target === 'network' || target === 'all') {
      latest.networkRateMBps = Math.floor(35 + Math.random() * 15);
      latest.networkLatencyMs = Math.floor(8 + Math.random() * 4);
      healingDetails += `Flushed inbound network buffers, returning packet queue latency to baseline. `;
      action = action ? 'FULL_HEALTH_HEAL' : 'MANUAL_BUFFER_FLUSH';
    }

    latest.status = 'NOMINAL';
    this.metricsHistory[this.metricsHistory.length - 1] = { ...latest };

    // Log the manual repair
    this.logRepairAction(target.toUpperCase(), action, `Operator manual override: "${reason}". Details: ${healingDetails.trim()}`);
    
    // Broadcast updated metrics
    this.notifyMetricsSubscribers(latest);
  }

  // API used by SystemMonitorWidget.tsx:83
  public simulateSpike(type: 'cpu' | 'memory' | 'network'): void {
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    if (!latest) return;

    if (type === 'cpu') {
      latest.cpu = Math.floor(92 + Math.random() * 6);
      latest.status = 'ELEVATED_HEALING';
    } else if (type === 'memory') {
      latest.memory = Math.floor(88 + Math.random() * 8);
      latest.status = 'ELEVATED_HEALING';
    } else if (type === 'network') {
      latest.networkRateMBps = Math.floor(115 + Math.random() * 20);
      latest.networkLatencyMs = Math.floor(180 + Math.random() * 100);
      latest.status = 'ELEVATED_HEALING';
    }

    this.metricsHistory[this.metricsHistory.length - 1] = { ...latest };
    this.notifyMetricsSubscribers(latest);

    // If auto-repair is enabled, tick right away to heal it instantly for an elegant fast-paced demo experience
    if (this.autoRepairEnabled) {
      setTimeout(() => {
        this.tickMetrics();
      }, 800);
    }
  }

  public push(channel: string, payload: Record<string, unknown>): void {
    this.buffer.push({
      channel,
      payload,
      timestamp: Date.now(),
    });
    if (this.buffer.length > 1000) {
      this.buffer.shift();
    }
  }

  public getChannel(channel: string, limit: number = 50): TelemetryPoint[] {
    return this.buffer.filter((p) => p.channel === channel).slice(-limit);
  }

  public getSnapshot(): {
    cpu: number;
    ram: number;
    gpu: number;
    networkRate: string;
    pointsCount: number;
  } {
    return {
      cpu: Math.floor(25 + Math.random() * 20),
      ram: Math.floor(35 + Math.random() * 15),
      gpu: Math.floor(20 + Math.random() * 25),
      networkRate: "3.2 GB/s",
      pointsCount: this.buffer.length,
    };
  }
}

export const telemetry = new TelemetryGrid();
