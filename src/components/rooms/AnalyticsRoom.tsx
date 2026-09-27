// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { getEpisodeMeta, listEpisodes } from "../../../microfixd/core/episodes/episodeStore";

const COLORS = ["#22d3ee","#10b981","#f59e0b","#ef4444","#8b5cf6"];

export default function AnalyticsRoom() {
  const [meta,     setMeta]     = useState<{ total: number; success_count: number; avg_score: number | null } | null>(null);
  const [episodes, setEpisodes] = useState<{ ts: string; success: boolean; critic_score: number | null; complexity: string }[]>([]);

  useEffect(() => {
    getEpisodeMeta().then(setMeta);
    listEpisodes(30).then(setEpisodes);
  }, []);

  const successRate  = meta ? Math.round((meta.success_count / Math.max(1, meta.total)) * 100) : 0;
  const scoreData    = episodes.filter(e => e.critic_score != null).slice(-20).map((e, i) => ({
    i, score: +(e.critic_score ?? 0).toFixed(2), success: e.success,
  }));
  const complexPie = ["low","medium","high"].map(c => ({
    name: c, value: episodes.filter(e => e.complexity === c).length,
  }));

  const statCard = (label: string, value: string | number, sub?: string, color = "text-cyan-400") => (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-[#0a0f1c]">
      <h2 className="text-cyan-400 font-mono text-sm font-semibold tracking-wider">◈ ANALYTICS DASHBOARD</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {statCard("Total Episodes", meta?.total ?? 0)}
        {statCard("Success Rate", `${successRate}%`, `${meta?.success_count ?? 0} successes`, successRate > 70 ? "text-emerald-400" : "text-amber-400")}
        {statCard("Avg Score", meta?.avg_score?.toFixed(2) ?? "—", "critic score 0–10", "text-violet-400")}
        {statCard("Last 30", episodes.length, "episodes loaded")}
      </div>

      {/* Score trend */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Critic Score Trend</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={scoreData}>
            <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
            <XAxis dataKey="i" hide />
            <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#71717a" }} />
            <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="score" stroke="#22d3ee" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Complexity breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Complexity Distribution</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={complexPie} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={9}>
                {complexPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">Success by Complexity</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={complexPie}>
              <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {complexPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
