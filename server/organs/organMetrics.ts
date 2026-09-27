import { organRegistry } from "./organRegistry";

export interface SystemSnapshot {
  ts:              string;
  system_health:   string;
  total_organs:    number;
  active_count:    number;
  error_count:     number;
  isolated_count:  number;
  total_calls:     number;
  avg_latency_ms:  number;
  avg_success_rate: number;
}

export function getSystemSnapshot(): SystemSnapshot {
  const all    = organRegistry.all();
  const active = all.filter(o => o.status === "active" || o.status === "busy").length;
  const errors = all.filter(o => o.status === "error").length;
  const isol   = all.filter(o => o.isolated).length;
  const totalCalls = all.reduce((s, o) => s + o.metrics.total_calls, 0);
  const avgLat     = totalCalls > 0
    ? all.reduce((s, o) => s + o.metrics.avg_latency_ms * o.metrics.total_calls, 0) / totalCalls
    : 0;
  const avgSR = all.length > 0
    ? all.reduce((s, o) => s + o.metrics.success_rate, 0) / all.length
    : 1;

  return {
    ts:               new Date().toISOString(),
    system_health:    organRegistry.systemHealth(),
    total_organs:     all.length,
    active_count:     active,
    error_count:      errors,
    isolated_count:   isol,
    total_calls:      totalCalls,
    avg_latency_ms:   Math.round(avgLat * 10) / 10,
    avg_success_rate: Math.round(avgSR * 1000) / 1000,
  };
}
