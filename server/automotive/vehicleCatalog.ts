import type {SupabaseClient} from '@supabase/supabase-js';
import {sourceContentHash} from './nhtsa-ingestion';
import {saveNhtsaRecord} from './sourceReferences';

export const CATALOG_SOURCE='nhtsa-vpic-catalog';
export const MAKES_URL='https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json';
export function modelsURL(makeId:number) {
  if(!Number.isSafeInteger(makeId)||makeId<1)throw new Error('INVALID_MAKE_ID');
  return `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/${makeId}?format=json`;
}
async function readResults(url:string,fetcher:typeof fetch) {
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{accept:'application/json'}});
  if(!response.ok)throw new Error(`VPIC_HTTP_${response.status}`);
  const reader=response.body?.getReader();if(!reader)throw new Error('VPIC_INVALID_RESPONSE');
  const chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>4_000_000)throw new Error('VPIC_RESPONSE_TOO_LARGE');chunks.push(value);}}
  finally{await reader.cancel();}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!Array.isArray(body.Results)||body.Results.length>20000||Number(body.Count)!==body.Results.length)throw new Error('VPIC_INVALID_RESPONSE');
  return body.Results as Record<string,unknown>[];
}
function name(value:unknown):string {
  if(typeof value!=='string'||!value.trim()||value.trim().length>300)throw new Error('VPIC_INVALID_NAME');
  return value.trim();
}
async function write(db:SupabaseClient,table:string,rows:Record<string,unknown>[],conflict:string,ignoreDuplicates=false) {
  for(let i=0;i<rows.length;i+=250){
    const {error}=await db.from(table).upsert(rows.slice(i,i+250),{onConflict:conflict,ignoreDuplicates});
    if(error)throw new Error('CATALOG_WRITE_FAILED');
  }
}
/** Re-running refreshes the make index and resumes unfinished model jobs. No invented fitments. */
export async function syncCatalog(db:SupabaseClient,fetcher:typeof fetch=fetch) {
  const results=await readResults(MAKES_URL,fetcher);
  const seen=new Set<number>();
  const makes=results.map(row=>{
    const makeId=Number(row.Make_ID);modelsURL(makeId);
    if(seen.has(makeId))throw new Error('VPIC_DUPLICATE_MAKE');seen.add(makeId);
    return {makeId,makeName:name(row.Make_Name)};
  });
  await write(db,'automotive_sources',[{id:CATALOG_SOURCE,base_url:'https://vpic.nhtsa.dot.gov/api/vehicles/',source_type:'official-api',license_note:'NHTSA vPIC public catalog; model names do not establish year, engine or VIN fitment.'}],'id',true);
  const canonical=[...new Map(makes.map(make=>[make.makeName.toLowerCase(),{name:make.makeName}])).values()];
  await write(db,'vector_makes',canonical,'normalized_name',true);
  await saveNhtsaRecord(db,{sourceId:CATALOG_SOURCE,sourceKey:'all-makes',sourceUrl:MAKES_URL,payload:{Results:results},contentSha256:sourceContentHash({Results:results})});
  await write(db,'automotive_ingestion_jobs',makes.map(make=>({source_id:CATALOG_SOURCE,source_key:JSON.stringify(make),request_url:modelsURL(make.makeId)})),'source_id,source_key',true);
  const {error:refreshError}=await db.from('automotive_ingestion_jobs').update({state:'queued',attempts:0,completed_at:null,next_attempt_at:new Date().toISOString()}).eq('source_id',CATALOG_SOURCE).eq('state','completed').lt('completed_at',new Date(Date.now()-7*86400000).toISOString());
  if(refreshError)throw new Error('CATALOG_REFRESH_FAILED');
  return {providerMakes:makes.length,distinctNames:canonical.length,modelJobsEnsured:makes.length,coverage:'model_names_only',source:MAKES_URL};
}
export async function importModels(db:SupabaseClient,sourceKey:string,requestURL:string,fetcher:typeof fetch=fetch) {
  const input=JSON.parse(sourceKey),makeName=name(input.makeName),url=modelsURL(input.makeId);
  if(url!==requestURL)throw new Error('CATALOG_JOB_URL_MISMATCH');
  const results=await readResults(url,fetcher);
  const names=results.map(row=>{if(Number(row.Make_ID)!==input.makeId||!Number.isSafeInteger(Number(row.Model_ID)))throw new Error('VPIC_MODEL_IDENTITY_MISMATCH');return name(row.Model_Name);});
  const {data:make,error}=await db.from('vector_makes').select('id').eq('normalized_name',makeName.toLowerCase()).single();
  if(error||!make)throw new Error('CATALOG_MAKE_READ_FAILED');
  await write(db,'vector_models',[...new Set(names)].map(model=>({make_id:make.id,name:model})),'make_id,name',true);
  const payload={makeId:input.makeId,makeName,Results:results};
  await saveNhtsaRecord(db,{sourceId:CATALOG_SOURCE,sourceKey:String(input.makeId),sourceUrl:url,payload,contentSha256:sourceContentHash(payload)});
  return {models:new Set(names).size};
}
const escapeLike=(value:string)=>value.replace(/[\\%_]/g,'\\$&');
export async function searchCatalog(db:SupabaseClient,query='',make?:string,offset=0) {
  if(query.length>100||(make!==undefined&&(!make.trim()||make.length>300))||!Number.isInteger(offset)||offset<0||offset>100000)throw new Error('INVALID_CATALOG_QUERY');
  const coverage='Public model names only; years, engines, trims and installed options are not established.';
  if(make){
    const {data:parent,error}=await db.from('vector_makes').select('id,name').eq('normalized_name',make.trim().toLowerCase()).maybeSingle();
    if(error)throw new Error('CATALOG_READ_FAILED');
    if(!parent)return {make:null,models:[],coverage};
    const {data,error:readError}=await db.from('vector_models').select('id,name').eq('make_id',parent.id).ilike('name',`%${escapeLike(query)}%`).order('name').range(offset,offset+99);
    if(readError)throw new Error('CATALOG_READ_FAILED');return {make:parent,models:data,offset,nextOffset:data?.length===100?offset+100:null,coverage};
  }
  const {data,error}=await db.from('vector_makes').select('id,name').ilike('name',`%${escapeLike(query)}%`).order('name').range(offset,offset+99);
  if(error)throw new Error('CATALOG_READ_FAILED');return {makes:data,offset,nextOffset:data?.length===100?offset+100:null,coverage};
}
