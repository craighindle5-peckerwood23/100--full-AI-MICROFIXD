import type {DiagnosticCase} from '../schemas';
/** Events are committed with the case in one optimistic database update. */
export function recordEvent(c:DiagnosticCase,type:string,actor:string,detail:unknown) {
  if(c.events.length>=1000)throw new Error('CASE_EVENT_LIMIT');
  c.events.push({type,actor,at:new Date().toISOString(),detail});
}
