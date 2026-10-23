import type {SupabaseClient} from '@supabase/supabase-js';
import {fetchNhtsa,sourceContentHash,type IngestionRecord,type NhtsaKind,type VehicleQuery} from './nhtsa-ingestion';

export function searchTerms(query:string):string[] {
  const ignored=new Set(['what','does','about','with','from','this','that','have','please','the','and','for']);
  return [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[])]
    .filter(word=>word.length>2&&!ignored.has(word)).slice(0,6);
}
export async function saveNhtsaRecord(db:SupabaseClient,record:IngestionRecord) {
  const {error}=await db.from('automotive_source_records').upsert({source_id:record.sourceId,source_key:record.sourceKey,
    source_url:record.sourceUrl,payload:record.payload,content_sha256:record.contentSha256,fetched_at:new Date().toISOString()},
    {onConflict:'source_id,source_key'});
  if(error)throw new Error('REFERENCE_STORAGE_FAILED');
}
export async function importVehicleReferences(db:SupabaseClient,kind:NhtsaKind,vehicle:VehicleQuery,fetcher:typeof fetch=fetch) {
  return fetchNhtsa(kind,vehicle,{upsert:record=>saveNhtsaRecord(db,record)},fetcher);
}
/** Public references only: never tenant repair cases or independently verified repairs. */
export async function searchVehicleReferences(db:SupabaseClient,query:string,limit=6) {
  if(typeof query!=='string'||query.length>4000||!Number.isInteger(limit)||limit<1||limit>20)throw new Error('INVALID_REFERENCE_QUERY');
  const terms=searchTerms(query);
  if(!terms.length)return {references:[],authority:'source_reference_only'};
  const fields=['source_url','payload->>Summary','payload->>summary','payload->>Component','payload->>components'];
  const {data,error}=await db.from('automotive_source_records').select('id,source_id,source_key,source_url,payload,content_sha256,fetched_at')
    .in('source_id',['nhtsa-recalls','nhtsa-complaints'])
    .or(terms.flatMap(term=>fields.map(field=>`${field}.ilike.%${term}%`)).join(','))
    .order('fetched_at',{ascending:false}).limit(limit);
  if(error)throw new Error('REFERENCE_READ_FAILED');
  return {references:(data??[]).map(row=>{
    if(sourceContentHash(row.payload)!==row.content_sha256)throw new Error('INVALID_REFERENCE_HASH');
    const source=new URL(row.source_url);
    if(source.origin!=='https://api.nhtsa.gov'||source.username||source.password)throw new Error('INVALID_REFERENCE_SOURCE');
    return {...row,trust:row.source_id==='nhtsa-complaints'?'unverified_consumer_report':'official_recall_record'};
  }),authority:'source_reference_only'};
}
