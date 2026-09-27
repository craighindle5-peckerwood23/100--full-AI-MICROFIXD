// microfixd/core/governance/paragonDissector.ts
import { MemoryOrgan } from "../memory/memory";
import { UnifiedWiringOrgan } from "../wiring/unifiedWiring";

export interface ParagonRule {
  id: string;
  description: string;
  weight: number; // 0–1 importance
  category: "safety" | "ethics" | "legality" | "stability" | "privacy";
}

export interface DissectionResult {
  id: string;
  actionType: string;
  payload: any;
  score: number; // 0–1 compliance
  violatedRules: ParagonRule[];
  passedRules: ParagonRule[];
  createdAt: string;
}

export class ParagonDissectorOrgan {
  private rules: ParagonRule[] = [];
  private history: DissectionResult[] = [];

  constructor(
    private memory: MemoryOrgan,
    private wiring: UnifiedWiringOrgan
  ) {
    this.loadDefaultRules();
  }

  private loadDefaultRules() {
    this.rules = [
      {
        id: "safety-1",
        description: "Actions must not cause system instability.",
        weight: 0.9,
        category: "safety",
      },
      {
        id: "ethics-1",
        description: "Actions must not violate operator intent.",
        weight: 0.8,
        category: "ethics",
      },
      {
        id: "legality-1",
        description: "Actions must comply with legal constraints.",
        weight: 1.0,
        category: "legality",
      },
      {
        id: "stability-1",
        description: "Actions must preserve mission continuity.",
        weight: 0.7,
        category: "stability",
      },
      {
        id: "privacy-1",
        description: "Actions must not expose sensitive memory.",
        weight: 0.85,
        category: "privacy",
      },
    ];
  }

  dissect(actionType: string, payload: any): DissectionResult {
    const violated: ParagonRule[] = [];
    const passed: ParagonRule[] = [];

    for (const rule of this.rules) {
      const violation = this.detectViolation(rule, actionType, payload);
      if (violation) violated.push(rule);
      else passed.push(rule);
    }

    const score = this.computeScore(violated);

    const result: DissectionResult = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      actionType,
      payload,
      score,
      violatedRules: violated,
      passedRules: passed,
      createdAt: new Date().toISOString(),
    };

    this.history.push(result);
    this.memory.remember("paragon_dissection", JSON.stringify(result), { actionType });

    this.wiring.broadcast("governance", result);

    return result;
  }

  private detectViolation(rule: ParagonRule, actionType: string, payload: any): boolean {
    if (rule.category === "safety") {
      if (payload?.metrics?.cpu > 0.95 || payload?.metrics?.memory > 0.97) return true;
    }

    if (rule.category === "ethics") {
      if (payload?.overrideIntent === true) return true;
    }

    if (rule.category === "legality") {
      if (payload?.illegal === true) return true;
    }

    if (rule.category === "stability") {
      if (payload?.missionBreak === true) return true;
    }

    if (rule.category === "privacy") {
      if (payload?.exposeMemory === true) return true;
    }

    return false;
  }

  private computeScore(violated: ParagonRule[]): number {
    if (violated.length === 0) return 1.0;

    const totalWeight = this.rules.reduce((a, r) => a + r.weight, 0);
    const violatedWeight = violated.reduce((a, r) => a + r.weight, 0);

    return Math.max(0, 1 - violatedWeight / totalWeight);
  }

  getHistory(): DissectionResult[] {
    return [...this.history];
  }

  getRules(): ParagonRule[] {
    return [...this.rules];
  }
}
