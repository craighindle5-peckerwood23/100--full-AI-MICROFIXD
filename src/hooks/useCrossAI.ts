import { useState, useCallback } from "react";
import { api } from "../lib/serverApi";

export interface CrossAICallResult {
  provider:    string;
  content:     string;
  model?:      string;
  latency_ms:  number;
  success:     boolean;
  error?:      string;
}

export function useCrossAI() {
  const [results,  setResults]  = useState<CrossAICallResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [providers, setProviders] = useState<{id: string; available: boolean; model: string; skeleton?: boolean}[]>([]);

  const loadProviders = useCallback(async () => {
    const data = await api<{ providers: typeof providers }>("GET", "/crossai/providers");
    setProviders(data.providers);
  }, []);

  const callOne = useCallback(async (to: string, prompt: string) => {
    setLoading(true);
    try {
      const result = await api<CrossAICallResult>("POST", "/crossai/call", {
        to, messages: [{ role: "user", content: prompt }],
      });
      const r = { ...result, provider: to };
      setResults(prev => [r, ...prev.slice(0, 49)]);
      return r;
    } finally { setLoading(false); }
  }, []);

  const callParallel = useCallback(async (targets: string[], prompt: string) => {
    setLoading(true);
    try {
      const { responses } = await api<{ responses: CrossAICallResult[] }>("POST", "/crossai/parallel", {
        targets, messages: [{ role: "user", content: prompt }],
      });
      setResults(prev => [...responses, ...prev].slice(0, 100));
      return responses;
    } finally { setLoading(false); }
  }, []);

  const callFastest = useCallback(async (prompt: string) => {
    setLoading(true);
    try {
      const result = await api<CrossAICallResult & { provider: string }>("POST", "/crossai/fastest", {
        messages: [{ role: "user", content: prompt }],
      });
      setResults(prev => [result, ...prev.slice(0, 49)]);
      return result;
    } finally { setLoading(false); }
  }, []);

  return { results, loading, providers, loadProviders, callOne, callParallel, callFastest };
}
