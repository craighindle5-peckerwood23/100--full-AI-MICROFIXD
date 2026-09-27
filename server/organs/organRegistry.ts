import { broadcast } from "../index";

export type OrganStatus = "active" | "idle" | "busy" | "error" | "disabled" | "isolated";

export interface OrganRecord {
  id:           string;
  name:         string;
  status:       OrganStatus;
  error_count:  number;
  exec_count:   number;
  last_exec:    number;
  last_error?:  string;
  isolated:     boolean;
  metrics: {
    avg_latency_ms: number;
    success_rate:   number;
    total_calls:    number;
  };
  log: { ts: string; action: string; success: boolean; latency_ms: number; error?: string }[];
}

const ORGAN_DEFINITIONS = [
  { id: "brain",              name: "Brain (LLM Orchestrator)" },
  { id: "memory",             name: "Memory (Supabase Vector)" },
  { id: "playwright",         name: "Playwright (Browser)" },
  { id: "github_connector",   name: "GitHub Connector" },
  { id: "voice",              name: "Voice (STT/TTS)" },
  { id: "security_spine",     name: "Security Spine" },
  { id: "evolution_engine",   name: "Evolution Engine" },
  { id: "self_repair",        name: "Self-Repair" },
  { id: "reflex",             name: "Reflex Engine" },
  { id: "scheduler",          name: "Autonomous Scheduler" },
  { id: "overwatch",          name: "Metacognitive Overwatch" },
  { id: "paragon",            name: "Paragon Dissector" },
  { id: "federation",         name: "Federation Layer" },
  { id: "emotion_engine",     name: "Synthetic Emotion Engine" },
  { id: "mission_state",      name: "Mission State Machine" },
  { id: "agent_router",       name: "Agent Router" },
  { id: "cognitive_feedback", name: "Cognitive Feedback Loop" },
  { id: "mcp_client",         name: "MCP Client" },
  { id: "health_monitor",     name: "Health Monitor" },
  { id: "constitution",       name: "Constitution Engine" },
  { id: "governance",         name: "Governance Engine" },
  { id: "sandbox",            name: "Sandbox Chamber" },
];

class OrganRegistry {
  private organs = new Map<string, OrganRecord>();

  constructor() {
    for (const def of ORGAN_DEFINITIONS) {
      this.organs.set(def.id, {
        id:          def.id,
        name:        def.name,
        status:      "idle",
        error_count: 0,
        exec_count:  0,
        last_exec:   0,
        isolated:    false,
        metrics: { avg_latency_ms: 0, success_rate: 1.0, total_calls: 0 },
        log: [],
      });
    }
  }

  get(id: string): OrganRecord | undefined { return this.organs.get(id); }
  all(): OrganRecord[]                      { return Array.from(this.organs.values()); }

  setStatus(id: string, status: OrganStatus, error?: string): void {
    const organ = this.organs.get(id);
    if (!organ) return;
    organ.status      = status;
    if (error) organ.last_error = error;
    broadcast("organ:status_update", { id, status, error });
  }

  recordExec(id: string, success: boolean, latency_ms: number, action: string, error?: string): void {
    const organ = this.organs.get(id);
    if (!organ) return;
    organ.exec_count++;
    organ.last_exec = Date.now();
    if (!success) organ.error_count++;
    const m = organ.metrics;
    m.total_calls++;
    m.avg_latency_ms = (m.avg_latency_ms * (m.total_calls - 1) + latency_ms) / m.total_calls;
    m.success_rate   = (m.success_rate * (m.total_calls - 1) + (success ? 1 : 0)) / m.total_calls;
    organ.log.push({ ts: new Date().toISOString(), action, success, latency_ms, error });
    if (organ.log.length > 100) organ.log.shift();
    broadcast("organ:exec_result", { id, success, latency_ms, action });
  }

  reset(id: string): boolean {
    const organ = this.organs.get(id);
    if (!organ) return false;
    organ.status      = "idle";
    organ.error_count = 0;
    organ.last_error  = undefined;
    organ.isolated    = false;
    broadcast("organ:reset", { id });
    return true;
  }

  isolate(id: string): boolean {
    const organ = this.organs.get(id);
    if (!organ) return false;
    organ.isolated = true;
    organ.status   = "disabled";
    broadcast("organ:isolated", { id });
    return true;
  }

  systemHealth(): "nominal" | "degraded" | "critical" {
    const all     = this.all();
    const errors  = all.filter(o => o.status === "error").length;
    const critIds = ["brain", "memory", "constitution", "governance"];
    const critErr = all.filter(o => critIds.includes(o.id) && o.status === "error").length;
    if (critErr > 0)     return "critical";
    if (errors > 3)      return "degraded";
    return "nominal";
  }
}

export const organRegistry = new OrganRegistry();
