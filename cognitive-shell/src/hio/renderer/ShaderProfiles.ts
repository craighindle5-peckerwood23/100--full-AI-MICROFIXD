import type {Cognition,Telemetry,Profile} from '../types';
export type ShaderProfileName=Profile|'degraded'|'error';
export const ShaderProfiles={
 minimal:{flicker:0,noise:0,distortion:0,glow:.3,alpha:.7,color:[0,1,1]},
 full:{flicker:.01,noise:.01,distortion:0,glow:.6,alpha:.85,color:[0,1,1]},
 diagnostic:{flicker:.02,noise:.03,distortion:.002,glow:.4,alpha:.9,color:[1,.2,.2]},
 degraded:{flicker:.03,noise:.04,distortion:.004,glow:.3,alpha:.7,color:[0,.7,.7]},
 error:{flicker:.04,noise:.05,distortion:.008,glow:.25,alpha:.6,color:[1,.05,.08]},
} as const;
export function selectShaderProfile(c:Cognition={},t:Telemetry={},operator?:Profile):ShaderProfileName{
 if(operator)return operator;
 if((t.errorRate??0)>.4||(t.systemLoad??0)>.85)return 'error';
 if(t.environment==='degraded'||t.environment==='offline-mode'||(t.systemLoad??0)>.7||(t.latencyNorm??0)>.6)return 'degraded';
 if(c.reflectionState==='thinking')return 'minimal';
 if(c.policyMode==='strict')return 'diagnostic';
 return 'full';
}
