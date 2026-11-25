/**
 * microfixd/missions/mission_tracker.ts
 * Real-time mission tracker and provenance audit
 */

export interface TrackedMission {
  id: string;
  objective: string;
  status: "PENDING" | "RUNNING" | "EVALUATING" | "COMPLETED" | "FAILED";
  evalScore?: number;
  toolsInvoked: string[];
  createdAt: string;
  completedAt?: string;
}

class MissionTracker {
  private missions: Map<string, TrackedMission> = new Map();

  startMission(id: string, objective: string): TrackedMission {
    const mission: TrackedMission = {
      id,
      objective,
      status: "RUNNING",
      toolsInvoked: [],
      createdAt: new Date().toISOString(),
    };
    this.missions.set(id, mission);
    return mission;
  }

  recordToolInvocation(id: string, tool: string) {
    const m = this.missions.get(id);
    if (m) m.toolsInvoked.push(tool);
  }

  completeMission(id: string, evalScore: number) {
    const m = this.missions.get(id);
    if (m) {
      m.status = "COMPLETED";
      m.evalScore = evalScore;
      m.completedAt = new Date().toISOString();
    }
  }

  getMission(id: string): TrackedMission | undefined {
    return this.missions.get(id);
  }
}

export const missionTracker = new MissionTracker();
