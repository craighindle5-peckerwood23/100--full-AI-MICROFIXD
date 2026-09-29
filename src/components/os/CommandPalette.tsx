/**
 * src/components/os/CommandPalette.tsx
 * Cmd+K command palette — quick room nav, organ actions, system commands.
 */
import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Search, Brain, Globe, FlaskConical, BookOpen, BarChart2, Zap, Settings, Terminal } from "lucide-react";
import { ServerHealth, Playwright } from "../../lib/serverApi";
import type { RoomId } from "./MicrofixdOS";

interface Command {
  id:      string;
  label:   string;
  group:   string;
  icon:    React.ReactNode;
  action:  () => void;
}

interface CommandPaletteProps {
  onClose:      () => void;
  onRoomChange: (room: RoomId) => void;
}

export default function CommandPalette({ onClose, onRoomChange }: CommandPaletteProps) {
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commands: Command[] = [
    { id: "room-chat",       label: "Open Chat Room",       group: "Rooms",   icon: <Brain size={13} />,       action: () => { onRoomChange("chat");       onClose(); } },
    { id: "room-playwright", label: "Open Browser Room",    group: "Rooms",   icon: <Globe size={13} />,       action: () => { onRoomChange("playwright"); onClose(); } },
    { id: "room-sandbox",    label: "Open Sandbox",         group: "Rooms",   icon: <FlaskConical size={13} />,action: () => { onRoomChange("sandbox");    onClose(); } },
    { id: "room-episodes",   label: "Open Episodes",        group: "Rooms",   icon: <BookOpen size={13} />,    action: () => { onRoomChange("episodes");   onClose(); } },
    { id: "room-analytics",  label: "Open Analytics",       group: "Rooms",   icon: <BarChart2 size={13} />,   action: () => { onRoomChange("analytics");  onClose(); } },
    { id: "room-overwatch",  label: "Open Overwatch",       group: "Rooms",   icon: <Zap size={13} />,         action: () => { onRoomChange("overwatch");  onClose(); } },
    { id: "room-settings",   label: "Open Settings",        group: "Rooms",   icon: <Settings size={13} />,    action: () => { onRoomChange("settings");   onClose(); } },
    { id: "cmd-screenshot",  label: "Take Browser Screenshot", group: "Playwright", icon: <Globe size={13} />, action: () => { Playwright.screenshot(); onClose(); } },
    { id: "cmd-server",      label: "Check Server Health",  group: "System",  icon: <Terminal size={13} />,    action: () => { ServerHealth.check(); onClose(); } },
  ];

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => { setSelected(0); }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter")     { filtered[selected]?.action(); }
    if (e.key === "Escape")    { onClose(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -12, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: -8 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#21262d]">
          <Search size={14} className="text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-zinc-200 text-sm font-mono outline-none placeholder-zinc-600"
          />
          <span className="text-zinc-600 text-[10px] border border-[#30363d] px-1 rounded">ESC</span>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={cmd.action}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                i === selected ? "bg-[#21262d] text-zinc-200" : "text-zinc-400 hover:bg-[#161b22]"
              }`}
            >
              <span className="text-zinc-500">{cmd.icon}</span>
              <span className="text-sm font-mono">{cmd.label}</span>
              <span className="ml-auto text-[9px] text-zinc-600 uppercase">{cmd.group}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-zinc-600 text-xs font-mono">No commands found</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
