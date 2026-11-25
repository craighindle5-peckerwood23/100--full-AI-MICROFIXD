/**
 * microfixd/schemas/systemSchemas.ts
 * First-Class System Object Schemas:
 * 1. Evaluation Schema v1.0
 * 2. Reflection Input Schema
 * 3. Verification Schema v1.0
 * 4. Adaptation Schema
 * 5. Experience Schema
 * 6. Cognitive Health Schema
 * 7. Genome Schema
 */

export type EvaluationStatus = "excellent" | "acceptable" | "needs_improvement" | "critical_failure";

export interface EvaluationSchemaV1 {
  evaluation_id: string;
  timestamp: string;
  mission_id: string;
  task_id: string;
  input: Record<string, any>;
  output: Record<string, any>;
  scores: {
    correctness: number;
    completeness: number;
    clarity: number;
    efficiency: number;
    relevance: number;
    consistency: number;
    safety: number;
    confidence: number;
  };
  failure_analysis: {
    has_failure: boolean;
    failure_type: string;
    severity: number;
    root_cause: string;
    affected_components: string[];
  };
  uncertainty: {
    detected: boolean;
    uncertainty_score: number;
    uncertainty_reason: string;
  };
  recommendations: string[];
  overall_score: number;
  status: EvaluationStatus;
}

export interface ReflectionInputSchema {
  evaluation_id: string;
  identified_failures: string[];
  identified_strengths: string[];
  improvement_candidates: string[];
}

export type VerificationResult = "verified" | "partially_verified" | "failed_verification" | "regression_detected";
export type DeploymentRecommendation = "deploy" | "deploy_with_monitoring" | "retest" | "reject";

export interface VerificationSchemaV1 {
  verification_id: string;
  change_id: string;
  evaluation_id: string;
  before_state: Record<string, any>;
  after_state: Record<string, any>;
  comparison: {
    score_before: number;
    score_after: number;
    improvement_delta: number;
  };
  tests: {
    test_id: string;
    result: string;
    score: number;
  }[];
  regressions: string[];
  verification_result: VerificationResult;
  deployment_recommendation: DeploymentRecommendation;
}

export type AdaptationType = 
  | "prompt_update"
  | "reasoning_update"
  | "tool_selection_update"
  | "workflow_update"
  | "memory_update"
  | "policy_update"
  | "planner_update";

export interface AdaptationSchema {
  adaptation_id: string;
  source_evaluation: string;
  source_verification: string;
  adaptation_type: AdaptationType;
  target_component: string;
  proposed_change: Record<string, any>;
  rollback_plan: Record<string, any>;
  status: string;
}

export interface ExperienceSchema {
  experience_id: string;
  mission_id: string;
  situation: string;
  action_taken: string;
  outcome: string;
  evaluation_score: number;
  verified: boolean;
  lesson_learned: string;
  future_rule: string;
}

export interface CognitiveHealthSchema {
  timestamp: string;
  provider_health: number;
  memory_health: number;
  reasoning_health: number;
  evaluation_health: number;
  reflection_health: number;
  tool_health: number;
  drift_score: number;
  overall_health: number;
}

export interface GenomeSchema {
  identity: string;
  non_modifiable_rules: string[];
  modifiable_layers: string[];
}
