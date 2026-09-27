export interface EpisodeRecord {
  episode_id: string;
  task: string;
  success: boolean;
  cognitive_intent?: string;
  complexity?: string;
  elapsed_s?: number;
  critic_score?: number;
  eval_passed?: boolean;
  steps?: Record<string, unknown>;
  created_at: string;
  [key: string]: unknown;
}

export interface EpisodeMeta {
  total: number;
  success_rate: number;
  avg_score: number | null;
}

const episodes: EpisodeRecord[] = [];
export function listEpisodes(limit = 50): EpisodeRecord[] { return episodes.slice(-limit).reverse(); }
export function searchEpisodes(query: string): EpisodeRecord[] {
  const q = query.toLowerCase();
  return episodes.filter(e => e.task.toLowerCase().includes(q)).slice(-50).reverse();
}
export function getEpisodeMeta(): EpisodeMeta {
  const total = episodes.length;
  const success = episodes.filter(e => e.success).length;
  const scores = episodes.map(e => e.critic_score).filter((v): v is number => typeof v === "number");
  return { total, success_rate: total ? success / total : 0, avg_score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null };
}
export function recordEpisode(episode: EpisodeRecord): void { episodes.push(episode); }
