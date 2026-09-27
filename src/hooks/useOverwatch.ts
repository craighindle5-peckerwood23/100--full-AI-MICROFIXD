import { useState, useEffect } from "react";
import { useServerEvents } from "./useServerEvents";

export interface OverwatchAlert {
  id:        string;
  level:     "info" | "warn" | "critical";
  category:  "drift" | "anomaly" | "hallucination" | "doctrine" | "self_mod" | "organ_fail";
  message:   string;
  organ?:    string;
  step?:     string;
  ts:        string;
  resolved:  boolean;
}

export interface OverwatchStats {
  total_runs:        number;
  interventions:     number;
  avg_integrity:     number;
  critical_count:    number;
  last_check:        string;
}

export function useOverwatch() {
  const [alerts, setAlerts] = useState<OverwatchAlert[]>([]);
  const [stats,  setStats]  = useState<OverwatchStats>({
    total_runs: 0, interventions: 0, avg_integrity: 1.0,
    critical_count: 0, last_check: new Date().toISOString(),
  });

  useServerEvents((event) => {
    if (event.type === "overwatch:alert") {
      const a = event.payload as OverwatchAlert;
      setAlerts(prev => [a, ...prev.slice(0, 99)]);
      setStats(s => ({
        ...s,
        interventions:  s.interventions + 1,
        critical_count: a.level === "critical" ? s.critical_count + 1 : s.critical_count,
        last_check:     new Date().toISOString(),
      }));
    }
    if (event.type === "overwatch:run_complete") {
      const r = event.payload as { integrity: number };
      setStats(s => ({
        ...s,
        total_runs:    s.total_runs + 1,
        avg_integrity: (s.avg_integrity * s.total_runs + r.integrity) / (s.total_runs + 1),
        last_check:    new Date().toISOString(),
      }));
    }
    if (event.type === "overwatch:resolved") {
      const { id } = event.payload as { id: string };
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
    }
  });

  const resolve = (id: string) =>
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));

  const unresolved = alerts.filter(a => !a.resolved);

  return { alerts, unresolved, stats, resolve };
}
