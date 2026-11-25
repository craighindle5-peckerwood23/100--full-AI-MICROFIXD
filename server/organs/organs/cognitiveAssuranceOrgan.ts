import { executeMemoryOrgan } from './memoryOrgan';
import { completeTextWithFallback } from '../../orchestration/llmFallback';
import { governanceEngine } from '../../../microfixd/backend/core/governance/engine';
import { initOrgans } from '../../../microfixd/langgraph/organs';

type Obj=Record<string,any>;
const object=(payload:unknown):Obj=>payload&&typeof payload==='object'?payload as Obj:{};
const text=(value:unknown)=>typeof value==='string'?value:String(value??'');

export async function executeKnowledgeOrgan(action:string,payload:unknown){
  const p=object(payload);
  if(!['retrieve','query','search','context','execute'].includes(action))throw new Error(`Unsupported knowledge action: ${action}`);
  const query=text(p.query||p.task).trim();
  if(!query)throw new Error('Knowledge retrieval requires query or task');
  const result=await executeMemoryOrgan('context',{
    tenant_id:text(p.tenant_id||'global'),
    session_id:text(p.session_id||'default'),
    query,
    limit:Math.max(1,Math.min(50,Number(p.limit)||12)),
    max_chars:Math.max(1000,Math.min(60000,Number(p.max_chars)||18000)),
  });
  return{success:true,mode:'durable_rag_context',query,source:'supabase',...result};
}

import { evaluationOrgan } from '../../../microfixd/organs/evaluation/evaluator';
import { reflectionOrgan } from '../../../microfixd/organs/reflection';
import { adaptationOrgan } from '../../../microfixd/organs/adaptation/adapter';
import { verificationOrgan } from '../../../microfixd/organs/verification/verifier';
import { selfHealingPipeline } from '../../../learning/self_healing';

export async function executeEvaluationOrgan(action:string,payload:unknown){
  if(!['evaluate','verify','execute'].includes(action))throw new Error(`Unsupported evaluation action: ${action}`);
  const p=object(payload);const candidate=text(p.candidate??p.output??p.text);
  if(!candidate.trim())throw new Error('Evaluation requires candidate/output/text');
  const expected=Array.isArray(p.expectedContains)?p.expectedContains.map(text).filter(Boolean):[];
  const forbidden=Array.isArray(p.mustNotContain)?p.mustNotContain.map(text).filter(Boolean):[];
  const checks=[
    {id:'non_empty',passed:candidate.trim().length>0},
    ...expected.map((v:string)=>({id:`contains:${v.slice(0,48)}`,passed:candidate.toLowerCase().includes(v.toLowerCase())})),
    ...forbidden.map((v:string)=>({id:`excludes:${v.slice(0,48)}`,passed:!candidate.toLowerCase().includes(v.toLowerCase())})),
  ];
  const passed=checks.filter(c=>c.passed).length;
  const legacyScore=checks.length?passed/checks.length:1;

  // Run full multi-dimensional Evaluation Organ
  const highOrderEval = evaluationOrgan.evaluate({
    task: text(p.task || 'eval_task'),
    candidate,
    expectedContains: expected,
    mustNotContain: forbidden,
    tenant_id: text(p.tenant_id || 'global'),
  });

  return {
    success: passed === checks.length && highOrderEval.success,
    score: legacyScore,
    checks,
    measured: { characters: candidate.length, lines: candidate.split(/\r?\n/).length },
    evaluationScores: highOrderEval.scores,
    feedback: highOrderEval.feedback,
    metrics: highOrderEval.metrics,
    record: highOrderEval.record,
  };
}

export async function executeAdaptationOrgan(action:string,payload:unknown){
  const p=object(payload);
  const plan = p.plan || { keyDirectives: [text(p.directive || 'Refine prompt constraints')] };
  const result = adaptationOrgan.adapt({
    plan,
    currentPrompt: text(p.prompt || p.task || ''),
    currentTools: Array.isArray(p.tools) ? p.tools : undefined,
  });
  return { success: true, action, adaptation: result };
}

export async function executeVerificationOrgan(action:string,payload:unknown){
  const p=object(payload);
  const baseline = p.baselineScore || { overall_score: Number(p.baseline) || 5, constitution_compliance: 10 };
  const proposal = p.proposal || adaptationOrgan.adapt({ plan: { keyDirectives: ['Verify invariant'] } });
  const result = verificationOrgan.verify({
    proposal,
    baselineScore: baseline,
    simulatedCandidateScore: p.candidateScore,
  });
  return { success: result.approvedForPromotion, action, verification: result };
}

