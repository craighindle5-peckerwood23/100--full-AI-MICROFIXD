/**
 * src/components/os/SidePanel.tsx
 * Collapsible side panel — organ status, active tasks, quick-nav.
 */
import React, { useEffect, useState } from "react";
import {
  Activity, Cpu, Database, Globe, Shield,
  GitBranch, Zap, Brain, FlaskConical, BookOpen,
  BarChart2, Settings, ChevronRight
} from "lucide-react";
import { ServerHealth } from "../../lib/serverApi";
import type { RoomId } from "./MicrofixdOS";

const NAV_ITEMS: { id: RoomId; label: string; icon: React.ReactNode }[] = [
  { id: "chat",       label: "Chat Room",    icon: <Brain size={12} /> },
  { id: "playwright", label: "Browser",      icon: <Globe size={12} /> },
  { id: "sandbox",    label: "Sandbox",      icon: <FlaskConical size={12} /> },
  { id: "episodes",   label: "Episodes",     icon: <BookOpen size={12} /> },
  { id: "analytics",  label: "Analytics",    icon: <BarChart2 size={12} /> },
  { id: "overwatch",  label: "Overwatch",    icon: <Zap size={12} /> },
  { id: "settings",   label: "Settings",     icon: <Settings size={12} /> },
];

const ORGAN_ROWS = [
  { id: "brain",            icon: <Cpu size={10} /> },
  { id: "memory",           icon: <Database size={10} /> },
  { id: "playwright",       icon: <Globe size={10} /> },
  { id: "github_connector", icon: <GitBranch size={10} /> },
  { id: "security_spine",   icon: <Shield size={10} /> },
  { id: "cortex",           icon: <Zap size={10} /> },
  { id: "health_monitor",   icon: <Activity size={10} /> },
];

interface SidePanelProps {
  activeRoom:   RoomId;
  onRoomChange: (room: RoomId) => void;
}

export default function SidePanel({ activeRoom, onRoomChange }: SidePanelProps) {
  const [organStatus, setOrganStatus] = useState<Record<string, string>>({});

  // Poll server health every 2s
  useEffect(() => {
    const poll = async () => {
      try {
        const health = await ServerHealth.check();
        setOrganStatus(s => ({ ...s, server: health.status === "ok" ? "active" : "error" }));
      } catch {
        setOrganStatus(s => ({ ...s, server: "error" }));
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const dotColor = (status: string) => {
    if (status === "active") return "bg-emerald-400";
    if (status === "error")  return "bg-red-400 animate-pulse";
    if (status === "busy")   return "bg-amber-400 animate-pulse";
    return "bg-zinc-600";
  };

  return (
    <div className="w-full h-full bg-[#0d1117] flex flex-col overflow-hidden">

      {/* Navigation */}
      <div className="p-2 border-b border-[#21262d]">
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest px-1 mb-1.5">Rooms</p>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onRoomChange(item.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors mb-0.5 ${
              activeRoom === item.id
                ? "bg-[#21262d] text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-[#161b22]"
            }`}
          >
            {item.icon}
            {item.label}
            {activeRoom === item.id && (
              <ChevronRight size={10} className="ml-auto text-cyan-400" />
            )}
          </button>
        ))}
      </div>

      {/* Organ status */}
      <div className="p-2 flex-1">
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest px-1 mb-1.5">Organs</p>
        {ORGAN_ROWS.map(org => (
          <div key={org.id} className="flex items-center gap-1.5 px-1 py-1">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor(organStatus[org.id] ?? "idle")}`} />
            <span className="text-zinc-500 text-[10px] flex items-center gap-1">
              {org.icon}
              {org.id.replace("_connector", "").replace("_", " ")}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom identity */}
      <div className="p-2 border-t border-[#21262d]">
        <div className="text-[9px] text-zinc-600 font-mono">
          <div>gemini-2.0-flash-exp</div>
          <div className="text-zinc-700">Microfixd v7 · L7 Arcana</div>
        </div>
      </div>
    </div>
  );
}
