import type {z} from 'zod';
import {actionSchema,type DiagnosticCase} from '../schemas';
import {recordEvent} from '../blackbox/eventStore';
export function transition(original:DiagnosticCase,action:z.infer<typeof actionSchema>,actor:string):DiagnosticCase {
  if(original.revision!==action.revision)throw new Error('REVISION_CONFLICT');
  if(original.state==='verified')throw new Error('CASE_ALREADY_VERIFIED');
  if(original.alerts.length)throw new Error('SAFETY_HOLD: specialist assessment required; this MVP cannot clear safety holds');
  const c=structuredClone(original);
  if(action.type==='observe'){
    if(c.state!=='testing')throw new Error('TESTING_REQUIRED');
    const h=c.hypotheses.find(h=>h.id===action.hypothesisId);
    if(!h||h.evidence.test.id!==action.testId)throw new Error('UNKNOWN_TEST');
    if(h.evidence.test.risk==='specialist'&&!action.specialistConfirmed)throw new Error('SPECIALIST_CONFIRMATION_REQUIRED');
    h.observations.push({testId:action.testId,finding:action.finding,assessment:action.assessment,actor,at:new Date().toISOString()});
    // Conflicting observations remain inconclusive until independently reviewed.
    const assessments=new Set(h.observations.map(o=>o.assessment));
    h.status=assessments.has('supports')&&assessments.has('refutes')?'inconclusive':action.assessment==='supports'?'supported':action.assessment==='refutes'?'refuted':'inconclusive';
  }else if(action.type==='repair'){
    if(c.state!=='testing')throw new Error('TESTING_REQUIRED');
    const h=c.hypotheses.find(h=>h.id===action.hypothesisId);
    if(!h||h.status!=='supported')throw new Error('SUPPORTED_HYPOTHESIS_REQUIRED');
    c.repair={hypothesisId:h.id,workPerformed:action.workPerformed,actor,at:new Date().toISOString()};
    c.state='repair_recorded';
  }else{
    if(c.state!=='repair_recorded'||!c.repair)throw new Error('REPAIR_REQUIRED');
    c.state=action.complaintResolved&&action.dtcsAbsent&&action.testPassed?'verified':'testing';
    if(c.state==='testing'){
      const h=c.hypotheses.find(h=>h.id===c.repair!.hypothesisId);
      if(h)h.status='inconclusive';
    }
  }
  recordEvent(c,action.type,actor,action);c.revision++;
  return c;
}
