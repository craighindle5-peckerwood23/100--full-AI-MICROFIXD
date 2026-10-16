import {Renderer} from './renderer/Renderer';
import {AnimationEngine} from './animation/AnimationEngine';
import type {HIOInput,HIOStatus,Profile} from './types';
export class HIO {
 private renderer:Renderer;
 private animation=new AnimationEngine();
 private input:HIOInput={};private frame=0;private running=false;private disposed=false;private previous=0;private lastReport=0;private frames=0;private frameTime=0;
 private listeners=new Set<(status:HIOStatus)=>void>();
 private motion=matchMedia('(prefers-reduced-motion: reduce)');
 private status:HIOStatus;
 constructor(container:HTMLElement,config:{modelUrl?:string;profile?:Profile;reducedMotion?:boolean}={}){
  this.renderer=new Renderer(container,config.modelUrl);if(config.profile)this.renderer.setProfile(config.profile);this.reduced=config.reducedMotion;
  this.status={fps:0,frameMs:0,model:'loading',running:false,profile:this.renderer.profile,state:this.animation.update({},0,0,true)};
  document.addEventListener('visibilitychange',this.visibility);
 }
 private reduced?:boolean;
 private visibility=()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.previous=0;}else if(this.running){this.previous=0;this.frame=requestAnimationFrame(this.loop);}};
 ingest(input:HIOInput){this.input={...this.input,...input};}
 ingestCognition(cognition:NonNullable<HIOInput['cognition']>){this.input.cognition={...cognition};}
 ingestTelemetry(telemetry:NonNullable<HIOInput['telemetry']>){this.input.telemetry={...telemetry};}
 ingestEmotion(emotion:NonNullable<HIOInput['emotion']>){this.input.emotion={...emotion};}
 ingestAudio(audio:NonNullable<HIOInput['audio']>){this.input.audio={...audio};}
 setProfile(profile:Profile|'auto'){if(!['auto','minimal','full','diagnostic'].includes(profile))return;this.renderer.setProfile(profile);}
 start(){if(this.running||this.disposed)return;this.running=true;this.previous=0;if(!document.hidden)this.frame=requestAnimationFrame(this.loop);}
 stop(){this.running=false;cancelAnimationFrame(this.frame);this.status={...this.status,running:false};}
 getStatus(){return this.status;}
 onEvent(callback:(status:HIOStatus)=>void){this.listeners.add(callback);return()=>this.listeners.delete(callback);}
 private loop=(now:number)=>{
  if(!this.running||this.disposed)return;
  const dt=this.previous?Math.min((now-this.previous)/1000,.1):0;this.previous=now;
  const start=performance.now(),state=this.animation.update(this.input,dt,now/1000,this.reduced??this.motion.matches);
  this.renderer.select(this.input);this.renderer.update(state,now/1000,this.reduced??this.motion.matches);
  this.frames++;this.frameTime+=performance.now()-start;
  if(now-this.lastReport>=1000){this.status={fps:this.lastReport?Math.round(this.frames*1000/(now-this.lastReport)):0,frameMs:this.frameTime/this.frames,model:this.renderer.model,running:true,profile:this.renderer.profile,state,error:this.renderer.error};this.lastReport=now;this.frames=0;this.frameTime=0;this.listeners.forEach(fn=>fn(this.status));}
  this.frame=requestAnimationFrame(this.loop);
 };
 dispose(){if(this.disposed)return;this.stop();this.disposed=true;document.removeEventListener('visibilitychange',this.visibility);this.listeners.clear();this.renderer.dispose();}
}
