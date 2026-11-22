import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { retrieve } from './driveiq/retriever';
import { generateHypotheses } from './torquelogic/hypothesisGenerator';
import { safetyAlerts } from './redline/safetyEngine';
import { knowledgeSchema, type Knowledge } from './schemas';

const id = z.string().uuid();
const evidence = z.object({
  id, type: z.string().max(40), title: z.string().max(500),
  dtc: z.string().max(16).nullable(), source_id: id,
  knowledge: knowledgeSchema.nullable(),
}).strict();
const learningReference=z.object({
 unitId:id,tenantId:id,caseId:id,version:z.number().int().positive(),generation:z.number().int().positive(),parentUnitIds:z.array(id).max(50),approvedBy:id,verificationId:id,evaluationVersion:z.string().min(1).max(100),
 vehicle:z.object({year:z.number().int().nullable(),make:z.string().nullable(),model:z.string().nullable(),engine:z.string().nullable()}).strict(),dtcs:z.array(z.string().max(16)).max(100),rootCause:z.string().min(1).max(8000),
}).strict();
const snapshot = z.object({
  schema_version: z.literal('1'), pipeline_version: z.literal('vector-case-1'),
  organization_id: id, case_id: id, run_id: id, revision: z.number().int().positive(),
  vehicle: z.object({ year: z.number().int().nullable(), make: z.string().nullable(), model: z.string().nullable(), engine: z.string().nullable() }).strict(),
  complaint: z.string().max(8000), safety_class: z.enum(['standard','elevated','safety_critical']),
  evidence: z.array(evidence).max(500),
  learning_context:z.array(learningReference).max(50).default([]),
  open_contradictions: z.array(id).max(500), completed_test_refs: z.array(id).max(500),
}).strict();

export function analyzeVectorCase(input: unknown) {
  const s = snapshot.parse(input);
  if(s.learning_context.some(unit=>unit.tenantId!==s.organization_id||unit.caseId===s.case_id))throw new Error('Learning tenant/case scope mismatch');
  if (new Set(s.evidence.map(e=>e.id)).size !== s.evidence.length) throw new Error('Duplicate evidence ID');
  const flags = safetyAlerts(s.complaint, s.safety_class === 'standard' ? [] : [s.safety_class]);
  const vehicle = s.vehicle;
  const records = s.evidence.flatMap(e => e.knowledge ? [{ ...e.knowledge, id: e.id }] : []);
  const codes = s.evidence.flatMap(e => e.dtc ? [e.dtc] : []);
  const applicable = vehicle.year && vehicle.make && vehicle.model && vehicle.engine
    ? retrieve(records,{id:s.case_id,year:vehicle.year,make:vehicle.make,model:vehicle.model,engine:vehicle.engine},codes,s.complaint) : [];
  // Return references to reviewed source procedures. Vector displays the original procedure.
  const support = new Map<string,string[]>();
  const completed = new Set(s.completed_test_refs);
  const eligible = applicable.filter(record => {
    if (record.test.risk !== 'routine' || completed.has(record.id)) return false;
    const refs = s.evidence.filter(item => item.dtc && record.dtcs.includes(item.dtc)).map(item => item.id);
    if (!refs.length) return false;
    support.set(record.id, refs);
    return true;
  });
  const score = (record: Knowledge) => support.get(record.id)!.length / record.test.minutes;
  // Historical experience can break equal evidence/time scores; it cannot add a
  // procedure, alter applicability, set a mechanical limit, or verify a diagnosis.
  const learned=(record:Knowledge)=>s.learning_context.filter(unit=>unit.vehicle.year===vehicle.year&&unit.vehicle.make?.toLowerCase()===vehicle.make?.toLowerCase()&&unit.vehicle.model?.toLowerCase()===vehicle.model?.toLowerCase()&&unit.vehicle.engine?.toLowerCase()===vehicle.engine?.toLowerCase()&&unit.rootCause.toLowerCase()===record.cause.toLowerCase()&&unit.dtcs.some(code=>codes.includes(code)&&record.dtcs.includes(code))).length;
  eligible.sort((a,b) => score(b) - score(a) || learned(b)-learned(a) || a.id.localeCompare(b.id));
  const proposals = generateHypotheses(eligible).map(({evidence}) => ({
    reference_id: evidence.id, supporting_evidence: support.get(evidence.id)!, grade: 'plausible' as const,
  }));
  const reason = flags.length ? 'Safety review required' : s.open_contradictions.length ? 'Resolve open contradictions'
    : !proposals.length ? 'No uncompleted, applicable routine test with matching observed evidence' : null;
  return {schema_version:s.schema_version,pipeline_version:s.pipeline_version,engine_version:'microfixd-automotive-1',
    organization_id:s.organization_id,case_id:s.case_id,run_id:s.run_id,revision:s.revision,
    abstain:reason!==null,abstain_reason:reason,safety_flags:flags,proposals:reason?[]:proposals};
}

