import {mapTelemetry} from './TelemetrySync';
import {unit,type HIOInput,type AvatarState} from '../types';
/** Missing cognition stays unknown. Cosmetic confidence never asserts correctness. */
export function computeAvatar(input:HIOInput):AvatarState {
 const c=input.cognition||{},t=input.telemetry||{},m=mapTelemetry(t);
 const mode=input.error||m.critical?'error':input.speaking||input.audio?.speaking?'speaking':input.listening?'listening':c.reflectionState==='thinking'||c.reflectionState==='revising'||m.cognitionStall?'thinking':'idle';
 return {mode,expression:input.emotion?.dominantTag||(mode==='thinking'?'focused':'neutral'),confidence:c.confidence===undefined?null:unit(c.confidence),uncertainty:c.uncertainty===undefined?null:unit(c.uncertainty),policyMode:c.policyMode||'unknown',blendshapes:{},headPose:{pitch:(input.pitch||0)+m.pitch,yaw:input.yaw||0,roll:unit(c.uncertainty)*.035+m.roll},blink:0,flicker:Math.min(.045,m.flicker*.1+unit(c.uncertainty)*.02),noise:Math.min(.06,m.noise*.2),distortion:Math.min(.012,m.distortion*.015),alpha:m.alpha,glow:m.glow,bootProgress:unit(input.bootProgress,1),sync:mode==='speaking'?'speaking-state':'idle'};
}
