import {createHash} from 'node:crypto';
export interface CanaryPolicy {percentage:number;minimum_samples:number;maximum_error_rate:number;timeout_ms:number}
export class CanaryRouter {
 private samples=0;private failures=0;private disabled=false;private inFlight=0;
 constructor(private policy:CanaryPolicy){if(!Number.isFinite(policy.percentage)||policy.percentage<0||policy.percentage>100||!Number.isInteger(policy.minimum_samples)||policy.minimum_samples<1||!Number.isFinite(policy.maximum_error_rate)||policy.maximum_error_rate<0||policy.maximum_error_rate>1||!Number.isInteger(policy.timeout_ms)||policy.timeout_ms<1||policy.timeout_ms>30000)throw Error('INVALID_CANARY_POLICY');}
 snapshot(){return {samples:this.samples,failures:this.failures,in_flight:this.inFlight,disabled:this.disabled,percentage:this.policy.percentage,scope:'process; read-only probes only'};}
 async execute<T>(key:string,stable:()=>Promise<T>,candidate:()=>Promise<T>,validate:(v:T)=>boolean):Promise<{value:T;lane:'stable'|'canary'|'fallback'}>{
 const bucket=createHash('sha256').update(key).digest().readUInt32BE(0)%10000;
 if(this.disabled||bucket>=this.policy.percentage*100)return {value:await stable(),lane:'stable'};
 this.inFlight++;let timer:ReturnType<typeof setTimeout>|undefined;
 try{
 const value=await Promise.race([candidate(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('CANARY_TIMEOUT')),this.policy.timeout_ms);})]);
 if(!validate(value))throw Error('INVALID_CANARY_OUTPUT');this.samples++;
 if(this.samples>=this.policy.minimum_samples&&this.failures/this.samples>this.policy.maximum_error_rate)this.disabled=true;
 return {value,lane:'canary'};
 }catch{this.samples++;this.failures++;if(this.samples>=this.policy.minimum_samples&&this.failures/this.samples>this.policy.maximum_error_rate)this.disabled=true;return {value:await stable(),lane:'fallback'};
 }finally{if(timer)clearTimeout(timer);this.inFlight--;}
 }
}
