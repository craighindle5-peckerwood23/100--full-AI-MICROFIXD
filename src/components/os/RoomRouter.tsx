// @ts-nocheck
/**
 * src/components/os/RoomRouter.tsx
 * Renders the active room inside the workspace area.
 * Lazy-loads room components for performance.
 */
import React, { Suspense, lazy } from "react";
import type { RoomId } from "./MicrofixdOS";

const ROOM_COMPONENTS: Record<RoomId, React.LazyExoticComponent<() => JSX.Element>> = {
  chat:       lazy(() => import("../rooms/ChatRoom")),
  playwright: lazy(() => import("../rooms/PlaywrightRoom")),
  sandbox:    lazy(() => import("../rooms/SandboxRoom")),
  episodes:   lazy(() => import("../rooms/EpisodesRoom")),
  analytics:  lazy(() => import("../rooms/AnalyticsRoom")),
  overwatch:  lazy(() => import("../rooms/OverwatchRoom")),
  settings:   lazy(() => import("../rooms/SettingsRoom")),
};

function RoomFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-zinc-600 font-mono text-xs animate-pulse">Loading room...</div>
    </div>
  );
}

interface RoomRouterProps { room: RoomId; }

export default function RoomRouter({ room }: RoomRouterProps) {
  const Room = ROOM_COMPONENTS[room];
  return (
    <div className="w-full h-full overflow-hidden">
      <Suspense fallback={<RoomFallback />}>
        <Room />
      </Suspense>
    </div>
  );
}
