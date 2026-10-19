import {embed} from '../driveiq/embedder';
import {randomUUID} from 'node:crypto';
import {createCaseSchema,type DiagnosticCase,type Vehicle} from '../schemas';
import type {AutomotiveRepository} from '../database/repository';
import {retrieve} from '../driveiq/retriever';
import {generateHypotheses} from '../torquelogic/hypothesisGenerator';
import {safetyAlerts} from '../redline/safetyEngine';
import {recordEvent} from '../blackbox/eventStore';
export async function createCase(repo:AutomotiveRepository,input:unknown,actor:string){
  const p=createCaseSchema.parse(input),vehicle=await repo.get<Vehicle>('vehicle',p.vehicleId);
  const hypotheses=generateHypotheses(retrieve(await repo.knowledge(vehicle,await embed(p.complaint+" "+p.dtcs.join(" "))),vehicle,p.dtcs,p.complaint));
  const c:DiagnosticCase={id:randomUUID(),vehicle,complaint:p.complaint,dtcs:p.dtcs,hazards:p.hazards,
    state:hypotheses.length?'testing':'needs_evidence',revision:0,hypotheses,alerts:safetyAlerts(p.complaint,p.hazards),events:[]};
  recordEvent(c,'created',actor,{complaint:c.complaint,dtcs:c.dtcs,evidenceIds:hypotheses.map(h=>h.evidence.id)});
  await repo.insert('case',c);return c;
}
export async function refreshEvidence(repo:AutomotiveRepository,c:DiagnosticCase,actor:string){
  if(c.state!=='needs_evidence')throw new Error('EVIDENCE_REFRESH_ONLY_FOR_EMPTY_CASE');
  c=structuredClone(c);
  c.hypotheses=generateHypotheses(retrieve(await repo.knowledge(c.vehicle,await embed(c.complaint+" "+c.dtcs.join(" "))),c.vehicle,c.dtcs,c.complaint));
  c.state=c.hypotheses.length?'testing':'needs_evidence';
  recordEvent(c,'evidence_refreshed',actor,{evidenceIds:c.hypotheses.map(h=>h.evidence.id)});
  c.revision++;return repo.save(c,c.revision-1);
}
