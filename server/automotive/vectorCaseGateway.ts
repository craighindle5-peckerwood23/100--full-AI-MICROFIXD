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
const snapshot = z.object({
  schema_version: z.literal('1'), pipeline_version: z.literal('vector-case-1'),
  organization_id: id, case_id: id, run_id: id, revision: z.number().int().positive(),
  vehicle: z.object({ year: z.number().int().nullable(), make: z.string().nullable(), model: z.string().nullable(), engine: z.string().nullable() }).strict(),
  complaint: z.string().max(8000), safety_class: z.enum(['standard','elevated','safety_critical']),
  evidence: z.array(evidence).max(500),
  open_contradictions: z.array(id).max(500), completed_test_refs: z.array(id).max(500),
}).strict();

export function analyzeVectorCase(input: unknown) {
  const s = snapshot.parse(input);
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
  eligible.sort((a,b) => score(b) - score(a) || a.id.localeCompare(b.id));
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
    if (!secret || secret.length<32) { res.status(503).json({code:'GATEWAY_UNCONFIGURED'}); return; }
    const hash=(s:string)=>createHash('sha256').update(s).digest();
    if (!timingSafeEqual(hash(req.get('authorization')??''),hash('Bearer '+secret))) { res.status(401).json({code:'GATEWAY_AUTH_REQUIRED'}); return; }
    try {
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
