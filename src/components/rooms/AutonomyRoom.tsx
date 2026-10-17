import React from 'react';
import MissionControlRoom from './MissionControlRoom';
/** Autonomy observes and submits to the same durable worker as the main console. */
export default function AutonomyRoom(){
 return <div className="h-full flex flex-col gap-3 p-4"><p className="text-xs text-cyan-200">Autonomy uses the durable mission queue. External changes require scoped authorization; recurring jobs and self-deployment are not configured.</p><div className="min-h-0 flex-1"><MissionControlRoom /></div></div>;
}
