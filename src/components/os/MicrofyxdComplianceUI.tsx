import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useOrgans } from '../../context/OrganContext';

export default function MicrofyxdComplianceUI() {
  const organs = useOrgans();
  const [metrics, setMetrics] = useState<any>({});
  const [emotion, setEmotion] = useState<string>('neutral');
  const [missions, setMissions] = useState<any[]>([]);
  const [reflexEvents, setReflexEvents] = useState<any[]>([]);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [federationNodes, setFederationNodes] = useState<any[]>([]);

  const [webEvents, setWebEvents] = useState<any[]>([]);
  const [voiceInputEvents, setVoiceInputEvents] = useState<any[]>([]);
  const [voiceOutputEvents, setVoiceOutputEvents] = useState<any[]>([]);
  const [parsedCommands, setParsedCommands] = useState<any[]>([]);
  const [voiceToneEvents, setVoiceToneEvents] = useState<any[]>([]);
  const [federationEvents, setFederationEvents] = useState<any[]>([]);
  const [sensorsActive, setSensorsActive] = useState(false);

  // STRICT RULE: UI ONLY POLLS STATE OR SUBSCRIBES TO WIRING
  useEffect(() => {
    const updateState = () => {
      // @ts-ignore - access for display only
      const metrics = organs.loop['telemetry'].getLatestMetrics();
      setMetrics({
        schedulerNextTick: organs.scheduler['nextTick'] || 0,
        loopLastCycle: organs.loop['lastCycleTime'] || 0,
        cpu: metrics.cpu,
        memory: metrics.memory,
        network: metrics.network
      });
      setEmotion(organs.emotion.getCurrentEmotion());
      setMissions(organs.mission.getMissions());
      setFederationNodes(organs.federation.getNodes());
      // @ts-ignore
      setSensorsActive(organs.voice.running);
    };

    const interval = setInterval(updateState, 500);
    
    // WIRING BUS SUBSCRIPTIONS
    const unsubReflex = organs.wiring.on('reflex', (event: any) => {
      setReflexEvents(prev => [event, ...prev].slice(0, 10));
    });

    const unsubWeb = organs.wiring.on('web', (event: any) => {
      setWebEvents(prev => [event, ...prev].slice(0, 10));
    });

    const unsubEmotion = organs.wiring.on('emotion', (event: any) => {
      if (event.type === 'voice_tone') {
        setVoiceToneEvents(prev => [event, ...prev].slice(0, 10));
      }
    });

    const unsubCognition = organs.wiring.on('cognition', (event: any) => {
      setParsedCommands(prev => [event, ...prev].slice(0, 10));
    });

    const unsubVoice = organs.wiring.on('voice', (event: any) => {
      if (event.transcript) {
        setVoiceInputEvents(prev => [event, ...prev].slice(0, 10));
      }
    });

    const unsubFederation = organs.wiring.on('federation', (event: any) => {
      setFederationEvents(prev => [event, ...prev].slice(0, 10));
    });

    return () => {
      clearInterval(interval);
      unsubReflex();
      unsubWeb();
      unsubEmotion();
      unsubCognition();
      unsubVoice();
      unsubFederation();
    };
  }, [organs]);

  return (
    <div className="fixed inset-0 bg-[#010305] text-cyan-500 font-mono p-4 overflow-hidden flex flex-col gap-4 text-[10px]">
      <main className="flex-1 grid grid-cols-12 grid-rows-12 gap-4 min-h-0">
        
        {/* 1. SYSTEM_STATUS_PANEL */}
        <section className="col-span-3 row-span-3 bg-cyan-950/10 border border-cyan-500/20 p-3 flex flex-col gap-2">
          <h2 className="border-b border-cyan-500/20 pb-1 font-black tracking-widest uppercase text-cyan-400">System Status</h2>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between border-b border-cyan-500/5 pb-0.5 text-[9px] tracking-tighter">
              <span className="opacity-40 uppercase font-black">SCHEDULER_TICK</span>
              <span className="text-white opacity-80">{metrics.schedulerNextTick || 0}</span>
            </div>
            <div className="flex justify-between border-b border-cyan-500/5 pb-0.5 text-[9px] tracking-tighter">
              <span className="opacity-40 uppercase font-black">LOOP_CYCLE</span>
              <span className="text-white opacity-80">{metrics.loopLastCycle || 0}</span>
            </div>
            <div className="flex justify-between border-b border-cyan-500/5 pb-0.5 text-[9px] tracking-tighter">
              <span className="opacity-40 uppercase font-black">WIRING_EVENT_LAST</span>
              <span className="text-white opacity-80">{organs.wiring.getEvents().length > 0 ? "STABLE" : "IDLE"}</span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[8px] font-bold tracking-widest uppercase opacity-60">
                  <span>CPU</span>
                  <span>{Math.round((metrics.cpu || 0) * 100)}%</span>
                </div>
                <div className="h-0.5 bg-cyan-900/40">
                  <motion.div animate={{ width: `${Math.round((metrics.cpu || 0) * 100)}%` }} className="h-full bg-cyan-500" />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[8px] font-bold tracking-widest uppercase opacity-60">
                  <span>MEM</span>
                  <span>{Math.round((metrics.memory || 0) * 100)}%</span>
                </div>
                <div className="h-0.5 bg-cyan-900/40">
                  <motion.div animate={{ width: `${Math.round((metrics.memory || 0) * 100)}%` }} className="h-full bg-cyan-500" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. ORGAN_HEALTH_PANEL */}
        <section className="col-span-3 row-span-5 bg-cyan-950/10 border border-cyan-500/20 p-3 flex flex-col gap-2 overflow-hidden">
          <h2 className="border-b border-cyan-500/20 pb-1 font-black tracking-widest uppercase text-cyan-400">Organ Health</h2>
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
            {['Repair', 'Deploy', 'Emotion', 'Reflex'].map(label => (
              <div key={label} className="bg-black/40 border border-cyan-500/5 p-1 px-2 flex justify-between">
                <span className="opacity-60 uppercase">{label}</span>
                <span className="text-emerald-500 font-bold">NOMINAL</span>
              </div>
            ))}
            <div className="mt-2 border-t border-cyan-500/10 pt-2 flex flex-col gap-1">
              <span className="text-[8px] opacity-40 uppercase">Event Stream:</span>
              {[...reflexEvents, ...federationEvents].slice(0, 3).map((e: any, i) => (
                <div key={i} className="text-[8px] truncate text-cyan-500/60 tracking-tighter">
                  [{e.channel || 'SYS'}] {JSON.stringify(e.payload || e).slice(0, 40)}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. MISSION_TIMELINE_PANEL */}
        <section className="col-span-6 row-span-6 bg-cyan-950/10 border border-cyan-500/20 p-3 flex flex-col gap-2 overflow-hidden">
          <div className="flex justify-between items-center border-b border-cyan-500/20 pb-1">
            <h2 className="font-black tracking-widest uppercase text-cyan-400">Mission Timeline</h2>
            <div className="flex gap-2">
              <button onClick={() => organs.wiring.broadcast("mission", { type: "accelerate" })} className="hover:bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 text-[8px] uppercase tracking-widest transition-colors">Accel</button>
              <button onClick={() => organs.wiring.broadcast("mission", { type: "decelerate" })} className="hover:bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 text-[8px] uppercase tracking-widest transition-colors">Decel</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {missions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center italic opacity-20 uppercase text-[9px] tracking-[0.2em]">Idle Sequence</div>
            ) : (
              missions.map(m => (
                <div key={m.id} className="bg-black/40 border border-cyan-500/10 p-2">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-white tracking-widest uppercase">{m.id}</span>
                    <span className="opacity-60 italic">{m.state}</span>
                  </div>
                  <div className="h-0.5 bg-cyan-900/40">
                    <motion.div animate={{ width: m.state === 'completed' ? '100%' : '45%' }} className="h-full bg-cyan-500 shadow-[0_0_8px_cyan]" />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 4. EMOTION_STATE_PANEL */}
        <section className="col-span-6 row-span-2 bg-cyan-950/10 border border-cyan-500/20 p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center border-b border-cyan-500/20 pb-1">
            <h2 className="font-black tracking-widest uppercase text-cyan-400">Emotion State</h2>
            <div className="flex gap-1">
              {['calm', 'focused', 'urgent'].map(e => (
                <button key={e} onClick={() => organs.wiring.broadcast("emotion", { type: "voice_modulation", emotion: e })} className="text-[8px] border border-cyan-500/20 px-1 uppercase opacity-60 hover:opacity-100">{e}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-between px-6">
            <div className="text-xl font-black text-white tracking-[0.5em] uppercase animate-pulse">{emotion}</div>
            <div className="flex gap-2">
              {voiceToneEvents.slice(0, 5).map((e, i) => (
                <div key={i} className="w-1 bg-cyan-500/40" style={{ height: (e.amplitude || 10) + 'px' }} />
              ))}
            </div>
          </div>
        </section>

        {/* 5. VOICE_CONSOLE_PANEL */}
        <section className="col-span-3 row-span-6 bg-cyan-950/10 border border-cyan-500/20 p-3 flex flex-col gap-2 overflow-hidden">
          <div className="flex justify-between items-center border-b border-cyan-500/20 pb-1">
            <h2 className="font-black tracking-widest uppercase text-cyan-400">Voice Console</h2>
            {!sensorsActive && <button onClick={() => organs.wiring.broadcast("voice", { type: "start_sensors" })} className="animate-pulse text-white text-[8px] border border-cyan-400 px-1 uppercase tracking-tighter">Sync</button>}
          </div>
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            <div className="flex-1 bg-black/60 p-2 overflow-y-auto italic text-cyan-300/60 border border-cyan-500/5">
              {voiceInputEvents[0]?.transcript || "Awaiting input..."}
            </div>
            <div className="flex-1 bg-black/60 p-2 overflow-y-auto flex flex-col gap-1 border border-cyan-500/5">
              <span className="text-[8px] opacity-40 uppercase">Parsed Commands:</span>
              {parsedCommands.slice(0, 3).map((p, i) => (
                <div key={i} className="text-[9px] text-cyan-400 tracking-tighter uppercase font-bold">
                  {p.intent || 'Unknown'} - {p.target || 'System'}
                </div>
              ))}
            </div>
            <button onClick={() => organs.wiring.broadcast("voice", { transcript: "UI_VOICE_PULSE" })} className="py-1 border border-cyan-500/20 hover:bg-cyan-500/10 transition-colors uppercase text-[9px] tracking-widest font-bold">Broadcast Pulse</button>
          </div>
        </section>

        {/* 6. REFLEX_ALERT_PANEL */}
        <section className="col-span-3 row-span-4 bg-cyan-950/10 border border-cyan-500/20 p-3 flex flex-col gap-2 overflow-hidden">
          <h2 className="border-b border-cyan-500/20 pb-1 font-black tracking-widest uppercase text-cyan-400">Reflex Alerts</h2>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            {reflexEvents.length === 0 ? (
              <div className="flex-1 flex items-center justify-center opacity-20 uppercase italic text-[9px]">Silent state</div>
            ) : (
              reflexEvents.map(e => (
                <div key={e.id} className="border-l-2 border-red-500 bg-red-500/5 p-1 px-2">
                  <div className="text-[9px] font-bold text-red-400 uppercase tracking-tighter truncate">{e.type}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 7. FEDERATION_PANEL */}
        <section className="col-span-3 row-span-4 bg-cyan-950/10 border border-cyan-500/20 p-3 flex flex-col gap-2 overflow-hidden">
          <div className="flex justify-between items-center border-b border-cyan-500/20 pb-1">
            <h2 className="font-black tracking-widest uppercase text-cyan-400">Federation</h2>
            <button onClick={() => organs.wiring.broadcast("federation", { type: "node_ping" })} className="hover:bg-cyan-500/20 border border-cyan-500/30 px-1 text-[8px] uppercase transition-colors">Ping</button>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            {federationNodes.map(n => (
              <div key={n.id} className="flex justify-between text-[9px] bg-black/40 p-1 px-2 border border-cyan-500/5">
                <span className="opacity-80 uppercase tracking-tighter">{n.id}</span>
                <span className={n.status === 'online' ? 'text-emerald-400 font-bold' : 'text-red-400'}>{n.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 8. WEB_EXECUTION_PANEL */}
        <section className="col-span-6 row-span-4 bg-cyan-950/10 border border-cyan-500/20 p-3 flex flex-col gap-2 overflow-hidden">
          <div className="flex justify-between items-center border-b border-cyan-500/20 pb-1">
            <h2 className="font-black tracking-widest uppercase text-cyan-400">Web Execution</h2>
            <button onClick={() => organs.wiring.broadcast("web", { type: "navigate", url: "https://google.com" })} className="hover:bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 text-[8px] uppercase tracking-widest transition-colors">Navigate</button>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
            <div className="flex flex-col gap-2 overflow-hidden">
              <span className="text-[8px] opacity-40 uppercase">Action Log:</span>
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
                {webEvents.map((e, i) => (
                  <div key={i} className="text-[9px] bg-black/40 border border-cyan-500/5 p-1 tracking-tighter truncate uppercase opacity-80">
                    {e.type} {e.url || ''}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-black/60 border border-cyan-500/20 flex flex-col items-center justify-center p-2 text-center opacity-40 grayscale">
              <div className="w-8 h-8 border border-cyan-500/20 rounded mb-1" />
              <span className="text-[8px] uppercase tracking-widest">Snapshot Buffer</span>
              <span className="text-[7px] tracking-widest opacity-60">IDLE</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
