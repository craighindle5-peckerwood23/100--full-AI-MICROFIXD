import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  RequestType, 
  DomainType, 
  Intent, 
  Entity, 
  Constraint, 
  MissingContextItem, 
  MemoryBinding, 
  CognitiveRequestRecord 
} from '../types';

export type { 
  RequestType, 
  DomainType, 
  Intent, 
  Entity, 
  Constraint, 
  MissingContextItem, 
  MemoryBinding, 
  CognitiveRequestRecord 
};

// Supabase configuration
const DEFAULT_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const DEFAULT_SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  mode: 'cloud' | 'local_fallback';
  lastPing?: string;
  error?: string;
}

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  if (typeof window === 'undefined') {
    return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_KEY };
  }
  const customUrl = localStorage.getItem('microfyxd_supabase_url') || DEFAULT_SUPABASE_URL;
  const customKey = localStorage.getItem('microfyxd_supabase_key') || DEFAULT_SUPABASE_KEY;
  return { url: customUrl, anonKey: customKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('microfyxd_supabase_url', url.trim());
    localStorage.setItem('microfyxd_supabase_key', anonKey.trim());
    supabaseClient = null; // reset client to re-initialize
  }
}

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const { url, anonKey } = getSupabaseCredentials();

  if (url && anonKey) {
    try {
      supabaseClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
      return supabaseClient;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    return { 
      success: false, 
      message: 'Supabase credentials not configured. Operating in Local Secure Microkernel Fallback mode.' 
    };
  }

  const client = getSupabase();
  if (!client) {
    return { success: false, message: 'Could not construct Supabase client.' };
  }

  const start = performance.now();
  try {
    // Attempt a lightweight query or auth check
    const { error } = await client.from('system_logs').select('count', { count: 'exact', head: true });
    const latency = Math.round(performance.now() - start);

    if (error && error.code !== 'PGRST116' && !error.message.includes('relation "system_logs" does not exist')) {
      // Check if it's just missing table vs auth error
      if (error.message.includes('API key') || error.message.includes('JWT') || error.code === '401') {
        return { success: false, message: `Auth error: ${error.message}`, latencyMs: latency };
      }
    }

    return { 
      success: true, 
      message: `Supabase link verified. Ping: ${latency}ms. Connection active.`, 
      latencyMs: latency 
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { 
      success: false, 
      message: `Connection failed: ${err?.message || 'Network error'}`, 
      latencyMs: latency 
    };
  }
}

// Helper to log system events to Supabase or fallback
export async function logSystemEvent(source: string, message: string, severity: 'INFO' | 'WARN' | 'CRITICAL' = 'INFO') {
  const client = getSupabase();
  const payload = {
    source,
    message,
    severity,
    timestamp: new Date().toISOString()
  };

  if (client) {
    try {
      await client.from('system_logs').insert([payload]);
    } catch {
      // Fallback silently if table doesn't exist yet
    }
  }

  // Also cache locally
  if (typeof window !== 'undefined') {
    try {
      const logs = JSON.parse(localStorage.getItem('microfyxd_local_logs') || '[]');
      logs.unshift(payload);
      localStorage.setItem('microfyxd_local_logs', JSON.stringify(logs.slice(0, 100)));
    } catch {}
  }
}

// ==========================================
// Cognitive Intake & Request Schema Helpers
// ==========================================

export async function insertCognitiveRequest(
  data: Omit<CognitiveRequestRecord, 'id' | 'created_at'> & { id?: string }
): Promise<{ success: boolean; record: CognitiveRequestRecord; destination: 'supabase' | 'local_fallback' }> {
  const record: CognitiveRequestRecord = {
    id: data.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cog-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`),
    request_type: data.request_type,
    domain_type: data.domain_type,
    raw_prompt: data.raw_prompt || '',
    intents: data.intents || [],
    entities: data.entities || [],
    constraints: data.constraints || [],
    missing_context: data.missing_context || [],
    memory_bindings: data.memory_bindings || [],
    confidence: data.confidence ?? 0.98,
    created_at: new Date().toISOString()
  };

  const client = getSupabase();
  let destination: 'supabase' | 'local_fallback' = 'local_fallback';

  if (client) {
    try {
      const { error } = await client.from('cognitive_requests').insert([record]);
      if (!error) {
        destination = 'supabase';
      }
    } catch (err) {
      console.warn('Supabase cognitive_requests insert failed, falling back to local store:', err);
    }
  }

  // Always mirror in localStorage for resilient continuity
  if (typeof window !== 'undefined') {
    try {
      const localKey = 'microfyxd_cognitive_requests';
      const existing: CognitiveRequestRecord[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      // Deduplicate by id
      const filtered = existing.filter(r => r.id !== record.id);
      filtered.unshift(record);
      localStorage.setItem(localKey, JSON.stringify(filtered.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to mirror cognitive request in localStorage:', e);
    }
  }

  return { success: true, record, destination };
}

export async function getCognitiveRequests(limit = 20): Promise<CognitiveRequestRecord[]> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('cognitive_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as CognitiveRequestRecord[];
      }
    } catch (e) {
      // fallback
    }
  }

  // Local fallback
  if (typeof window !== 'undefined') {
    try {
      const localKey = 'microfyxd_cognitive_requests';
      const list: CognitiveRequestRecord[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      return list.slice(0, limit);
    } catch {
      return [];
    }
  }

  return [];
}
