/**
 * microfixd/organs/policy/policy_engine.ts
 * Constitutional policy and permission enforcement
 */

import { ENGINEERING_DOCTRINES, DoctrineRule } from "../../constitution/doctrine/engineering_doctrine";
import { SAFETY_INVARIANTS, SafetyInvariant } from "../../constitution/safety/safety_invariants";

export interface PolicyCheckResult {
  allowed: boolean;
  violatedRules: string[];
  reasons: string[];
  timestamp: string;
}

export class PolicyEngine {
  public evaluate(context: Record<string, any>): PolicyCheckResult {
    const violatedRules: string[] = [];
    const reasons: string[] = [];

    // Check safety invariants
    for (const invariant of SAFETY_INVARIANTS) {
      if (!invariant.check(context)) {
        violatedRules.push(invariant.id);
        reasons.push(invariant.condition);
      }
    }

    // Check engineering doctrine
    for (const doctrine of ENGINEERING_DOCTRINES) {
      const result = doctrine.enforce(context);
      if (!result.passed) {
        violatedRules.push(doctrine.id);
        if (result.reason) reasons.push(result.reason);
      }
    }

    return {
      allowed: violatedRules.length === 0,
      violatedRules,
      reasons,
      timestamp: new Date().toISOString(),
    };
  }
}

export const policyEngine = new PolicyEngine();
