// @ts-nocheck
/**
 * microfixd/core/memory/supabaseMemory.ts
 * Supabase pgvector-backed semantic memory.
 * Replaces/extends existing MemoryOrgan with persistent cloud storage.
 * Uses Gemini text-embedding-004 for 768-dim embeddings.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "../../lib/googleGenai";

const supabase: SupabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? "",
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""
);

const genai  = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? "");
const embModel = genai.getGenerativeModel({ model: "text-embedding-004" });

export interface MemoryEntry {
  id?:         string;
  content:     string;
  tags?:       string[];
  organ?:      string;
  session_id?: string;
  importance?: number;
  similarity?: number;
}

// ── Embed text using Gemini ────────────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  try {
    const result = await embModel.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.warn("[supabase_memory] Embed failed — using zero vector:", err);
    return new Array(768).fill(0);
  }
}

// ── Store memory ──────────────────────────────────────────────────────────
export async function storeMemory(
  content:    string,
  tags:       string[] = [],
  organ:      string   = "system",
  sessionId?: string,
  importance  = 0.5,
): Promise<string | null> {
  const embedding = await embed(content);
  const { data, error } = await supabase
    .from("microfixd_memory")
    .insert({
      content,
      embedding,
      tags,
      organ,
      session_id: sessionId,
      importance,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[supabase_memory] Store error:", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

// ── Semantic recall ───────────────────────────────────────────────────────
export async function recallMemories(
  query:     string,
  limit      = 5,
  threshold  = 0.65,
): Promise<MemoryEntry[]> {
  const embedding = await embed(query);
  const { data, error } = await supabase
    .rpc("match_memories", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count:     limit,
    });

  if (error) {
    console.error("[supabase_memory] Recall error:", error.message);
    return [];
  }

  return (data ?? []) as MemoryEntry[];
}

// ── Keyword recall (fallback when no embeddings) ──────────────────────────
export async function recallByKeyword(
  keywords: string[],
  limit     = 5,
): Promise<MemoryEntry[]> {
  let query = supabase
    .from("microfixd_memory")
    .select("id, content, tags, organ, importance")
    .order("importance", { ascending: false })
    .limit(limit);

  for (const kw of keywords.slice(0, 3)) {
    query = query.ilike("content", `%${kw}%`);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as MemoryEntry[];
}

// ── Store episode to Supabase ─────────────────────────────────────────────
export async function storeEpisode(episode: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("microfixd_episodes")
    .upsert(episode, { onConflict: "episode_id" });
  if (error) console.error("[supabase_memory] Episode store error:", error.message);
}

// ── Get episode stats ─────────────────────────────────────────────────────
export async function getEpisodeStats(): Promise<{
  total: number;
  success_rate: number;
  avg_score: number | null;
}> {
  const { data, error } = await supabase
    .from("microfixd_episodes")
    .select("success, critic_score");

  if (error || !data) return { total: 0, success_rate: 0, avg_score: null };

  const total       = data.length;
  const successes   = data.filter((e: { success: boolean }) => e.success).length;
  const scored      = data.filter((e: { critic_score: number | null }) => e.critic_score != null);
  const avg_score   = scored.length
    ? scored.reduce((s: number, e: { critic_score: number }) => s + e.critic_score, 0) / scored.length
    : null;

  return {
    total,
    success_rate: total ? successes / total : 0,
    avg_score:    avg_score ? Math.round(avg_score * 100) / 100 : null,
  };
}

// ── Store overwatch alert ─────────────────────────────────────────────────
export async function storeOverwatchAlert(alert: {
  level:      string;
  category:   string;
  message:    string;
  organ?:     string;
  step?:      string;
  episode_id?: string;
}): Promise<void> {
  const { error } = await supabase.from("microfixd_overwatch").insert(alert);
  if (error) console.error("[supabase_memory] Alert store error:", error.message);
}

// ── Update access count ───────────────────────────────────────────────────
export async function bumpAccessCount(id: string): Promise<void> {
  await supabase.rpc("increment", { table: "microfixd_memory", id, column: "access_count" }).catch(() => {});
}
