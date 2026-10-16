import {computeAvatar} from '../sync/CognitionSync';
import {mapViseme} from './VisemeMapper';
import type {HIOInput,AvatarState} from '../types';
export class AnimationEngine {
 private jaw=0;
 update(input:HIOInput,dt:number,time:number,reduced:boolean):AvatarState {
  const s=computeAvatar(input),visemes=mapViseme(input.audio);
  // Without timed phonemes, a restrained open-mouth indication, never fake lip sync.
  const target=input.telemetry?.audioDropout?0:visemes?.jawOpen??(s.mode==='speaking'?.13:0);
  if(input.telemetry?.audioDropout)this.jaw=0;
  this.jaw+=(target-this.jaw)*(1-Math.exp(-Math.min(dt,.1)*20));
  s.blendshapes={jawOpen:this.jaw,mouthSmile:s.expression==='engaged'?.18:0,browFurrow:s.expression==='concerned'?.35:0,...visemes};
  s.blendshapes.jawOpen=this.jaw;
  if(visemes)s.sync='viseme';
  if(!reduced){s.headPose.yaw+=Math.sin(time*.32)*.035;s.headPose.pitch+=Math.sin(time*.51)*.014;s.blink=Math.pow(Math.max(0,Math.cos(time*1.31)),80);}
  if(s.mode==='thinking')s.headPose.pitch-=.035;
  if(reduced){s.flicker=0;s.distortion=0;s.noise=0;}
  return s;
 }
}