export async function executeSelfHealingOrgan(action:string,payload:unknown){
  const p=object(payload);
  const source = text(p.source || 'runtime');
  const errorMsg = text(p.error || p.message || 'Detected runtime anomaly');
  const report = await selfHealingPipeline.runHealingCycle(source, errorMsg);
  return { success: report.deployed, action, report };
}

export async function executeReflectionOrgan(action:string,payload:unknown){
  if(!['reflect','review','execute','retrospect','metacognitive_review'].includes(action))throw new Error(`Unsupported reflection action: ${action}`);
  const p=object(payload);const task=text(p.task||p.problem).trim();const candidate=text(p.output??p.candidate).trim();
  if(!task&&!candidate)throw new Error('Reflection requires task or output');

  if(action==='retrospect'||action==='metacognitive_review'){
    const { runMetacognitiveReasoning } = await import('../../orchestration/metacognitiveReasoning');
    const analysis = await runMetacognitiveReasoning({
      problem: task || candidate,
      inceptionPrompt: text(p.inception_prompt || p.inceptionPrompt || task).trim() || undefined,
      intendedOutcome: text(p.intended_outcome || p.intendedOutcome).trim() || undefined,
      observedOutcome: text(p.observed_outcome || p.observedOutcome || candidate).trim() || undefined,
      evidence: Array.isArray(p.evidence) ? p.evidence.map(text).filter(Boolean) : undefined,
      constraints: Array.isArray(p.constraints) ? p.constraints.map(text).filter(Boolean) : undefined,
      useLlm: Boolean(p.use_llm ?? p.useLlm),
      tenantId: text(p.tenant_id || 'default'),
    });
    return {
      success: true,
      action,
      reasoningMode: analysis.reasoningMode,
      retrospection: analysis.retrospection,
      perspectives: analysis.perspectives,
      uncertainty: analysis.uncertainty,
      executiveSynthesis: analysis.executiveSynthesis,
    };
  }

  const res=await completeTextWithFallback([
    {role:'system',content:'Review the supplied task/output as an unbiased engineering and multi-stakeholder critic. Identify concrete assumptions, missing evidence, contradictions, failure modes, cognitive/framing biases, and the single highest-value correction. Do not claim execution you cannot verify. Return concise JSON with keys assumptions, missingEvidence, contradictions, failureModes, biasNotes, correction.'},
    {role:'user',content:JSON.stringify({task,candidate,evidence:p.evidence??null})},
  ],Math.max(256,Math.min(1800,Number(p.max_tokens)||900)),0.1);
  return{success:true,provider:res.provider,model:res.model,reflection:res.content,tokensUsed:res.tokensUsed};
}

export async function executeUncertaintyOrgan(action:string,payload:unknown){
  if(!['score','evaluate','execute'].includes(action))throw new Error(`Unsupported uncertainty action: ${action}`);
  const p=object(payload);const candidate=text(p.output??p.candidate??p.text);
  if(!candidate.trim())throw new Error('Uncertainty scoring requires output/candidate/text');
  const evidenceCount=Array.isArray(p.evidence)?p.evidence.length:Number(p.evidenceCount)||0;
  const hedges=(candidate.match(/\b(maybe|might|could|possibly|uncertain|unknown|likely|appears|seems)\b/gi)||[]).length;
  const absolutes=(candidate.match(/\b(always|never|guaranteed|certainly|definitely|100%)\b/gi)||[]).length;
  const evidencePenalty=evidenceCount===0?.35:Math.max(0,.2-Math.min(.2,evidenceCount*.04));
  const linguistic=Math.min(.35,hedges*.025+absolutes*.035);
  const uncertainty=Math.max(0,Math.min(1,evidencePenalty+linguistic));
  return{success:true,uncertainty,confidence:1-uncertainty,signals:{hedges,absolutes,evidenceCount},method:'deterministic_evidence_and_language_signals'};
}

export async function executePolicyOrgan(action:string,payload:unknown){
  const p=object(payload);
  const agent=text(p.agentKey||p.agent||'cognitive_assurance');
  const requested=text(p.actionName||p.requestedAction||p.task||action);
  const decision=await governanceEngine.evaluateAction(agent,requested,p.details??p);
  return{success:decision.decision==='ALLOW',decision};
}

export async function executeParagonOrgan(action:string,payload:unknown){
  const p=object(payload);const organs=initOrgans();
  const result=organs.paragon.dissect(text(p.actionType||p.task||action),p.payload??p);
  return{success:result.violatedRules.length===0,phase:'pre_execution_review',result};
}