export function vectorCaseGateway(secret = process.env.VECTOR_CASE_GATEWAY_TOKEN) {
  const router=Router();
  router.post('/analyze-case',(req,res)=>{
    res.set('Cache-Control','no-store');
    res.set('X-Vector-Model-Version','microfixd-case-ranking-1.1.0');
    if (!secret || secret.length<32) { res.status(503).json({code:'GATEWAY_UNCONFIGURED'}); return; }
    const hash=(s:string)=>createHash('sha256').update(s).digest();
    if (!timingSafeEqual(hash(req.get('authorization')??''),hash('Bearer '+secret))) { res.status(401).json({code:'GATEWAY_AUTH_REQUIRED'}); return; }
    try {
      if(req.get('x-vector-model-version')&&req.get('x-vector-model-version')!=='microfixd-case-ranking-1.1.0'){res.status(409).json({code:'MODEL_VERSION_MISMATCH'});return;}
      const correlation=z.object({traceId:id.optional(),workflowInstanceId:id.optional(),reasoningRunId:id.optional()}).parse({traceId:req.get('x-trace-id'),workflowInstanceId:req.get('x-workflow-instance-id'),reasoningRunId:req.get('x-reasoning-run-id')});
      if(correlation.reasoningRunId&&correlation.reasoningRunId!==snapshot.parse(req.body).run_id)throw new Error('Run correlation mismatch');
      if(correlation.traceId)res.set('X-Trace-ID',correlation.traceId);
      if(correlation.workflowInstanceId)res.set('X-Workflow-Instance-ID',correlation.workflowInstanceId);
      const capability=req.get('x-vector-capability')??'diagnostic';
      const output=analyzeVectorCase(req.body);
      if(capability==='policy'){res.json({run_id:output.run_id,flags:output.safety_flags});return;}
      if(capability==='challenge'){
        const input=snapshot.parse(req.body);
        const evidenceById = new Map(input.evidence.map(item => [item.id,item]));
        const causeByCode = new Map<string,string>();
        const competing = output.proposals.some(proposal => {
          const cause = evidenceById.get(proposal.reference_id)?.knowledge?.cause.toLowerCase();
          if (!cause) return false;
          return proposal.supporting_evidence.some(id => {
            const code = evidenceById.get(id)?.dtc;
            if (!code) return false;
            const previous = causeByCode.get(code);
            if (previous && previous !== cause) return true;
            causeByCode.set(code,cause);
            return false;
          });
        });
        const reasons=input.open_contradictions.map(id=>'Open contradiction '+id);
        if(competing) reasons.push('Several applicable source procedures explain the same observed codes. Compare competing causes before selecting a test.');
        res.json({run_id:output.run_id,reasons});return;
      }
      if(capability!=='diagnostic'){res.status(422).json({code:'UNKNOWN_CAPABILITY'});return;}
      res.json(output);
    }
    catch { res.status(422).json({code:'INVALID_VECTOR_SNAPSHOT'}); }
  });
  return router;
}
