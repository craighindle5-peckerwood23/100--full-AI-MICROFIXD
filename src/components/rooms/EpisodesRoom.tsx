// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, CheckCircle, XCircle, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { listEpisodes, searchEpisodes, getEpisodeMeta } from "../../../microfixd/core/episodes/episodeStore";
import type { EpisodeRecord, EpisodeMeta } from "../../../microfixd/core/episodes/episodeStore";

export default function EpisodesRoom() {
  const [episodes,  setEpisodes]  = useState<EpisodeRecord[]>([]);
  const [meta,      setMeta]      = useState<EpisodeMeta | null>(null);
  const [query,     setQuery]     = useState("");
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);

  const load = async () => {
    setLoading(true);
    const [eps, m] = await Promise.all([
      query ? searchEpisodes(query) : listEpisodes(30),
      getEpisodeMeta(),
    ]);
    setEpisodes(eps);
    setMeta(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, [query]);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1c]">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0d1117] border-b border-[#21262d]">
        <span className="text-cyan-400 font-mono text-xs font-semibold">📼 EPISODES</span>
        <div className="flex items-center gap-1.5 flex-1 bg-[#161b22] border border-[#21262d] rounded px-2 py-1">
          <Search size={11} className="text-zinc-500" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search episodes..." className="bg-transparent text-xs font-mono text-zinc-300 placeholder-zinc-600 outline-none w-full" />
        </div>
        <button onClick={load} className="text-zinc-500 hover:text-zinc-300"><RefreshCw size={12} /></button>
        {meta && (
          <div className="text-[10px] font-mono text-zinc-500 flex gap-3">
            <span>Total: <span className="text-zinc-300">{meta.total}</span></span>
            <span>Avg: <span className="text-cyan-400">{meta.avg_score?.toFixed(1) ?? "—"}</span></span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex justify-center py-8 text-zinc-600 font-mono text-xs">Loading...</div>}
        {episodes.map(ep => (
          <div key={ep.episode_id} className="border-b border-[#21262d] hover:bg-[#0d1117] transition-colors">
            <div className="flex items-center gap-2 px-4 py-2 cursor-pointer"
              onClick={() => setExpanded(expanded === ep.episode_id ? null : ep.episode_id)}>
              {ep.success
                ? <CheckCircle size={11} className="text-emerald-400 flex-shrink-0" />
                : <XCircle    size={11} className="text-red-400 flex-shrink-0" />}
              <span className="flex-1 text-zinc-300 font-mono text-xs truncate">{ep.task}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                ep.complexity === "high" ? "bg-red-500/10 text-red-400" :
                ep.complexity === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
              }`}>{ep.complexity}</span>
              {ep.critic_score != null && <span className="text-cyan-400 font-mono text-[10px]">{ep.critic_score.toFixed(1)}</span>}
              {expanded === ep.episode_id ? <ChevronDown size={10} className="text-zinc-500" /> : <ChevronRight size={10} className="text-zinc-500" />}
            </div>
            <AnimatePresence>
              {expanded === ep.episode_id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="px-10 pb-2 font-mono text-[10px] text-zinc-500 space-y-0.5">
                    <div>ID: <span className="text-zinc-400">{ep.episode_id}</span></div>
                    <div>Intent: <span className="text-zinc-400">{ep.cognitive_intent}</span></div>
                    <div>Elapsed: <span className="text-zinc-400">{ep.elapsed_s?.toFixed(2)}s</span></div>
                    <div>Steps: <span className="text-zinc-400">{Object.keys(ep.steps ?? {}).join(" → ")}</span></div>
                    {ep.doctrine_warnings?.length > 0 && <div className="text-amber-400">⚠ {ep.doctrine_warnings.join("; ")}</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
        {!loading && episodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-700 font-mono text-xs">
            No episodes yet — run some tasks to see history.
          </div>
        )}
      </div>
    </div>
  );
}
