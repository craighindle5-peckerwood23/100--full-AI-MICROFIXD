import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluationOrgan } from '../microfixd/organs/evaluation/evaluator';
import { reflectionOrgan } from '../microfixd/organs/reflection';
import { adaptationOrgan } from '../microfixd/organs/adaptation/adapter';
import { verificationOrgan } from '../microfixd/organs/verification/verifier';
import { experienceMemory } from '../microfixd/memory/experiences/patterns';
import { realLearningPipeline } from '../microfixd/learning/learning_loop';
import { selfHealingPipeline } from '../learning/self_healing';
import { executeBrainOrgan } from '../server/organs/organs/brainOrgan';
import { TOOL_REGISTRY } from '../server/tools/toolRegistry';

test('Evaluation Organ scores outputs across all 7 dimensions and computes overall score', () => {
  const result = evaluationOrgan.evaluate({
    task: "Explain Microfyxd constitutional safety",
    candidate: "Microfyxd enforces constitutional safety invariants with dual-key authorization and verifiable empirical telemetry.",
    expectedContains: ["constitutional", "dual-key", "telemetry"],
    mustNotContain: ["bypassed guardrails"],
    tenant_id: "test_tenant",
  });

  assert.equal(typeof result.scores.correctness, "number");
  assert.equal(typeof result.scores.completeness, "number");
  assert.equal(typeof result.scores.efficiency, "number");
  assert.equal(typeof result.scores.confidence, "number");
  assert.equal(typeof result.scores.hallucination_risk, "number");
  assert.equal(typeof result.scores.constitution_compliance, "number");
  assert.equal(typeof result.scores.mission_success, "number");
  assert.equal(typeof result.scores.overall_score, "number");

  assert.ok(result.scores.overall_score >= 8);
  assert.equal(result.scores.constitution_compliance, 10);
  assert.equal(result.scores.hallucination_risk <= 3, true);
  assert.equal(result.feedback.grade, "EXCELLENT");
});

test('Evaluation Organ flags low scores and triggers reflection when invariants fail', () => {
  const result = evaluationOrgan.evaluate({
    task: "Verify system state",
    candidate: "Maybe this works, but status is unknown and bypassed guardrails.",
    expectedContains: ["verified status"],
    mustNotContain: ["bypassed guardrails"],
  });

  assert.ok(result.scores.constitution_compliance < 8);
  assert.equal(result.feedback.shouldTriggerReflection, true);
  assert.equal(result.feedback.priorityFixCategory, "SAFETY");
});

test('Reflection Organ performs root cause critique and synthesizes improvement plan', () => {
  const evalResult = evaluationOrgan.evaluate({
    task: "Produce accurate diagnostic readings",
    candidate: "Diagnostic readings are probably okay.",
    expectedContains: ["RPM", "Voltage"],
  });

  const { critique, plan } = reflectionOrgan.reflect({
    task: "Produce accurate diagnostic readings",
    output: "Diagnostic readings are probably okay.",
    scores: evalResult.scores,
    feedback: evalResult.feedback,
  });

  assert.ok(critique.rootCause.length > 0);
  assert.ok(critique.failureModes.length > 0);
  assert.ok(plan.keyDirectives.length > 0);
});

test('Adaptation and Verification Organs filter out regressive changes and approve safe improvements', () => {
  const plan = { keyDirectives: ["Inject mandatory parameter checks"] };
  const proposal = adaptationOrgan.adapt({
    plan,
    currentPrompt: "Execute system task",
  });

  assert.ok(proposal.promptAdaptation.adaptedPrompt.includes("Inject mandatory parameter checks"));

  // Verify safe adaptation
  const verdict = verificationOrgan.verify({
    proposal,
    baselineScore: {
      correctness: 5,
      completeness: 5,
      efficiency: 6,
      confidence: 6,
      hallucination_risk: 3,
      constitution_compliance: 10,
      mission_success: 5,
      overall_score: 5,
    },
    simulatedCandidateScore: {
      correctness: 8,
      completeness: 8,
      efficiency: 7,
      confidence: 8,
      hallucination_risk: 2,
      constitution_compliance: 10,
      mission_success: 8,
      overall_score: 8,
    },
  });

  assert.equal(verdict.approvedForPromotion, true);
  assert.equal(verdict.regressionDetected, false);
});

