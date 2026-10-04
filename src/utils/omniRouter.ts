import { runSystemCommand } from '../lib/commandApi';
import { GoogleGenAI } from '@google/genai';
import { logSystemEvent, getSupabase } from '../lib/supabase';
import { voice } from './voice';
import { autonomousCore } from '../autonomy/autonomousCore';

import { fetchGroqWithRetry } from './groqRetry';

export type LLMProviderId = 'gemini' | 'groq' | 'deepseek' | 'synthetic_kernel';

export interface ProviderConfig {
  id: LLMProviderId;
  name: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  status: 'ONLINE' | 'STANDBY' | 'RATE_LIMITED' | 'KEY_MISSING' | 'ERROR';
  latencyMs?: number;
  lastUsed?: string;
  totalTokensProcessed: number;
}

export interface RouterExecutionResult {
  text: string;
  providerUsed: LLMProviderId;
  modelUsed: string;
  latencyMs: number;
  tokensEstimated: number;
  fallbackChain: { provider: LLMProviderId; error?: string; status: 'attempted' | 'success' | 'failed' }[];
  timestamp: string;
}

export interface RouterHistoryItem {
  id: string;
  prompt: string;
  response: string;
  provider: LLMProviderId;
  model: string;
  latencyMs: number;
  fallbackOccurred: boolean;
  timestamp: string;
}

export interface OrchestrationDecision {
  organsUsed?: string[];
  thought: string;
  targetSubsystem: string | null;
  actionName?: string | null;
  speech: string;
  detailedAnswer: string;
  providerUsed: LLMProviderId;
  latencyMs: number;
}

// In-memory & localStorage state
class OmniLLMRouter {
  private providers: Record<LLMProviderId, ProviderConfig> = {
    groq: {
      id: 'groq',
      name: 'Groq Cloud',
      model: 'qwen/qwen3.8-27b',
      apiKey: '',
      enabled: true,
      status: 'STANDBY',
      totalTokensProcessed: 14200
    },
    gemini: {
      id: 'gemini',
      name: 'Google Gemini',
      model: 'gemini-2.5-flash',
      apiKey: '',
      enabled: true,
      status: 'STANDBY',
      totalTokensProcessed: 28400
    },
    deepseek: {
      id: 'deepseek',
      name: 'DeepSeek AI',
      model: 'deepseek-chat',
      apiKey: '',
      enabled: true,
      status: 'STANDBY',
      totalTokensProcessed: 9600
    },
    synthetic_kernel: {
      id: 'synthetic_kernel',
      name: 'Microfyxd Level 6 Cognitive Kernel',
      model: 'microfyxd-l6-autonomous',
      apiKey: 'built-in',
      enabled: true,
      status: 'ONLINE',
      totalTokensProcessed: 98000
    }
  };

