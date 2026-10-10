import { GoogleGenAI } from '@google/genai';
import type Groq from 'groq-sdk';
import { getGroqClient, groqConfiguration } from './groqRuntime';
import { executeGroqWithRetry } from './groqRetry';

export interface TextResult {
  content: string;
  model: string;
  provider: 'groq' | 'gemini' | 'openrouter' | 'cloudflare';
  tokensUsed: number;
  truncated: boolean;
}

export function textProvidersConfigured(): boolean {
  return Boolean(getGroqClient() || process.env.GEMINI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim()
    || (process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ACCOUNT_ID?.trim()));
}

export async function completeTextWithFallback(
  messages: Groq.Chat.ChatCompletionMessageParam[],
  maxTokens: number,
  temperature = 0.3,
  preferredProvider?: TextResult['provider'],
  options?: {beforeAttempt?: (provider: TextResult['provider']) => Promise<void>},
): Promise<TextResult> {
  const failures: string[] = [];
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey && (!preferredProvider || preferredProvider === 'openrouter')) {
    await options?.beforeAttempt?.('openrouter');
    try {
    // openrouter/free only selects zero-priced models. A different model is
    // deliberately not configurable here, so this path cannot spend credits.
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${openRouterKey}`},
      body:JSON.stringify({model:'openrouter/free',messages,max_tokens:maxTokens,temperature}),
      signal:AbortSignal.timeout(120000),
    });
    const data = await response.json() as any;
    if (!response.ok || data.error) throw new Error(`HTTP ${response.status}: ${String(data.error?.message || 'OpenRouter rejected the request').slice(0,500)}`);
    const choice = data.choices?.[0];
    const content = choice?.message?.content || '';
    if (!content.trim() || choice.finish_reason === 'length') throw new Error('OpenRouter returned an empty or truncated answer');
    return {content,model:data.model || 'openrouter/free',provider:'openrouter',tokensUsed:data.usage?.total_tokens || 0,truncated:false};
  } catch (error) { failures.push(`OpenRouter: ${String(error).slice(0,160)}`); }
  }


  const groq = !preferredProvider || preferredProvider === 'groq' ? getGroqClient() : null;
  let groqError: unknown;
  if (groq) {
    await options?.beforeAttempt?.('groq');
    try {
      const result = await executeGroqWithRetry(groq, {
        model: groqConfiguration().model, messages, max_tokens: maxTokens, temperature,
      }, {maxRetries: options?.beforeAttempt ? 1 : 3});
      return {content: result.content, model: result.modelUsed, provider: 'groq',
        tokensUsed: result.completion.usage?.total_tokens || 0,
        truncated: result.completion.choices[0]?.finish_reason === 'length'};
    } catch (error) {
      groqError = error;
      // Invalid credentials and malformed requests require an explicit fix.
      if (![413, 429, 503, 500, 502, 504].includes(Number((error as any)?.status))) throw error;
    }
  }

  const prompt = messages.map(message => `${message.role.toUpperCase()}: ${typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}`).join('\n\n');
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && (!preferredProvider || preferredProvider === 'gemini')) {
    await options?.beforeAttempt?.('gemini');
    try {
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
    const response = await new GoogleGenAI({apiKey: geminiKey}).models.generateContent({model,contents:prompt,
      config:{maxOutputTokens:maxTokens,temperature,...(options?.beforeAttempt&&model==='gemini-2.5-flash'?{thinkingConfig:{thinkingBudget:0}}:{})}});
    const content = response.text || '';
    const truncated = response.candidates?.[0]?.finishReason === 'MAX_TOKENS';
    if (!content.trim() || truncated) throw new Error('Gemini returned an empty or truncated answer');
    return {content,model,provider:'gemini',tokensUsed:response.usageMetadata?.totalTokenCount || 0,truncated:false};
  } catch (error) { failures.push(`Gemini: ${String(error).slice(0,160)}`); }
  }

  const cfToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (cfToken && cfAccount && (!preferredProvider || preferredProvider === 'cloudflare')) {
    await options?.beforeAttempt?.('cloudflare');
    try {
    const model = '@cf/meta/llama-3.1-8b-instruct-fp8';
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfAccount)}/ai/run/${model}`,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${cfToken}`},
      body:JSON.stringify({messages:messages.map(m=>({role:m.role,content:typeof m.content==='string'?m.content:JSON.stringify(m.content)})),max_tokens:maxTokens}),
      signal:AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as any;
    const content = data.result?.response || '';
    if (!data.success || !content.trim()) throw new Error('Cloudflare returned no answer');
    return {content,model,provider:'cloudflare',tokensUsed:0,truncated:false};
  } catch (error) { failures.push(`Cloudflare: ${String(error).slice(0,160)}`); }
  }

  if (failures.length) throw Object.assign(new Error('All configured providers failed. ' + failures.join('; ') + (groqError ? '; Groq: ' + String((groqError as any)?.message || groqError).slice(0,500) : '')),{code:'PROVIDERS_EXHAUSTED',status:(groqError as any)?.status});
  throw groqError || new Error('No server-side LLM provider configured');
}
