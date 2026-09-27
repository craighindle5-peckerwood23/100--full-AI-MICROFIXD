/**
 * src/components/os/MicrofixdOS.tsx
 * ROOT OS WRAPPER — Never unmounts. Renders on every screen.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │           TopBar (always)           │
 *   ├──────────┬──────────────────────────┤
 *   │ SidePanel│      WorkspaceArea        │
 *   │ (collapse│   (active room renders)   │
 *   │  -ible)  │                           │
 *   ├──────────┴──────────────────────────┤
 *   │           StatusBar (always)        │
 *   └─────────────────────────────────────┘
 *
 * CommandPalette overlays on Cmd+K.
 * HITLOverlay overlays on critical HITL events.
 * OverwatchHUD renders bottom-right corner always.
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import TopBar         from "./TopBar";
import SidePanel      from "./SidePanel";
import RoomRouter     from "./RoomRouter";
import StatusBar      from "./StatusBar";
import CommandPalette from "./CommandPalette";
import HITLOverlay    from "./HITLOverlay";
import OverwatchHUD   from "./OverwatchHUD";
import { useServerEvents } from "../../hooks/useServerEvents";
import { HITLRecord } from "../../lib/serverApi";

export type RoomId =
  | "chat" | "playwright" | "sandbox"
  | "episodes" | "analytics" | "settings" | "overwatch";

export interface OSState {
  room:            RoomId;
  sidePanelOpen:   boolean;
  commandPalette:  boolean;
  hitlQueue:       HITLRecord[];
  serverConnected: boolean;
}

export default function MicrofixdOS() {
  const [state, setState] = useState<OSState>({
    room:           "chat",
    sidePanelOpen:  true,
    commandPalette: false,
    hitlQueue:      [],
    serverConnected: false,
  });

  const setRoom   = (room: RoomId)       => setState(s => ({ ...s, room }));
  const toggleSide = ()                  => setState(s => ({ ...s, sidePanelOpen: !s.sidePanelOpen }));
  const openPalette = ()                 => setState(s => ({ ...s, commandPalette: true }));
  const closePalette = ()               => setState(s => ({ ...s, commandPalette: false }));

  // Live server events
  const { connected, send } = useServerEvents(useCallback((event) => {
    // HITL escalation — critical errors + self-modification triggers
    if (event.type === "hitl:review_required") {
      const record = event.payload as HITLRecord;
      setState(s => ({ ...s, hitlQueue: [...s.hitlQueue, record] }));
    }
    if (event.type === "hitl:decision") {
      const { hitl_id } = event.payload as { hitl_id: string };
      setState(s => ({ ...s, hitlQueue: s.hitlQueue.filter(h => h.hitl_id !== hitl_id) }));
    }
  }, []));

  // Update server connection status
  useEffect(() => {
    setState(s => ({ ...s, serverConnected: connected }));
  }, [connected]);

  // Cmd+K → Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setState(s => ({ ...s, commandPalette: !s.commandPalette }));
      }
      if (e.key === "Escape") {
        setState(s => ({ ...s, commandPalette: false }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Active critical HITL record
  const activeCritical = state.hitlQueue.find(
    h => h.artifact?.severity === "critical" || h.trigger === "self_modification"
  ) ?? null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0f1c] text-zinc-100 font-mono select-none">

      {/* ── TopBar — always visible ───────────────────────────────────── */}
      <TopBar
        room={state.room}
        onRoomChange={setRoom}
        onMenuToggle={toggleSide}
        onCommandPalette={openPalette}
        serverConnected={state.serverConnected}
        hitlPending={state.hitlQueue.length}
      />

      {/* ── Main body ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* SidePanel — collapsible */}
        <AnimatePresence initial={false}>
          {state.sidePanelOpen && (
            <motion.div
              key="side"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex-shrink-0 overflow-hidden border-r border-[#21262d]"
            >
              <SidePanel activeRoom={state.room} onRoomChange={setRoom} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* WorkspaceArea — active room */}
        <div className="flex-1 overflow-hidden relative">
          <RoomRouter room={state.room} />

          {/* OverwatchHUD — always-present corner widget */}
          <OverwatchHUD />
        </div>
      </div>

      {/* ── StatusBar — always visible ─────────────────────────────────── */}
      <StatusBar
        serverConnected={state.serverConnected}
        hitlPending={state.hitlQueue.length}
        onHITLClick={() => {
          if (state.hitlQueue.length > 0) {
            setState(s => ({ ...s, room: "sandbox" }));
          }
        }}
      />

      {/* ── Command Palette overlay ────────────────────────────────────── */}
      <AnimatePresence>
        {state.commandPalette && (
          <CommandPalette onClose={closePalette} onRoomChange={setRoom} />
        )}
      </AnimatePresence>

      {/* ── HITL Full-screen overlay — critical errors + self-modification */}
      <AnimatePresence>
        {activeCritical && (
          <HITLOverlay
            record={activeCritical}
            onDecide={(decision, notes) => {
              import("../../lib/serverApi").then(({ HITL }) => {
                HITL.decide(activeCritical.hitl_id, decision, notes);
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