  private priorityOrder: LLMProviderId[] = ['groq', 'gemini', 'deepseek', 'synthetic_kernel'];
  private history: RouterHistoryItem[] = [];

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    if (typeof window === 'undefined') return;
    try {
      const savedProviders = localStorage.getItem('microfyxd_omni_providers');
      if (savedProviders) {
        const parsed = JSON.parse(savedProviders);
        Object.keys(parsed).forEach(k => {
          const key = k as LLMProviderId;
          if (this.providers[key]) {
            this.providers[key] = { ...this.providers[key], ...parsed[key] };
          }
        });
      }

      // Check for environment variables
      const envGemini = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
      if (envGemini && !this.providers.gemini.apiKey) {
        this.providers.gemini.apiKey = envGemini;
      }
      const envGroq = (import.meta as any).env?.VITE_GROQ_API_KEY;
      if (envGroq) {
        this.providers.groq.apiKey = envGroq;
        this.providers.groq.status = 'ONLINE';
      }
      const envDeepSeek = (import.meta as any).env?.VITE_DEEPSEEK_API_KEY;
      if (envDeepSeek && !this.providers.deepseek.apiKey) {
        this.providers.deepseek.apiKey = envDeepSeek;
      }

      const savedOrder = localStorage.getItem('microfyxd_omni_priority');
      if (savedOrder) {
        this.priorityOrder = JSON.parse(savedOrder);
      }

      const savedHistory = localStorage.getItem('microfyxd_omni_history');
      if (savedHistory) {
        this.history = JSON.parse(savedHistory);
      }
    } catch (e) {
      console.warn('Failed to load omni router config:', e);
    }
  }

  public saveConfig() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('microfyxd_omni_providers', JSON.stringify(this.providers));
      localStorage.setItem('microfyxd_omni_priority', JSON.stringify(this.priorityOrder));
      localStorage.setItem('microfyxd_omni_history', JSON.stringify(this.history.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to persist omni router config:', e);
    }
  }

  public getProviders(): Record<LLMProviderId, ProviderConfig> {
    return { ...this.providers };
  }

  public getPriorityOrder(): LLMProviderId[] {
    return [...this.priorityOrder];
  }

  public setPriorityOrder(newOrder: LLMProviderId[]) {
    this.priorityOrder = newOrder;
    this.saveConfig();
  }

  public setApiKey(provider: LLMProviderId, key: string) {
    if (this.providers[provider]) {
      this.providers[provider].apiKey = key.trim();
      this.providers[provider].status = key.trim() ? 'ONLINE' : 'KEY_MISSING';
      this.saveConfig();
    }
  }

  public setModel(provider: LLMProviderId, model: string) {
    if (this.providers[provider]) {
      this.providers[provider].model = model.trim();
      this.saveConfig();
    }
  }

  public toggleProvider(provider: LLMProviderId): boolean {
    if (provider === 'synthetic_kernel') return true; // always enabled
    if (this.providers[provider]) {
      this.providers[provider].enabled = !this.providers[provider].enabled;
      this.saveConfig();
      return this.providers[provider].enabled;
    }
    return false;
  }

  public getHistory(): RouterHistoryItem[] {
    return [...this.history];
  }

  public clearHistory() {
    this.history = [];
    this.saveConfig();
  }

  // Execute request with intelligent fallback
  public async execute(
    prompt: string, 
    systemInstruction: string = 'You are Carter, the living synthetic entity of Microfyxd OS Level 6. Respond with structured, high-precision clarity.'
  ): Promise<RouterExecutionResult> {
    const result = await runSystemCommand(prompt, { response_instruction: systemInstruction });
    const execution: RouterExecutionResult = {
      text: result.output, providerUsed: 'groq', modelUsed: result.diagnostics?.model || 'groq',
      latencyMs: result.latency_ms, tokensEstimated: result.groq_tokens || 0,
      fallbackChain: (result.diagnostics?.warnings || []).map((error: string) => ({provider:'groq' as const,status:'failed' as const,error})),
      timestamp: result.ts,
    };
    this.history.unshift({id:crypto.randomUUID(),prompt,response:result.output,provider:'groq',model:execution.modelUsed,latencyMs:execution.latencyMs,fallbackOccurred:execution.fallbackChain.length>0,timestamp:result.ts});
    this.history=this.history.slice(0,50);this.saveConfig();
    return execution;
  }

  // --- Provider Implementations ---

  private async callGroq(prompt: string, systemInstruction: string, config: ProviderConfig): Promise<string> {
    return fetchGroqWithRetry(config.apiKey, {
      model: config.model || 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 500,
    }, 3);
  }

  private async callGemini(prompt: string, systemInstruction: string, config: ProviderConfig): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const model = config.model || 'gemini-2.5-flash';
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.6,
        }
      });
      return response.text || 'No response from Gemini.';
    } catch (e: any) {
      throw new Error(`Gemini error: ${e?.message || e}`);
    }
  }

  private async callDeepSeek(prompt: string, systemInstruction: string, config: ProviderConfig): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 1024
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`DeepSeek HTTP ${res.status}: ${errorText.slice(0, 100)}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || 'No response from DeepSeek.';
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }
  }

  private async callSyntheticKernel(prompt: string, systemInstruction: string): Promise<string> {
    throw new Error('Synthetic kernel is not an inference or execution provider. Use the authenticated backend command loop.');
  }

  /**
   * Central Intelligence Command & Orchestration Layer (Groq Powered).
   * Interprets user communication, decides evaluations, targets subsystems, and produces contoured speech.
   */
  public async evaluateAndOrchestrate(
    prompt: string,
    currentSubsystem: string = 'ai_core'
  ): Promise<OrchestrationDecision> {
    const result = await runSystemCommand(prompt, { currentSubsystem });
    const warnings = result.diagnostics?.warnings || [];
    return {
      thought: warnings.length ? warnings.join("; ") : 'Backend execution verified and persisted.',
      // Navigation is a UI action, not proof that a task was executed.
      targetSubsystem: null, actionName: null,
      speech: String(result.output).replace(/```[\s\S]*?```/g, '').replace(/[*_#`]/g, '').slice(0, 240),
      detailedAnswer: result.output + (warnings.length ? '\n\nProvider notice: ' + warnings.join('; ') : ''),
      providerUsed: 'groq', latencyMs: result.latency_ms, organsUsed: result.organs_used,
    };
  }
}

export const omniRouter = new OmniLLMRouter();
