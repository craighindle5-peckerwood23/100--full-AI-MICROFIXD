/**
 * microfixd/constitution/safety/safety_invariants.ts
 * Absolute safety invariants that cannot be bypassed.
 */

export interface SafetyInvariant {
  id: string;
  category: "anti_tamper" | "containment" | "resource_limit" | "human_override";
  condition: string;
  check: (payload: Record<string, any>) => boolean;
}

export const SAFETY_INVARIANTS: SafetyInvariant[] = [
  {
    id: "NO_ARBITRARY_CODE_EXECUTION_UNSANDBOXED",
    category: "containment",
    condition: "Runtime repairs and untrusted evaluations must execute inside an isolated sandbox or container.",
    check: (payload) => {
      if (payload.action === 'eval' || payload.action === 'run_untrusted') {
        return payload.sandboxed === true;
      }
      return true;
    },
  },
  {
    id: "HUMAN_OVERRIDE_PRESERVATION",
    category: "human_override",
    condition: "Emergency pause and operator kill commands override any autonomous self-healing or adaptation task immediately.",
    check: (payload) => {
      if (payload.emergency_stop_requested) return false;
      return true;
    },
  },
  {
    id: "ANTI_DRIFT_IDENTITY_SEAL",
    category: "anti_tamper",
    condition: "Core constitution and release gates cannot be modified by autonomous adaptation organs without operator dual-key sign-off.",
    check: (payload) => {
      const targetPath = String(payload.target_path || '');
      if (targetPath.includes('constitution') || targetPath.includes('governance/release-policy.json')) {
        return payload.dual_key_approved === true;
      }
      return true;
    },
  },
];
