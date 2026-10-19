import type {SupabaseClient} from '@supabase/supabase-js';
import type {OBDSession} from './schema';
export class OBDRepository{
 constructor(private db:SupabaseClient,private tenant:string){if(!tenant)throw new Error('TENANT_REQUIRED');}
 async create(session:OBDSession){const {error}=await this.db.from('automotive_obd_sessions').insert({tenant_id:this.tenant,id:session.id,sequence:session.sequence,data:session});if(error)throw new Error('OBD_WRITE_FAILED');return session;}
 async get(id:string):Promise<OBDSession>{const {data,error}=await this.db.from('automotive_obd_sessions').select('data').eq('tenant_id',this.tenant).eq('id',id).maybeSingle();if(error)throw new Error('OBD_READ_FAILED');if(!data)throw new Error('NOT_FOUND');return data.data;}
 async list():Promise<OBDSession[]>{const {data,error}=await this.db.from('automotive_obd_sessions').select('data').eq('tenant_id',this.tenant).order('created_at',{ascending:false}).limit(30);if(error)throw new Error('OBD_READ_FAILED');return data.map(r=>r.data);}
 async save(session:OBDSession,sequence:number){const {data,error}=await this.db.from('automotive_obd_sessions').update({sequence:session.sequence,data:session}).eq('tenant_id',this.tenant).eq('id',session.id).eq('sequence',sequence).select('id');if(error)throw new Error('OBD_WRITE_FAILED');if(!data?.length)throw new Error('REVISION_CONFLICT');return session;}
}
