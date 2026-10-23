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
  return{success:passed===checks.length,score:checks.length?passed/checks.length:1,checks,measured:{characters:candidate.length,lines:candidate.split(/\r?\n/).length}};
}

export async function executeReflectionOrgan(action:string,payload:unknown){
  if(!['reflect','review','execute'].includes(action))throw new Error(`Unsupported reflection action: ${action}`);
  const p=object(payload);const task=text(p.task).trim();const candidate=text(p.output??p.candidate).trim();
  if(!task&&!candidate)throw new Error('Reflection requires task or output');
  const res=await completeTextWithFallback([
    {role:'system',content:'Review the supplied task/output as an engineering critic. Identify concrete assumptions, missing evidence, contradictions, failure modes, and the single highest-value correction. Do not claim execution you cannot verify. Return concise JSON with keys assumptions, missingEvidence, contradictions, failureModes, correction.'},
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
