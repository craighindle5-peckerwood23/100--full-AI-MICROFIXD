/** Core memory uses the same durable server API as chat and organ execution. */
import { api } from '../../../src/lib/serverApi';
type Transport=(action:string,payload:unknown)=>Promise<any>;
let transport:Transport=async(action,payload)=>{
  if(typeof window==='undefined')throw new Error('Server memory transport is not initialized');
  const response=await api<any>('POST','/organs/memory/execute',{action,payload});
  return response.result;
};
export function configureMemoryTransport(value:Transport):void {transport=value;}
export class MemoryOrgan {
  private pending=new Set<Promise<unknown>>();
  private failures:unknown[]=[];
  remember(key:string,value:string,metadata?:any):Promise<void>{
    const write=transport('store',{content:value,organ:'core',tags:[key],session_id:metadata?.session_id || 'core',metadata:{...metadata,key}}).then(()=>{});
    this.pending.add(write);
    // Callers that schedule background events may not await. Keep failures observable via flush.
    void write.then(()=>this.pending.delete(write),err=>{this.pending.delete(write);this.failures.push(err);if(this.failures.length>100)this.failures.shift();console.error('[core memory] persistence failed',String(err));});
    return write;
  }
  async flush():Promise<void>{
    await Promise.allSettled([...this.pending]);
    if(this.failures.length){const failure=this.failures.shift();throw failure;}
  }
  async retrieveContext():Promise<string>{
    await this.flush();const result=await transport('recent',{session_id:'core',limit:5});
    return result.memories.map((m:any)=>m.content).join('\n');
  }
  async search(query:string):Promise<Array<{id:string;content:string}>>{
    await this.flush();const result=await transport('search',{query,session_id:'core'});return result.memories;
  }
}
