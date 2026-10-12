import test from'node:test';
import assert from'node:assert/strict';
import{executeEvaluationOrgan,executeUncertaintyOrgan}from'../server/organs/organs/cognitiveAssuranceOrgan';

test('evaluation organ reports explicit deterministic criteria',async()=>{
 const result=await executeEvaluationOrgan('evaluate',{candidate:'Microfixd uses live telemetry.',expectedContains:['live telemetry'],mustNotContain:['fake status']});
 assert.equal(result.success,true);assert.equal(result.score,1);assert.equal(result.checks.length,3);
});

test('uncertainty organ exposes measured signals instead of invented confidence',async()=>{
 const withoutEvidence=await executeUncertaintyOrgan('score',{output:'This might be correct, but the source is unknown.',evidenceCount:0});
 const withEvidence=await executeUncertaintyOrgan('score',{output:'The verified runtime returned status ok.',evidenceCount:5});
 assert.ok(withoutEvidence.uncertainty>withEvidence.uncertainty);
 assert.equal(withEvidence.method,'deterministic_evidence_and_language_signals');
});
