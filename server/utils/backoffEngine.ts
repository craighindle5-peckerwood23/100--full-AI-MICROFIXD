import {randomInt} from 'node:crypto';

export interface JitterConfig {baseDelayMs:number; maxDelayMs:number; attempt:number;}
export class BackoffEngine {
  static calculateJitter({baseDelayMs,maxDelayMs,attempt}:JitterConfig):number {
    if (![baseDelayMs,maxDelayMs,attempt].every(Number.isSafeInteger) || baseDelayMs<0 || maxDelayMs<0 || attempt<0 || maxDelayMs<baseDelayMs) throw new RangeError('Invalid jitter configuration');
    if (maxDelayMs===0) return 0;
    const cap=Math.min(maxDelayMs,baseDelayMs*2**Math.min(attempt,30));
    return cap>0?randomInt(Math.floor(cap)+1):0;
  }
  static async executeWait(config:JitterConfig,signal?:AbortSignal):Promise<void> {
    const ms=this.calculateJitter(config);
    if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
      const abort=()=>{clearTimeout(timer);reject(signal?.reason ?? new Error('Aborted'));};
      signal?.addEventListener('abort',abort,{once:true});
    });
  }
}
