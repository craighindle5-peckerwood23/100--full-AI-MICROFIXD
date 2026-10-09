import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  Activity, 
  Layers, 
  Terminal
} from 'lucide-react';
import { Mission, MissionNode } from '../../types';
import { api } from '../../lib/serverApi';
import type { Mission as DurableMission, Task, Artifact } from '../../../server/planner/executionSpine';
import { sound } from '../../utils/audio';

export default function MissionControlRoom() {
  const [missions,setMissions]=useState<Mission[]>([]);
  const [selectedMissionId,setSelectedMissionId]=useState('');
  const [showNewModal,setShowNewModal]=useState(false);
  const [newTitle,setNewTitle]=useState('');
  const [newObjective,setNewObjective]=useState('');
  const [error,setError]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [submissionKey,setSubmissionKey]=useState<string|null>(null);
  const mapMission=(m:DurableMission):Mission=>({id:m.mission_id,codeName:m.mission_id,title:m.objective.slice(0,80),objective:m.objective,status:m.status==='succeeded'?'completed':m.status==='waiting'?'paused':m.status as Mission['status'],progress:m.status==='succeeded'?100:0,priority:'HIGH',assignedSquad:[],nodes:[],logs:[`Persisted state: ${m.status}`],createdAt:m.created_at});
  useEffect(()=>{
    let stopped=false;
    const refresh=async()=>{try{
      const result=await api<{missions:DurableMission[]}>('GET','/planner/missions');
      if(stopped)return;
      const mapped=result.missions.map(mapMission);
      if(selectedMissionId){const detail=await api<{mission:DurableMission;tasks:Task[];artifacts:Artifact[]}>('GET',`/planner/missions/${selectedMissionId}`);
       const current=mapped.find(m=>m.id===selectedMissionId);
       if(current){current.nodes=detail.tasks.map(t=>({id:t.task_id,label:String(t.input_context.objective??'Task'),type:'task',status:t.status==='succeeded'?'completed':t.status==='running'?'running':'pending',assignedAgent:t.agent_id??'Planner'}));
        current.progress=detail.tasks.length?Math.round(detail.tasks.filter(t=>t.status==='succeeded').length/detail.tasks.length*100):0;
        current.logs=detail.artifacts.filter(a=>a.subtask_id).map(a=>JSON.stringify(a.content));}}
      if(!stopped){setMissions(mapped);setError('');if(!selectedMissionId&&mapped.length)setSelectedMissionId(mapped[0].id);}
    }catch(e){if(!stopped)setError(e instanceof Error?e.message:'Mission service unavailable');}};
    void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>{stopped=true;clearInterval(timer);};
  },[selectedMissionId]);
  const currentMission=missions.find(m=>m.id===selectedMissionId)??missions[0]??{id:'',codeName:'',title:'No submitted missions',objective:'Submit a mission to begin durable execution.',status:'queued',progress:0,priority:'HIGH',assignedSquad:[],nodes:[],logs:[],createdAt:''} as Mission;
  const handleToggleState=()=>{};
  const advanceStep=()=>{};
  const handleCreateMission=async(e:React.FormEvent)=>{e.preventDefault();if(submitting||!newObjective.trim())return;setSubmitting(true);
   const key=submissionKey??crypto.randomUUID();setSubmissionKey(key);
   try{const m=await api<DurableMission>('POST','/planner/missions',{objective:newObjective},{'Idempotency-Key':key});setMissions(prev=>[mapMission(m),...prev.filter(v=>v.id!==m.mission_id)]);setSelectedMissionId(m.mission_id);setShowNewModal(false);setNewObjective('');setNewTitle('');setSubmissionKey(null);setError('');}catch(e){setError(e instanceof Error?e.message:'Submission failed');}finally{setSubmitting(false);}};

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
      {/* Top Banner Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Layers className="text-cyan-400" size={18} />
          <span className="text-sm font-semibold tracking-wider text-white">MISSION ORCHESTRATOR // CHAPTER 4</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            DURABLE REASONING
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs text-white transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            <Plus size={14} /> Plan Mission
          </button>
        </div>
      </div>

      {/* Main Grid: Mission List (Left) & Mission DAG / Logs (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Mission Directory */}
        <div className="lg:col-span-4 flex flex-col gap-2 overflow-y-auto pr-1">
          <div className="text-[11px] uppercase tracking-widest text-cyan-500/60 mb-1 flex items-center justify-between">
            <span>Active Missions ({missions.length})</span>
            <span className="text-[10px]">Real-time DAG</span>
          </div>

          {missions.map(mission => {
            const isSelected = mission.id === selectedMissionId;
            return (
              <div
                key={mission.id}
                onClick={() => {
                  sound.playTick();
                  setSelectedMissionId(mission.id);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-cyan-950/40 border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.15)]' 
                    : 'bg-black/40 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-black/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-white tracking-wide truncate">{mission.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                    mission.status === 'running' 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse' 
                      : mission.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                  }`}>
                    {mission.status}
                  </span>
                </div>
                <div className="text-[11px] text-cyan-400/60 line-clamp-2 mb-2">
                  {mission.objective}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-cyan-950 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-400 transition-all duration-500" 
                      style={{ width: `${mission.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-cyan-300 font-semibold">{mission.progress}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Active Mission DAG & Interactive Graph */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Mission Details Header */}
          <div className="border border-cyan-500/30 rounded-2xl bg-black/60 p-4 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <div className="text-[10px] text-cyan-500/70 uppercase tracking-widest">
                  MISSION IDENTIFIER: {currentMission.codeName}
                </div>
                <h3 className="text-lg text-white font-bold tracking-wide">{currentMission.title}</h3>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  disabled
                  title="Execution is owned by the server worker"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 text-xs text-white"
                >
                  {currentMission.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                  {currentMission.status === 'running' ? 'Pause Mission' : 'Execute Mission'}
                </button>
                <button
                  onClick={() => {
                    sound.playTick();
                    setMissions(prev => prev.map(m => m.id === currentMission.id ? { ...m, progress: 0, status: 'queued', nodes: m.nodes.map(n => ({ ...n, status: 'pending' })) } : m));
                  }}
                  className="p-1.5 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-400"
                  disabled title="Reset is unavailable for durable missions"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            <p className="text-xs text-cyan-200/80 mb-3">{currentMission.objective}</p>

            <div className="flex flex-wrap gap-4 text-[11px] text-cyan-500/70 border-t border-cyan-500/10 pt-2">
              <span>PRIORITY: <strong className="text-white">{currentMission.priority}</strong></span>
              <span>SQUAD: <strong className="text-cyan-300">{currentMission.assignedSquad.join(' • ')}</strong></span>
              <span>CREATED: <strong className="text-white">{currentMission.createdAt}</strong></span>
            </div>
          </div>

          {/* Interactive DAG Workflow Visualizer */}
          <div className="border border-cyan-500/30 rounded-2xl bg-black/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-white font-semibold uppercase tracking-wider">
                <Activity size={14} className="text-cyan-400" />
                Directed Acyclic Graph (DAG) Execution Matrix
              </div>
              <span className="text-[10px] text-cyan-400/60">Persisted task status</span>
            </div>

            {/* Visual Node Chain */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
              {currentMission.nodes.map((node, idx) => {
                const isDone = node.status === 'completed';
                const isRunning = node.status === 'running';

                return (
                  <motion.div
                    key={node.id}
                    
                    whileHover={{ scale: 1.02 }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isDone 
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                        : isRunning 
                        ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse'
                        : 'bg-black/50 border-cyan-500/20 text-cyan-500/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/40 border border-cyan-500/20 text-cyan-300 uppercase">
                        {node.type}
                      </span>
                      {isDone ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : isRunning ? (
                        <Activity size={14} className="text-cyan-400 animate-spin" />
                      ) : (
                        <Clock size={14} className="text-cyan-500/40" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-white mb-1.5">{node.label}</div>
                    <div className="text-[10px] text-cyan-400/60 flex items-center justify-between">
                      <span>{node.assignedAgent || 'Auto-Kernel'}</span>
                      <span>{node.duration || '--'}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Mission Real-Time Log Feed */}
          <div className="border border-cyan-500/20 rounded-2xl bg-black/50 p-3 flex flex-col flex-1 min-h-[140px]">
            <div className="flex items-center gap-2 text-xs text-cyan-400 font-semibold mb-2">
              <Terminal size={14} />
              <span>MISSION TELEMETRY AUDIT TRAIL</span>
            </div>
            <div className="overflow-y-auto space-y-1 text-[11px] text-cyan-300/80 pr-1 flex-1 font-mono">
              {currentMission.logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-cyan-500/40">›</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Planning New Mission */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-black border border-cyan-500/40 rounded-2xl p-5 shadow-[0_0_50px_rgba(6,182,212,0.3)]"
          >
            <h3 className="text-base font-bold text-white mb-1">PLAN NEW SYNTHETIC MISSION</h3>
            <p className="text-xs text-cyan-400/60 mb-4">Carter Cognitive Engine will decompose objective into an autonomous DAG.</p>
            <form onSubmit={handleCreateMission} className="space-y-3">
              <div>
                <label className="text-xs text-cyan-300 block mb-1">Mission Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Cluster Thermal Rebalance"
                  className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-cyan-300 block mb-1">Objective & Constraints</label>
                <textarea
                  value={newObjective}
                  onChange={e => setNewObjective(e.target.value)}
                  placeholder="Describe goal, safety parameters, and expected outcome..."
                  rows={3}
                  className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-cyan-500/20 text-xs text-cyan-400 hover:bg-cyan-500/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                >
                  Dispatch to DAG
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
