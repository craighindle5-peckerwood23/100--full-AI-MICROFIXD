// microfixd/backend/core/mission/engine.ts

export interface Mission {
  id: string;
  name: string;
  objective: string;
  status: "PLANNED" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  progress: number;
  activeAgents: string[];
}

export class MissionEngine {
  public getCurrentMission(): Mission | null {
    return null; // Legacy display compatibility; query the authenticated durable planner.
  }

  public updateMission(updates: Partial<Mission>): Mission {
    throw new Error('LEGACY_MISSION_STATE_RETIRED_USE_DURABLE_PLANNER');
  }
}

export const missionEngine = new MissionEngine();
