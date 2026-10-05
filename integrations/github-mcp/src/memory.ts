import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {Config} from './config.js';
export class Memory {
 readonly db?:SupabaseClient;
 constructor(readonly cfg:Config,db?:SupabaseClient){this.db=db||(cfg.supabaseUrl&&cfg.supabaseKey?createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false}}):undefined);}
 private client(){if(!this.db)throw new Error('Durable Supabase memory is not configured');return this.db;}
 scope(repo:string){return {tenant:this.cfg.tenant,repository:repo};}
 async read(table:string,repo:string,session?:string){let q=this.client().from(table).select('*').eq('tenant',this.cfg.tenant).eq('repository',repo);if(session)q=q.eq('session_id',session);const {data,error}=await q.limit(100);if(error)throw new Error(error.message);return data;}
 async remember(repo:string,session:string,kind:string,content:string){const {data,error}=await this.client().from('agent_memory').insert({...this.scope(repo),session_id:session,agent_id:this.cfg.agent,kind,content}).select().single();if(error)throw new Error(error.message);return data;}
 async task(repo:string,session:string,title:string){const {data,error}=await this.client().from('agent_tasks').insert({...this.scope(repo),session_id:session,agent_id:this.cfg.agent,title,status:'pending'}).select().single();if(error)throw new Error(error.message);return data;}
 async updateTask(repo:string,id:string,status:string,version:number){const {data,error}=await this.client().rpc('mcp_update_task',{p_tenant:this.cfg.tenant,p_repository:repo,p_id:id,p_agent:this.cfg.agent,p_status:status,p_version:version});if(error)throw new Error(error.message);return data;}
 async session(repo:string,id:string,state:unknown,version:number){const {data,error}=await this.client().rpc('mcp_update_session',{p_tenant:this.cfg.tenant,p_repository:repo,p_session:id,p_agent:this.cfg.agent,p_state:state,p_version:version});if(error)throw new Error(error.message);return data;}
 async architecture(repo:string,commit?:string){let q=this.client().from('architecture_memory').select('*').eq('tenant',this.cfg.tenant).eq('repository',repo);if(commit)q=q.eq('commit_sha',commit);const {data,error}=await q.order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw new Error(error.message);if(!data)throw new Error('No completed architecture index; run reindex_repository');return data;}
 async publish(repo:string,commit:string,graph:unknown){const {data,error}=await this.client().from('architecture_memory').upsert({...this.scope(repo),commit_sha:commit,graph},{onConflict:'tenant,repository,commit_sha'}).select().single();if(error)throw new Error(error.message);return data;}
 async chunks(repo:string,commit:string,rows:unknown[]){const {error}=await this.client().from('repository_code_chunks').upsert(rows,{onConflict:'tenant,repository,commit_sha,path,chunk_index'});if(error)throw new Error(error.message);}
 async search(repo:string,commit:string,vector:number[],limit:number){const {data,error}=await this.client().rpc('mcp_search_code',{p_tenant:this.cfg.tenant,p_repository:repo,p_commit:commit,p_embedding:vector,p_limit:limit});if(error)throw new Error(error.message);return data;}
 async health(repo:string){await this.read('session_state',repo);return true;}
}
export async function embed(text:string,key?:string):Promise<number[]> {
 if(!key)throw new Error('OPENAI_API_KEY required for semantic vector search');
 const response=await fetch('https://api.openai.com/v1/embeddings',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'text-embedding-3-small',dimensions:1536,input:text}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Embedding provider returned HTTP ${response.status}`);
 const result=await response.json() as {data?:{embedding:number[]}[]};const vector=result.data?.[0]?.embedding;
 if(!vector||vector.length!==1536||vector.some(x=>!Number.isFinite(x)))throw new Error('Invalid embedding response');return vector;
}
