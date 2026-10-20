import type {DiagnosticCase} from '../schemas';
export function selectTest(c:DiagnosticCase) {
  if(c.alerts.length||!['testing'].includes(c.state))return null;
  const hypothesis=c.hypotheses.filter(h=>h.status==='untested'||h.status==='inconclusive')
    .sort((a,b)=>(a.evidence.test.risk==='specialist'?1:0)-(b.evidence.test.risk==='specialist'?1:0)||a.evidence.test.minutes-b.evidence.test.minutes)[0];
  return hypothesis?{hypothesisId:hypothesis.id,...hypothesis.evidence.test}:null;
}
