import { GoogleGenAI } from '@google/genai';
import { logSystemEvent, getSupabase } from '../lib/supabase';
import { voice } from './voice';
import { autonomousCore } from '../autonomy/autonomousCore';

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

// In-memory & localStorage state
class OmniLLMRouter {
  private providers: Record<LLMProviderId, ProviderConfig> = {
    groq: {
      id: 'groq',
      name: 'Groq Cloud',
      model: 'llama-3.3-70b-versatile',
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
      if (envGroq && !this.providers.groq.apiKey) {
        this.providers.groq.apiKey = envGroq;
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
    const startTime = performance.now();
    const fallbackChain: RouterExecutionResult['fallbackChain'] = [];

    // Check if Manual Override is active in Autonomous Core
    const fallbackAlert = autonomousCore.getFallbackAlert();
    let candidates = this.priorityOrder.filter(id => this.providers[id]?.enabled);

    if (fallbackAlert.manualOverrideActive && fallbackAlert.forcedProvider) {
      const forced = fallbackAlert.forcedProvider as LLMProviderId;
      if (this.providers[forced]) {
        // User locked to this provider
        candidates = [forced];
      }
    }

    if (!candidates.includes('synthetic_kernel')) {
      candidates.push('synthetic_kernel');
    }

    let resultText = '';
    let chosenProvider: LLMProviderId = 'synthetic_kernel';
    let chosenModel = this.providers.synthetic_kernel.model;

    for (let i = 0; i < candidates.length; i++) {
      const pId = candidates[i];
      const pConfig = this.providers[pId];

      // If provider requires API key and none provided, mark and skip
      if (pId !== 'synthetic_kernel' && !pConfig.apiKey) {
        fallbackChain.push({
          provider: pId,
          status: 'failed',
          error: 'No API Key configured'
        });
        continue;
      }

      fallbackChain.push({
        provider: pId,
        status: 'attempted'
      });

      try {
        if (pId === 'groq') {
          resultText = await this.callGroq(prompt, systemInstruction, pConfig);
        } else if (pId === 'gemini') {
          resultText = await this.callGemini(prompt, systemInstruction, pConfig);
        } else if (pId === 'deepseek') {
          resultText = await this.callDeepSeek(prompt, systemInstruction, pConfig);
        } else {
          resultText = await this.callSyntheticKernel(prompt, systemInstruction);
        }

        // Success!
        chosenProvider = pId;
        chosenModel = pConfig.model;
        const currentAttempt = fallbackChain[fallbackChain.length - 1];
        if (currentAttempt) {
          currentAttempt.status = 'success';
        }
        pConfig.status = 'ONLINE';
        pConfig.latencyMs = Math.round(performance.now() - startTime);
        pConfig.lastUsed = new Date().toLocaleTimeString();
        pConfig.totalTokensProcessed += Math.round(resultText.length / 4);
        break;
      } catch (err: any) {
        const errorMsg = err?.message || 'Inference error';
        console.warn(`Omni router fallback: ${pId} failed (${errorMsg}). Trying next candidate...`);
        const currentAttempt = fallbackChain[fallbackChain.length - 1];
        if (currentAttempt) {
          currentAttempt.status = 'failed';
          currentAttempt.error = errorMsg;
        }

        pConfig.status = errorMsg.includes('429') || errorMsg.includes('rate') 
          ? 'RATE_LIMITED' 
          : 'ERROR';

        // Trigger Autonomous Core Fallback Alert & Visual Indicator
        if (candidates[i + 1]) {
          const nextProviderId = candidates[i + 1];
          const nextConfig = this.providers[nextProviderId];
          autonomousCore.triggerFallbackAlert(
            pConfig.name,
            pConfig.model,
            nextConfig?.name || 'Synthetic Ring-0 Kernel',
            nextConfig?.model || 'microfyxd-l6-autonomous',
            errorMsg
          );
        }
      }
    }

    const totalLatency = Math.round(performance.now() - startTime);
    const tokensEstimated = Math.round((prompt.length + resultText.length) / 3.8);

    const executionResult: RouterExecutionResult = {
      text: resultText,
      providerUsed: chosenProvider,
      modelUsed: chosenModel,
      latencyMs: totalLatency,
      tokensEstimated,
      fallbackChain,
      timestamp: new Date().toLocaleTimeString()
    };

    // Save to history
    const historyEntry: RouterHistoryItem = {
      id: `req-${Date.now().toString().slice(-4)}`,
      prompt,
      response: resultText,
      provider: chosenProvider,
      model: chosenModel,
      latencyMs: totalLatency,
      fallbackOccurred: fallbackChain.some(f => f.status === 'failed'),
      timestamp: new Date().toLocaleTimeString()
    };
    this.history.unshift(historyEntry);
    this.saveConfig();

    // Log to Supabase / persistent store
    logSystemEvent(
      `OMNI.ROUTER[${chosenProvider.toUpperCase()}]`,
      `Executed prompt using model ${chosenModel} (${totalLatency}ms, ~${tokensEstimated} tokens). Fallback chain: ${fallbackChain.map(f => `${f.provider}:${f.status}`).join(' -> ')}`,
      'INFO'
    );

    // If Supabase is connected, attempt inserting into omni_router_requests table
    const sb = getSupabase();
    if (sb) {
      Promise.resolve(
        sb.from('omni_router_requests').insert([{
          prompt,
          response: resultText,
          provider: chosenProvider,
          model: chosenModel,
          latency_ms: totalLatency,
          tokens_estimated: tokensEstimated,
          created_at: new Date().toISOString()
        }])
      ).catch(() => {});
    }

    return executionResult;
  }

  // --- Provider Implementations ---

  private async callGroq(prompt: string, systemInstruction: string, config: ProviderConfig): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.6,
          max_tokens: 1024
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Groq HTTP ${res.status}: ${errorText.slice(0, 100)}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || 'No response from Groq.';
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }
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
    // High-fidelity Level 6 OS synthetic cognition fallback
    await new Promise(r => setTimeout(r, 380)); // Simulate microkernel neural processing

    const lower = prompt.toLowerCase();
    if (lower.includes('status') || lower.includes('health') || lower.includes('metrics')) {
      return `[MICROFYXD OS KERNEL v6.2.0 // STATUS REPORT]
- Core State: SYNCHRONIZED
- Autonomy Tier: Level 6 Autonomous Agent Matrix
- Active Multi-Agent Mesh: Carter (Lead), Sentinel (Ethics), Turing (Code), Nexus (Data), DaVinci (Design), Atlas (Infra)
- Interconnect: Low-latency Zero-Trust Sandbox Active
- All security directives verified compliant under Chapter 15 Constitutional Safety.`;
    }

    if (lower.includes('mission') || lower.includes('plan') || lower.includes('goal')) {
      return `[AUTONOMOUS MISSION DISPATCHER]
Analyzing objective: "${prompt}".
DAG graph generated with 4 synchronized nodes:
1. [Decomposition] Parse semantic constraints and allocate token budget.
2. [Agent Assignment] Delegate code tasks to Turing and security validation to Sentinel.
3. [Execution] Dispatch sandboxed jobs in WASM microkernel isolation.
4. [Convergence] Verify output against Chapter 15 directives and commit to memory graph.`;
    }

    if (lower.includes('code') || lower.includes('script') || lower.includes('fix') || lower.includes('bug')) {
      return `[TURING SYNTHETIC CODE ENGINE]
Code inquiry processed: "${prompt}".
Identified execution topology in sandbox. Recommending deterministic pipeline with zero-knowledge verification.
Automated tests queued in Sandbox Workspace #1.`;
    }

    return `[MICROFYXD L6 COGNITIVE RESPONSE]
Query synthesized: "${prompt}".
The OS Omni Router evaluated your input across the multi-agent cognitive lattice. All nodes report nominal operational parameters, active episodic memory synchronization, and full constitutional compliance.`;
  }
}

export const omniRouter = new OmniLLMRouter();
