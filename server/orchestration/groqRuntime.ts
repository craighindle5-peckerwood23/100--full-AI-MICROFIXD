import Groq from 'groq-sdk';
let cached:{key:string;client:Groq}|undefined;
export function groqConfiguration(){
  const serverKey=process.env.GROQ_API_KEY?.trim();
  const legacyKey=process.env.VITE_GROQ_API_KEY?.trim();
  return {configured:Boolean(serverKey||legacyKey),model:process.env.GROQ_MODEL?.trim()||'qwen/qwen3.8-27b',credential_source:serverKey?'server':legacyKey?'legacy_server_env':'missing'};
}
export function getGroqClient():Groq|null {
  const key=process.env.GROQ_API_KEY?.trim()||process.env.VITE_GROQ_API_KEY?.trim();
  if(!key)return null;
  if(cached?.key!==key)cached={key,client:new Groq({apiKey:key,maxRetries:0,timeout:120000})};
  return cached.client;
}