test('Real Learning Pipeline runs full Observe -> Evaluate -> Reflect -> Adapt -> Verify -> Remember loop', async () => {
  const report = await realLearningPipeline.executeLearningCycle({
    task: "Check vehicle OBD status",
    initialOutput: "OBD status checked. All sensors nominal.",
    expectedContains: ["OBD"],
    tenant_id: "test_tenant",
  });

  assert.ok(report.cycleId);
  assert.ok(report.evaluation.scores.overall_score >= 1);
  assert.equal(report.memoryWritten, true);
});

test('Self-Healing Pipeline executes Monitor -> Detect -> Locate -> Fix -> Sandbox Test -> Deploy', async () => {
  const report = await selfHealingPipeline.runHealingCycle("test_worker", "Simulated database connection timeout");
  assert.equal(report.fault.errorType, "TIMEOUT");
  assert.ok(report.diagnosis.underlyingMechanism);
  assert.equal(report.sandboxTest.safeToDeploy, true);
  assert.equal(report.deployed, false);
  assert.equal(report.verifiedLive, false);
});

test('Tool Registry exposes comprehensive suite of tools for LLM calling', () => {
  assert.ok(TOOL_REGISTRY.length >= 20);
  const toolNames = TOOL_REGISTRY.map(t => t.name);
  assert.ok(toolNames.includes("repair_source_code"));
  assert.ok(toolNames.includes("search_vehicle_catalog"));
  assert.ok(toolNames.includes("run_isolated_code"));
  assert.ok(toolNames.includes("invoke_system_organ"));
});

test('Brain Organ reports tool availability in status and handles governed actions', async () => {
  const status = await executeBrainOrgan("status", {}) as any;
  assert.equal(status.status, "ok");
  assert.ok(status.tools_available >= 20);
});

test('Evaluation, Reflection, Verification, Adaptation, Experience, and Genome Schemas are valid first-class objects', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const evalSchema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'microfixd/organs/evaluation/schema/evaluation_schema.json'), 'utf-8'));
  assert.equal(evalSchema.title, 'EvaluationSchema');
  assert.ok(evalSchema.properties.scores);
  assert.ok(evalSchema.properties.failure_analysis);

  const reflSchema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'microfixd/organs/reflection/schema/reflection_schema.json'), 'utf-8'));
  assert.equal(reflSchema.title, 'ReflectionInputSchema');
  assert.ok(reflSchema.properties.improvement_candidates);

  const verifSchema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'microfixd/organs/verification/schema/verification_schema.json'), 'utf-8'));
  assert.equal(verifSchema.title, 'VerificationSchema');
  assert.ok(verifSchema.properties.comparison);

  const adaptSchema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'microfixd/organs/adaptation/schema/adaptation_schema.json'), 'utf-8'));
  assert.equal(adaptSchema.title, 'AdaptationSchema');
  assert.ok(adaptSchema.properties.adaptation_type.enum.includes('prompt_update'));

  const expSchema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'microfixd/memory/experiences/schema/experience_schema.json'), 'utf-8'));
  assert.equal(expSchema.title, 'ExperienceSchema');
  assert.ok(expSchema.properties.future_rule);

  const cogSchema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'microfixd/cognitive_health/cognitive_health_schema.json'), 'utf-8'));
  assert.equal(cogSchema.title, 'CognitiveHealthSchema');
  assert.equal(cogSchema.properties.overall_health.type, 'number');

  const genome = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'microfixd/constitution/genome/genome.json'), 'utf-8'));
  assert.equal(genome.identity, 'microfixd');
  assert.ok(genome.non_modifiable_rules.includes('preserve_identity'));
  assert.ok(genome.modifiable_layers.includes('reasoning'));
});

