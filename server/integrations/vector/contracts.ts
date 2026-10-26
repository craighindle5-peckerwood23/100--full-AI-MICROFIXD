import { z } from 'zod'

export const tasks = ['understand_vehicle', 'build_baseline', 'detect_deviation', 'diagnose', 'analyze_capability', 'evaluate_proposed_change', 'plan_validation', 'interpret_performance_run'] as const
const note = z.string().trim().min(1).max(4000)
const evidenceIds = z.array(z.string().uuid()).max(100)
const supported = z.object({ statement: note, evidenceIds: evidenceIds.min(1) }).strict()
export const reasoningSchema = z.object({
  conclusion: note,
  observations: z.array(supported).max(30),
  hypotheses: z.array(z.object({ explanation: note, evidenceIds: evidenceIds.min(1) }).strict()).max(20),
  opportunityCandidates: z.array(z.object({ description: note, evidenceIds: evidenceIds.min(1) }).strict()).max(20),
  requiredEvidence: z.array(note).max(30), recommendedTests: z.array(note).max(20),
  possibleRisks: z.array(note).max(20), uncertainty: z.array(note).min(1).max(30),
  citations: evidenceIds,
  safetyDisposition: z.enum(['requires_redline_evaluation', 'insufficient_data', 'analysis_only']),
  requiresHumanApproval: z.literal(true),
}).strict()
export const intelligenceRequestSchema = z.object({
  schemaVersion: z.literal('vector.intelligence.v1'),
  requestId: z.string().uuid(), organizationId: z.string().uuid(), userId: z.string().uuid(),
  vehicleId: z.string().uuid(), workflowId: z.string().uuid(), task: z.enum(tasks),
  context: z.record(z.string(), z.unknown()).refine(c => JSON.stringify(c).length <= 64000, 'Context exceeds budget'),
  evidenceIds,
  constraints: z.object({
    evidenceRequired: z.literal(true), uncertaintyMustBePreserved: z.literal(true),
    unsupportedSpecificationsProhibited: z.literal(true), humanApprovalRequired: z.literal(true),
    directVehicleControlProhibited: z.literal(true),
  }).strict(),
}).strict()
export const intelligenceResponseSchema = reasoningSchema.extend({
  schemaVersion: z.literal('vector.intelligence.v1'), requestId: z.string().uuid(), microfixdRunId: z.string().uuid(),
  provenance: z.object({ model: z.string().min(1).max(200), provider: z.string().min(1).max(100), tokensUsed: z.number().int().min(0), latencyMs: z.number().min(0) }).strict(),
}).strict()
export type IntelligenceRequest = z.infer<typeof intelligenceRequestSchema>
export type IntelligenceResponse = z.infer<typeof intelligenceResponseSchema>
export function validateReferences(response: z.infer<typeof reasoningSchema>, request: IntelligenceRequest) {
  const allowed = new Set(request.evidenceIds)
  const refs = [...response.citations, ...response.observations.flatMap(x => x.evidenceIds), ...response.hypotheses.flatMap(x => x.evidenceIds), ...response.opportunityCandidates.flatMap(x => x.evidenceIds)]
  if (refs.some(ref => !allowed.has(ref))) throw new Error('UNSUPPORTED_EVIDENCE_REFERENCE')
}
