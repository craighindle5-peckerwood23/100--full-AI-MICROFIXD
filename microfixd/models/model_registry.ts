/**
 * microfixd/models/model_registry.ts
 * Registered LLM and embedding models
 */

export interface ModelDescriptor {
  id: string;
  provider: "groq" | "gemini" | "openai" | "anthropic" | "openrouter";
  role: "fast_cortex" | "deep_reasoner" | "critic" | "embedder";
  contextWindow: number;
  available: boolean;
}

export const REGISTERED_MODELS: ModelDescriptor[] = [
  { id: "llama-3.3-70b-versatile", provider: "groq", role: "deep_reasoner", contextWindow: 128000, available: true },
  { id: "llama-3.1-8b-instant", provider: "groq", role: "fast_cortex", contextWindow: 8192, available: true },
  { id: "gemini-2.5-flash", provider: "gemini", role: "deep_reasoner", contextWindow: 1000000, available: true },
  { id: "gpt-4o", provider: "openai", role: "deep_reasoner", contextWindow: 128000, available: true },
  { id: "claude-3-7-sonnet", provider: "anthropic", role: "critic", contextWindow: 200000, available: true },
];
