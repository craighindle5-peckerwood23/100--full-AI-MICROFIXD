import {createClient,type SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|undefined;
export function database():SupabaseClient {
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error('AUTOMOTIVE_DATABASE_UNCONFIGURED');
  if(new URL(url).protocol!=='https:')throw new Error('INVALID_DATABASE_URL');
  return client??=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
}
