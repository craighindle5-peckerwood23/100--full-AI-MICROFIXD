import {Annotation,StateGraph,START,END} from '@langchain/langgraph';
import {BaseRetriever} from '@langchain/core/retrievers';
import {Document} from '@langchain/core/documents';
import type {SupabaseClient} from '@supabase/supabase-js';
import {recallKnowledge,type MemoryIdentity} from './knowledgeMemory';
import {packMemoryContext} from './contextWindow';
import {searchTerms,searchVehicleReferences} from '../automotive/sourceReferences';

/** Credentials and identity stay closure-bound, never model-selected graph input. */
class StoredContextRetriever extends BaseRetriever {
  lc_namespace=['microfixd','stored_context'];
  constructor(private db:SupabaseClient,private who:MemoryIdentity){super();}
  async _getRelevantDocuments(query:string):Promise<Document[]> {
    const terms=searchTerms(query);if(!terms.length)return [];
    const batches=await Promise.all([{session_id:this.who.session_id},{scope:'tenant'}].map(async scope=>{
      const {data,error}=await this.db.from('microfixd_memory_records').select('id,tenant_id,content,agent_id,created_at,metadata')
        .eq('tenant_id',this.who.tenant_id).contains('metadata',scope)
        .or(terms.map(term=>`content.ilike.%${term}%`).join(','))
        .order('created_at',{ascending:false}).limit(12);
      if(error)throw new Error('STORED_CONTEXT_READ_FAILED');return data??[];
    }));
    return [...new Map(batches.flat().filter(row=>row.tenant_id===this.who.tenant_id
      &&(row.metadata?.session_id===this.who.session_id||row.metadata?.scope==='tenant')
      &&!['delivery','knowledge','procedure'].includes(row.agent_id)).map(row=>[row.id,row])).values()]
      .map(row=>new Document({id:row.id,pageContent:row.content,metadata:{...row,content:undefined,trust:'historical_record'}}));
  }
}
const State=Annotation.Root({episodes:Annotation<any[]>(),knowledge:Annotation<any[]>(),references:Annotation<any[]>(),referenceStatus:Annotation<string>(),packed:Annotation<ReturnType<typeof packMemoryContext>>()});

/** Read-only graph. Sources are durable; no in-memory checkpoint is advertised as persistence. */
export async function storedContext(db:SupabaseClient,who:MemoryIdentity,episodes:any[],query:string,maxChars:number,extra:any[]=[]) {
  if(!who.tenant_id?.trim()||!who.session_id?.trim()||typeof query!=='string'||query.length>4000)throw new Error('INVALID_CONTEXT_IDENTITY');
  const retriever=new StoredContextRetriever(db,who);
  const graph=new StateGraph(State)
    .addNode('stored_history',async()=>{
      const docs=await retriever.invoke(query);
      const recalled=docs.map(doc=>({...doc.metadata,id:doc.id,content:doc.pageContent}));
      return {episodes:[...new Map([...recalled,...episodes].map(row=>[row.id,row])).values()]};
    })
    .addNode('structured_knowledge',async()=>({knowledge:[...(await recallKnowledge(db,who,query,8)).memories,...extra]}))
    .addNode('vehicle_references',async()=>{
      if(!/\b(vehicle|automotive|recalls|airbag|engine|bmw|ford|chevrolet|chevy|ram|toyota|honda|dtc|obd)\b/i.test(query))return {references:[],referenceStatus:'not_requested'};
      let result:Awaited<ReturnType<typeof searchVehicleReferences>>;
      try{result=await searchVehicleReferences(db,query);}
      catch(error){return {references:[],referenceStatus:error instanceof Error?error.message:'REFERENCE_READ_FAILED'};}
      return {references:result.references.map(row=>{
        const serialized=JSON.stringify(row.payload);
        return {id:`reference:${row.id}`,content:JSON.stringify({source:row.source_url,source_key:row.source_key,
          content_sha256:row.content_sha256,trust:row.trust,excerpt:serialized.slice(0,3500),truncated:serialized.length>3500}),type:'vehicle_reference'};
      }),referenceStatus:'available'};
    })
    .addNode('assemble',async state=>({packed:packMemoryContext(state.episodes,[...state.knowledge,...state.references],maxChars)}))
    .addEdge(START,'stored_history').addEdge('stored_history','structured_knowledge')
    .addEdge('structured_knowledge','vehicle_references').addEdge('vehicle_references','assemble').addEdge('assemble',END).compile();
  const result=await graph.invoke({},{recursionLimit:8});
  const degraded=!['available','not_requested'].includes(result.referenceStatus);
  return {...result.packed,degraded,window:{...result.packed.window,retrieval_engine:'langgraph+langchain',vehicle_reference_status:result.referenceStatus,
    stored_context_records:result.episodes.length,vehicle_reference_records:result.references.length,
    scope:'current_session_and_explicit_tenant_shared'}};
}
