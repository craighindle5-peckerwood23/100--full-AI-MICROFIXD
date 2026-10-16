import type {TelemetryEvent} from '../../integration/ShellAPI';
import type {HIOInput} from '../types';
/** Adapt real Microfixd bus names; never synthesize confidence from connectivity. */
export function hostSignals(e:TelemetryEvent,previous:HIOInput={}):HIOInput{
 const next={...previous},d=e.data||{};
 if(e.type==='assurance:complete')next.cognition={...next.cognition,confidence:typeof d.confidence==='number'?d.confidence:undefined,uncertainty:typeof d.uncertainty==='number'?d.uncertainty:undefined,reflectionState:'idle'};
 if(e.type==='command:started'||e.type==='command.submitted')next.cognition={...next.cognition,confidence:undefined,uncertainty:undefined,reflectionState:'thinking'};
 if(e.type==='command:routed')next.cognition={...next.cognition,intent:typeof d.intent==='string'?d.intent:undefined};
 if(['command:complete','command.completed','command:error','command.error'].includes(e.type))next.cognition={...next.cognition,reflectionState:'idle'};
 if(e.type==='governance:blocked'||e.type==='security:blocked')next.cognition={...next.cognition,policyMode:'safe',reflectionState:'deferring'};
 if(e.type==='hitl:review_required')next.cognition={...next.cognition,policyMode:'defer',reflectionState:'deferring'};
 if(['execution:task_done','organ:exec_result','tool:called'].includes(e.type)&&typeof d.latency_ms==='number')next.telemetry={...next.telemetry,latencyMs:d.latency_ms};
 if(e.type==='connection.closed')next.telemetry={environment:'offline-mode'};
 if(e.type==='connection.open')next.telemetry={};
 if(e.type==='hio.cognition')next.cognition=d;
 if(e.type==='hio.telemetry')next.telemetry=d;
 if(e.type==='hio.emotion')next.emotion=d;
 if(e.type==='hio.audio')next.audio=d as unknown as HIOInput['audio'];
 return next;
}
