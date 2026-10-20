import OpenAI from 'openai';
export const EMBEDDING_MODEL='text-embedding-3-small';
export async function embed(text:string):Promise<number[]|null>{
  if(process.env.AUTOMOTIVE_VECTOR_SEARCH!=='true')return null;
  if(!process.env.OPENAI_API_KEY)throw new Error('AUTOMOTIVE_EMBEDDING_KEY_REQUIRED');
  let result;
  try { result=await new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:15000,maxRetries:0}).embeddings.create({model:EMBEDDING_MODEL,input:text.slice(0,12000),dimensions:1536}); } catch { throw new Error('EMBEDDING_PROVIDER_UNAVAILABLE'); }
  const vector=result.data[0]?.embedding;
  if(!vector||vector.length!==1536||vector.some(n=>!Number.isFinite(n)))throw new Error('INVALID_EMBEDDING');
  return vector;
}
