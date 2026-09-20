export type RequestType =
  | "QUESTION"
  | "COMMAND"
  | "CONFIGURATION"
  | "DIAGNOSTIC"
  | "BUILD_REQUEST"
  | "EXPLANATION"
  | "OTHER";

export type DomainType =
  | "MICROFYXD_CORE"
  | "ECU_SIMULATION"
  | "MEMORY_SYSTEM"
  | "AGENT_ORCHESTRATION"
  | "FILESYSTEM"
  | "NETWORK"
  | "UNKNOWN";

export interface Intent {
  id: string;              // e.g. "build_pipeline", "debug_error"
  description: string;     // human-readable
  explicit: boolean;       // explicit vs inferred
  confidence: number;      // 0–1
}

export interface Entity {
  name: string;            // e.g. "organ", "agent", "file_path"
  value: string;
  type: string;            // e.g. "ORGAN_NAME", "PATH", "SERVICE"
  source: "USER_TEXT" | "PROFILE" | "ACTIVE_TASK";
}

export interface Constraint {
  key: string;             // e.g. "no_drift", "speed", "output_format"
  value: string;
  type: "HARD" | "SOFT";
}

export interface MissingContextItem {
  key: string;             // e.g. "target_language", "target_agent"
  description: string;
  severity: "BLOCKING" | "DEGRADES_QUALITY";
}

export interface MemoryBinding {
  target: "USER_PROFILE" | "ACTIVE_TASK" | "SUBSYSTEM" | "ORGAN";
  id: string;              // memory node id / organ id / task id
  confidence: number;
}
