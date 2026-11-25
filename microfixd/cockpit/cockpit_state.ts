/**
 * microfixd/cockpit/cockpit_state.ts
 * Real-time cockpit telemetry and operator view model
 */

export interface CockpitTelemetry {
  currentStage: string;
  activeOrgan: string;
  evalScore: number;
  reflectionStatus: string;
  systemHealth: "nominal" | "degraded" | "critical";
  lastVerifiedCycleTime: string;
}

class CockpitManager {
  private state: CockpitTelemetry = {
    currentStage: "idle",
    activeOrgan: "brain",
    evalScore: 8.5,
    reflectionStatus: "dormant",
    systemHealth: "nominal",
    lastVerifiedCycleTime: new Date().toISOString(),
  };

  getState(): CockpitTelemetry {
    return { ...this.state };
  }

  update(patch: Partial<CockpitTelemetry>) {
    this.state = { ...this.state, ...patch };
  }
}

export const cockpitManager = new CockpitManager();
