import type {SupabaseClient} from '@supabase/supabase-js';
import type {DiagnosticCase,Vehicle,Knowledge} from '../schemas';
export class AutomotiveRepository {
  constructor(private db:SupabaseClient,private tenant:string){if(!tenant)throw new Error('TENANT_REQUIRED');}
  async insert(kind:'vehicle'|'case'|'knowledge',data:Vehicle|DiagnosticCase|Knowledge,embedding:number[]|null=null){
    const {error}=await this.db.from('automotive_records').insert({tenant_id:this.tenant,kind,id:data.id,revision:0,data,embedding:embedding?JSON.stringify(embedding):null});
    if(error)throw new Error('AUTOMOTIVE_WRITE_FAILED');return data;
  }
  async get<T>(kind:string,id:string):Promise<T>{
    const {data,error}=await this.db.from('automotive_records').select('data').eq('tenant_id',this.tenant).eq('kind',kind).eq('id',id).maybeSingle();
    if(error)throw new Error('AUTOMOTIVE_READ_FAILED');if(!data)throw new Error('NOT_FOUND');return data.data as T;
  }
  async list<T>(kind:string):Promise<T[]>{
    const {data,error}=await this.db.from('automotive_records').select('data').eq('tenant_id',this.tenant).eq('kind',kind).order('created_at',{ascending:false}).limit(100);
    if(error)throw new Error('AUTOMOTIVE_READ_FAILED');return data.map(r=>r.data as T);
  }
  async knowledge(v:Vehicle,queryVector:number[]|null=null):Promise<Knowledge[]>{
    if(queryVector){
      const {data,error}=await this.db.rpc('automotive_rank_knowledge',{p_tenant:this.tenant,p_make:v.make,p_model:v.model,p_engine:v.engine,p_year:v.year,p_query:JSON.stringify(queryVector)});
      if(error)throw new Error('KNOWLEDGE_VECTOR_READ_FAILED');
      if(data.length===500)throw new Error('KNOWLEDGE_QUERY_TOO_BROAD');
      return data.map((r:{data:Knowledge})=>r.data);
    }
    const {data,error}=await this.db.from('automotive_records').select('data').eq('tenant_id',this.tenant).eq('kind','knowledge')
      .ilike('data->>make',v.make.replace(/[%_\\]/g,'\\$&')).ilike('data->>model',v.model.replace(/[%_\\]/g,'\\$&')).limit(500);
    if(error)throw new Error('KNOWLEDGE_READ_FAILED');
    if(data.length===500)throw new Error('KNOWLEDGE_QUERY_TOO_BROAD');
    return data.map(r=>r.data as Knowledge);
  }
  async save(c:DiagnosticCase,previousRevision:number){
    const {data,error}=await this.db.from('automotive_records').update({data:c,revision:c.revision}).eq('tenant_id',this.tenant).eq('kind','case').eq('id',c.id).eq('revision',previousRevision).select('id');
    if(error)throw new Error('AUTOMOTIVE_WRITE_FAILED');if(!data?.length)throw new Error('REVISION_CONFLICT');return c;
  }
}
