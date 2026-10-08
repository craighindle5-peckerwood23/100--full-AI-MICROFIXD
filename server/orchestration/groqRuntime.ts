import Groq from 'groq-sdk';
let cached:{key:string;client:Groq}|undefined;
export function groqConfiguration(){
  const serverKey=process.env.GROQ_API_KEY?.trim();
  const legacyKey=process.env.VITE_GROQ_API_KEY?.trim();
  return {configured:Boolean(serverKey||legacyKey),model:process.env.GROQ_MODEL?.trim()||'qwen/qwen3.8-27b',credential_source:serverKey?'server':legacyKey?'legacy_server_env':'missing',
    fallback_configured:Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || (process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ACCOUNT_ID?.trim())),
    fallback_providers:{gemini:Boolean(process.env.GEMINI_API_KEY?.trim()),openrouter:Boolean(process.env.OPENROUTER_API_KEY?.trim()),cloudflare:Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ACCOUNT_ID?.trim())},
    fallback_model:process.env.GEMINI_MODEL?.trim()||'gemini-2.5-flash'};
}
export function getGroqClient():Groq|null {
  const key=process.env.GROQ_API_KEY?.trim()||process.env.VITE_GROQ_API_KEY?.trim();
  if(!key)return null;
  if(cached?.key!==key)cached={key,client:new Groq({apiKey:key,maxRetries:0,timeout:120000})};
  return cached.client;
}
