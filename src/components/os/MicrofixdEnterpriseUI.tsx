import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SystemMonitorWidget } from './SystemMonitorWidget';
import { Layers, RotateCcw, Brain, Shield, Database, Activity, Terminal } from 'lucide-react';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import { operatorUX, TelemetryBus, db, RuntimeRun, MemoryRecord, SystemEvent, RuntimeStep } from '../../autonomy/Organism';

interface Props {
  onOpenSubsystems?: () => void;
  onReboot?: () => void;
}

export default function MicrofixdEnterpriseUI({ onOpenSubsystems, onReboot }: Props) {
  const [missionInput, setMissionInput] = useState('');
  
  const [runs, setRuns] = useState<RuntimeRun[]>([]);
  const [steps, setSteps] = useState<RuntimeStep[]>([]);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  
  useEffect(() => {
    const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
      const map = new Map<string, T>();
      for (const item of items) {
        if (item && item.id) {
          map.set(item.id, item);
        }
      }
      return Array.from(map.values());
    };

    const updateState = () => {
      const rawRuns = db.query<RuntimeRun>('runtimeruns', () => true);
      const rawSteps = db.query<RuntimeStep>('runtimesteps', () => true);
      const rawMemories = db.query<MemoryRecord>('memoryrecords', () => true);
      const rawEvents = db.query<SystemEvent>('systemevents', () => true);

      setRuns(dedupeById(rawRuns).slice(-5).reverse());
      setSteps(dedupeById(rawSteps).slice(-8).reverse());
      setMemories(dedupeById(rawMemories).slice(-5).reverse());
      setEvents(dedupeById(rawEvents).slice(-5).reverse());
    };
    
    updateState();
    
    // Subscribe to organism telemetry with cleanup
    const unsubs = [
      TelemetryBus.subscribe('state_update', updateState),
      TelemetryBus.subscribe('anomaly', updateState),
      TelemetryBus.subscribe('governance_decision', updateState),
      TelemetryBus.subscribe('system_event', updateState)
    ];
    
    return () => {
      unsubs.forEach(unsub => unsub?.());
    };
  }, []);

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionInput.trim()) return;
    
    sound.playTick();
    operatorUX.dispatchMission(missionInput);
    setMissionInput('');
  };

  return (
    <div className="min-h-screen bg-[#05070b] text-[#e8f4ff] font-sans flex flex-col p-3 md:p-5 select-none relative overflow-x-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#111827_0%,_#05070b_55%,_#020308_100%)] pointer-events-none" />
      
      {/* Top Header Controls Bar */}
      <header className="relative z-20 max-w-7xl w-full mx-auto flex items-center justify-between pb-3 mb-2 border-b border-[#1b2635]">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00f5ff] animate-pulse shadow-[0_0_10px_#00f5ff]" />
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold tracking-widest text-[#4fd1ff]">MICROFIXED L7 ORGANISM</span>
            <span className="text-[10px] text-[#7f9bb5]">Mission Console & Telemetry Bus</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenSubsystems && (
            <button onClick={onOpenSubsystems} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0b1018] border border-[#2b8fb8]/50 text-xs text-[#4fd1ff] hover:bg-[#111827] hover:border-[#00f5ff] transition shadow-[0_0_10px_rgba(79,209,255,0.15)] cursor-pointer">
              <Layers size={13} />
              <span>Orbit Rooms</span>
            </button>
          )}
          {onReboot && (
            <button onClick={onReboot} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0b1018] border border-[#1b2635] text-xs text-[#7f9bb5] hover:text-[#e8f4ff] hover:border-[#4fd1ff] transition cursor-pointer">
              <RotateCcw size={12} />
              <span className="hidden sm:inline">POST</span>
            </button>
          )}
        </div>
      </header>
      
      <main className="relative z-10 max-w-7xl w-full mx-auto flex flex-col gap-4 mt-2">
        
        {/* Mission Input Form */}
        <form onSubmit={handleDispatch} className="flex gap-2 bg-[#0b1018] border border-[#1b2635] p-2 rounded-xl shadow-lg">
          <input
            type="text"
            value={missionInput}
            onChange={(e) => setMissionInput(e.target.value)}
            placeholder="Initialize new objective for Attention Layer..."
            className="flex-1 bg-transparent border-none outline-none text-[#e8f4ff] px-3 font-mono text-sm placeholder:text-[#1b2635]"
          />
          <button type="submit" className="bg-[#4fd1ff] text-[#05070b] font-bold px-6 py-2 rounded-lg font-mono text-xs uppercase tracking-widest hover:bg-[#00f5ff] transition">
            Dispatch
          </button>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* LEFT COL: Runtime & Execution (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Runtime Runs */}
            <div className="bg-[#0b1018]/80 border border-[#1b2635] rounded-xl p-4 flex flex-col">
              <div className="flex items-center gap-2 border-b border-[#1b2635] pb-2 mb-3">
                <Activity size={14} className="text-[#4fff9a]" />
                <h3 className="text-xs font-mono font-bold tracking-widest text-[#7f9bb5] uppercase">Mission Engine (microfixdruntimeruns)</h3>
              </div>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin">
                <AnimatePresence>
                  {runs.map((run, idx) => (
                    <motion.div key={`run-${run.id || idx}`} initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="bg-[#111827] border border-[#1b2635] p-2.5 rounded-lg flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-[#4fd1ff]">{run.id.split('-')[0]}</span>
                        <span className={`px-2 py-0.5 rounded-full ${run.stage === 'running' ? 'bg-[#fcd34d]/20 text-[#fcd34d] animate-pulse' : 'bg-[#4fff9a]/20 text-[#4fff9a]'}`}>{run.stage}</span>
                      </div>
                      <div className="text-[11px] text-[#e8f4ff] truncate">Context: {run.context}</div>
                      <div className="flex justify-between text-[9px] text-[#7f9bb5]">
                        <span>Risk: {run.risk.toFixed(3)}</span>
                        <span>Operator: {run.operator}</span>
                      </div>
                    </motion.div>
                  ))}
                  {runs.length === 0 && <div className="text-xs text-[#7f9bb5] font-mono italic">No active missions in memory.</div>}
                </AnimatePresence>
              </div>
            </div>

            {/* Execution Steps */}
            <div className="bg-[#0b1018]/80 border border-[#1b2635] rounded-xl p-4 flex flex-col">
              <div className="flex items-center gap-2 border-b border-[#1b2635] pb-2 mb-3">
                <Terminal size={14} className="text-[#4fd1ff]" />
                <h3 className="text-xs font-mono font-bold tracking-widest text-[#7f9bb5] uppercase">Multi-Agent Runtime (microfixdruntimesteps)</h3>
              </div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                <AnimatePresence>
                  {steps.map((step, idx) => (
                    <motion.div key={`step-${step.id || idx}`} initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} className="bg-[#111827] border border-[#1b2635] p-2 rounded-lg flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="text-[10px] font-mono text-[#00f5ff]">[{step.agent}] <span className="text-[#7f9bb5]">executing {step.tool}</span></div>
                        <div className="text-[11px] text-[#e8f4ff] truncate">Input: {JSON.stringify(step.inputs)}</div>
                      </div>
                      <div className={`text-[9px] font-mono uppercase px-2 py-1 rounded border ${step.stage === 'completed' ? 'border-[#4fff9a]/50 text-[#4fff9a]' : 'border-[#fcd34d]/50 text-[#fcd34d]'}`}>
                        {step.stage}
                      </div>
                    </motion.div>
                  ))}
                  {steps.length === 0 && <div className="text-xs text-[#7f9bb5] font-mono italic">Runtime idle.</div>}
                </AnimatePresence>
              </div>
            </div>

          </div>

          {/* RIGHT COL: Memory & Telemetry (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Memory Engine */}
            <div className="bg-[#0b1018]/80 border border-[#1b2635] rounded-xl p-4 flex flex-col flex-1">
              <div className="flex items-center gap-2 border-b border-[#1b2635] pb-2 mb-3">
                <Brain size={14} className="text-[#fcd34d]" />
                <h3 className="text-xs font-mono font-bold tracking-widest text-[#7f9bb5] uppercase">Memory Engine (microfixdmemoryrecords)</h3>
              </div>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin">
                <AnimatePresence>
                  {memories.map((mem, idx) => (
                    <motion.div key={`mem-${mem.id || idx}`} initial={{opacity:0}} animate={{opacity:1}} className="border-l-2 border-[#fcd34d] bg-[#111827] p-2 rounded-r-lg">
                      <div className="text-[9px] text-[#fcd34d] font-mono uppercase mb-1">{mem.type} MEMORY</div>
                      <div className="text-[11px] text-[#e8f4ff]">{mem.content}</div>
                    </motion.div>
                  ))}
                  {memories.length === 0 && <div className="text-xs text-[#7f9bb5] font-mono italic">No memory records found.</div>}
                </AnimatePresence>
              </div>
            </div>

            {/* Governance / Safety */}
            <div className="bg-[#0b1018]/80 border border-[#1b2635] rounded-xl p-4 flex flex-col flex-1">
              <div className="flex items-center gap-2 border-b border-[#1b2635] pb-2 mb-3">
                <Shield size={14} className="text-[#ff4f4f]" />
                <h3 className="text-xs font-mono font-bold tracking-widest text-[#7f9bb5] uppercase">System Events & Governance</h3>
              </div>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin">
                <AnimatePresence>
                  {events.map((ev, idx) => (
                    <motion.div key={`ev-${ev.id || idx}`} initial={{opacity:0}} animate={{opacity:1}} className="bg-[#111827] border border-[#1b2635] p-2 rounded-lg">
                      <div className={`text-[10px] font-mono font-bold ${ev.type === 'anomaly' || ev.type === 'emergency_stop' ? 'text-[#ff4f4f]' : 'text-[#4fd1ff]'}`}>
                        [{ev.type.toUpperCase()}]
                      </div>
                      <div className="text-[11px] text-[#e8f4ff] mt-0.5">{ev.details}</div>
                    </motion.div>
                  ))}
                  {events.length === 0 && <div className="text-xs text-[#7f9bb5] font-mono italic">No system events logged.</div>}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="flex-1 bg-[#05070b]/90 border border-[#1b2635] rounded-xl p-3 flex flex-col">
              <SystemMonitorWidget />
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
