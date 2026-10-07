/**
 * src/components/os/TopBar.tsx
 * Always-visible top command bar.
 * Identity lock badge, room tabs, server status, HITL alert, Cmd+K.
 */
import React from "react";
import { motion } from "motion/react";
import {
  Menu, Terminal, Globe, FlaskConical, BookOpen,
  BarChart2, Settings, Brain, Zap, AlertTriangle, Search
} from "lucide-react";
import type { RoomId } from "./MicrofixdOS";
import { useBrand } from "../../branding/BrandProvider";

const ROOMS: { id: RoomId; label: string; icon: React.ReactNode }[] = [
  { id: "chat",       label: "Chat",       icon: <Brain size={13} /> },
  { id: "playwright", label: "Browser",    icon: <Globe size={13} /> },
  { id: "sandbox",    label: "Sandbox",    icon: <FlaskConical size={13} /> },
  { id: "episodes",   label: "Episodes",   icon: <BookOpen size={13} /> },
  { id: "analytics",  label: "Analytics",  icon: <BarChart2 size={13} /> },
  { id: "overwatch",  label: "Overwatch",  icon: <Zap size={13} /> },
  { id: "settings",   label: "Settings",   icon: <Settings size={13} /> },
];

interface TopBarProps {
  room:             RoomId;
  onRoomChange:     (room: RoomId) => void;
  onMenuToggle:     () => void;
  onCommandPalette: () => void;
  serverConnected:  boolean;
  hitlPending:      number;
}

export default function TopBar({
  room, onRoomChange, onMenuToggle, onCommandPalette, serverConnected, hitlPending,
}: TopBarProps) {
  const brand = useBrand();
  return (
    <div className="flex items-center h-10 px-3 gap-2 bg-[#0d1117] border-b border-[#21262d] flex-shrink-0 z-50">

      {/* Menu toggle */}
      <button onClick={onMenuToggle}
        className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors rounded">
        <Menu size={15} />
      </button>

      {/* Identity lock badge */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_4px_#22d3ee]" />
        <span className="text-cyan-400 text-[10px] font-semibold tracking-widest">{brand.topBarBadge}</span>
      </div>

      {/* Room tabs */}
      <div className="flex items-center gap-0.5 ml-2">
        {ROOMS.map(r => (
          <button
            key={r.id}
            onClick={() => onRoomChange(r.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
              room === r.id
                ? "bg-[#21262d] text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-[#161b22]"
            }`}
          >
            {r.icon}
            <span className="hidden sm:inline">{r.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* HITL alert badge */}
      {hitlPending > 0 && (
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full cursor-pointer"
        >
          <AlertTriangle size={10} className="text-red-400" />
          <span className="text-red-400 text-[10px] font-bold">{hitlPending} HITL</span>
        </motion.div>
      )}

      {/* Server status */}
      <div className={`flex items-center gap-1 text-[10px] ${serverConnected ? "text-emerald-400" : "text-zinc-600"}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${serverConnected ? "bg-emerald-400" : "bg-zinc-600"}`} />
        <span>{serverConnected ? "Server" : "Offline"}</span>
      </div>

      {/* Cmd+K */}
      <button
        onClick={onCommandPalette}
        className="flex items-center gap-1.5 px-2 py-1 bg-[#161b22] border border-[#21262d] rounded text-zinc-500 hover:text-zinc-300 text-[10px] transition-colors"
      >
        <Search size={10} />
        <span>⌘K</span>
      </button>
    </div>
  );
}
