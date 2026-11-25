/**
 * microfixd/organs/paragon_dissector/dissector.ts
 * Deep structural invariant dissector
 */

export interface DissectionReport {
  actionType: string;
  isCompliant: boolean;
  score: number;
  violations: string[];
  passedChecks: string[];
}

export class ParagonDissector {
  public dissect(actionType: string, payload: Record<string, any>): DissectionReport {
    const violations: string[] = [];
    const passedChecks: string[] = [];

    // Check payload structure
    if (!payload || typeof payload !== "object") {
      violations.push("Payload must be a non-null JSON object.");
    } else {
      passedChecks.push("Payload is structured object.");
    }

    // Check anti-tamper
    const target = String(payload.target_path || payload.path || "");
    if (target.includes("governance/release-policy.json") || target.includes(".env")) {
      violations.push("Protected path access rejected by Paragon invariant.");
    } else {
      passedChecks.push("Target path conforms to safe boundaries.");
    }

    const isCompliant = violations.length === 0;
    const score = isCompliant ? 1.0 : Math.max(0, 1.0 - violations.length * 0.4);

    return {
      actionType,
      isCompliant,
      score,
      violations,
      passedChecks,
    };
  }
}

export const paragonDissector = new ParagonDissector();
