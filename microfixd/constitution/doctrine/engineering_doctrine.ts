/**
 * microfixd/constitution/doctrine/engineering_doctrine.ts
 * Operational & Engineering Doctrine for Microfyxd
 */

export interface DoctrineRule {
  id: string;
  name: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  enforce: (context: Record<string, any>) => { passed: boolean; reason?: string };
}

export const ENGINEERING_DOCTRINES: DoctrineRule[] = [
  {
    id: "DOCTRINE_EVAL_FIRST",
    name: "Evaluation Before Acceptance",
    description: "Every LLM output, generated action, or state change must pass through the Evaluation Organ before commitment.",
    severity: "CRITICAL",
    enforce: (ctx) => ({
      passed: Boolean(ctx.evaluation && ctx.evaluation.overall_score !== undefined),
      reason: ctx.evaluation ? undefined : "Output was unrated by Evaluation Organ",
    }),
  },
  {
    id: "DOCTRINE_VERIFIED_ADAPTATION",
    name: "Verification Guard",
    description: "Proposed adaptations to prompts, tools, or code must pass verification sandbox testing before permanent promotion.",
    severity: "CRITICAL",
    enforce: (ctx) => ({
      passed: ctx.adaptation ? Boolean(ctx.verified) : true,
      reason: ctx.adaptation && !ctx.verified ? "Adaptation proposed without verification certificate" : undefined,
    }),
  },
  {
    id: "DOCTRINE_TENANT_ISOLATION",
    name: "Strict Tenant Boundary",
    description: "Multi-tenant runs must never leak memory, cache, or evaluations across different tenant boundaries.",
    severity: "CRITICAL",
    enforce: (ctx) => ({
      passed: Boolean(ctx.tenant_id && typeof ctx.tenant_id === 'string' && ctx.tenant_id.trim().length > 0),
      reason: "Missing or invalid tenant identifier",
    }),
  },
  {
    id: "DOCTRINE_ROOT_CAUSE_REQUIRED",
    name: "Root Cause Reflection",
    description: "Any evaluation failure with score below threshold requires a structured reflection identifying specific failure modes.",
    severity: "HIGH",
    enforce: (ctx) => {
      if (ctx.evaluation && ctx.evaluation.overall_score < 7) {
        return {
          passed: Boolean(ctx.reflection && Array.isArray(ctx.reflection.failure_modes) && ctx.reflection.failure_modes.length > 0),
          reason: "Low score without structured root cause reflection",
        };
      }
      return { passed: true };
    },
  },
];
