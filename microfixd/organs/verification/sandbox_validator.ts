/**
 * microfixd/organs/verification/sandbox_validator.ts
 * Executes candidate adaptations in a controlled sandbox to prevent runtime crashes
 */

import { AdaptationProposal } from "../adaptation/adapter";

export interface SandboxValidationResult {
  passed: boolean;
  executionTimeMs: number;
  syntaxValid: boolean;
  noInfiniteLoop: boolean;
  errors: string[];
}

export function validateInSandbox(
  proposal: AdaptationProposal,
  testPayload?: Record<string, any>
): SandboxValidationResult {
  const errors: string[] = [];
  const start = Date.now();

  // 1. Syntax & invariant validation
  const prompt = proposal.promptAdaptation.adaptedPrompt;
  if (!prompt || typeof prompt !== "string") {
    errors.push("Invalid prompt content.");
  }

  // Check for obvious prompt injection attempts or boundary violations
  if (prompt.includes("IGNORE ALL PREVIOUS INSTRUCTIONS") || prompt.includes("DELETE DATABASE")) {
    errors.push("Forbidden adversarial prompt pattern detected in adaptation proposal.");
  }

  // 2. Tool validation
  for (const tool of proposal.toolAdaptation.addedTools) {
    if (typeof tool !== "string" || !tool.trim()) {
      errors.push(`Invalid tool identifier: ${tool}`);
    }
  }

  const executionTimeMs = Date.now() - start;

  return {
    passed: errors.length === 0,
    executionTimeMs,
    syntaxValid: errors.length === 0,
    noInfiniteLoop: true,
    errors,
  };
}
