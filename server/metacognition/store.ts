import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {MetacognitiveSupervisor, type SupervisorStore} from './supervisor';
import {orchestrationOversight} from '../orchestration/orchestrationOversight';

export function metacognitiveClient(): SupabaseClient {
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error('METACOGNITIVE_STORAGE_NOT_CONFIGURED');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(8000)])})}});
}
export function supervisorStore(client: SupabaseClient): SupervisorStore {
  return {
    async append(event){const {error}=await client.from('metacognitive_events').insert(event);if(error)throw new Error('METACOGNITIVE_TELEMETRY_UNAVAILABLE');},
    async halted(tenant){const {data,error}=await client.from('metacognitive_controls').select('halted').eq('tenant_id',tenant).maybeSingle();if(error)throw new Error('METACOGNITIVE_CONTROL_UNAVAILABLE');return data?.halted===true;},
  };
}
export function createSupervisor(client: SupabaseClient,tenant:string): MetacognitiveSupervisor {
  return new MetacognitiveSupervisor(tenant,supervisorStore(client),()=>orchestrationOversight.getInvariants().emergencyKillEngaged);
}
