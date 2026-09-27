import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  GraduationCap, 
  Sparkles, 
  TrendingDown, 
  RotateCw, 
  CheckCircle2, 
  Activity, 
  Cpu 
} from 'lucide-react';
import { LearningCycle } from '../../types';
import { INITIAL_LEARNING_CYCLES } from '../../data/osData';
import { sound } from '../../utils/audio';

export default function LearningRoom() {
  const [cycles, setCycles] = useState<LearningCycle[]>(INITIAL_LEARNING_CYCLES);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(INITIAL_LEARNING_CYCLES[0].id);
  const [isReflecting, setIsReflecting] = useState(false);

  const selectedCycle = cycles.find(c => c.id === selectedCycleId) || cycles[0];

  const handleTriggerReflection = async () => {
    sound.playWarp();
    setIsReflecting(true);
    await new Promise(r => setTimeout(r, 1200));

    const nextEpoch = cycles[0].epoch + 1;
    const newCycle: LearningCycle = {
      id: `lrn-${Date.now().toString().slice(-3)}`,
      epoch: nextEpoch,
      topic: 'LangGraph Autonomous Node Pruning Optimization',
      metaReflection: `Cycle ${nextEpoch} complete: Reduced token overhead by 6.2% by caching invariant constitutional directive embeddings. Zero drift across 10,000 continuous benchmark samples.`,
      heuristicDelta: '+6.2% Token Efficiency',
      lossValue: +(selectedCycle.lossValue * 0.92).toFixed(4),
      status: 'converging',
      timestamp: new Date().toLocaleTimeString()
    };

    setCycles(prev => [newCycle, ...prev]);
    setSelectedCycleId(newCycle.id);
    setIsReflecting(false);
    sound.playCognitivePulse();
  };

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">CONTINUAL LEARNING & META-COGNITION // CHAPTER 11</span>
          <span className="px-2 py-0.5 text-[10px] bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300">
            LEVEL 6 ADAPTIVE LOOPS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerReflection}
            disabled={isReflecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-xs text-white disabled:opacity-50 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            <Sparkles size={13} className={isReflecting ? 'animate-spin' : ''} />
            {isReflecting ? 'Reflecting on Performance...' : 'Trigger Meta-Reflection'}
          </button>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-black/50 border border-cyan-500/20">
          <div className="flex items-center justify-between text-[10px] text-cyan-500/60 uppercase mb-1">
            <span>Loss Convergence</span>
            <TrendingDown size={14} className="text-emerald-400" />
          </div>
          <span className="text-2xl text-emerald-300 font-bold">{selectedCycle.lossValue.toFixed(4)}</span>
          <span className="text-[10px] text-cyan-400/70 block mt-1">Cross-Entropy Loss (Optimal &lt; 0.02)</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-black/50 border border-cyan-500/20">
          <div className="flex items-center justify-between text-[10px] text-cyan-500/60 uppercase mb-1">
            <span>Heuristic Accuracy Delta</span>
            <Activity size={14} className="text-cyan-400" />
          </div>
          <span className="text-2xl text-white font-bold">{selectedCycle.heuristicDelta}</span>
          <span className="text-[10px] text-cyan-400/70 block mt-1">Autonomous Graph Improvement</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-black/50 border border-cyan-500/20">
          <div className="flex items-center justify-between text-[10px] text-cyan-500/60 uppercase mb-1">
            <span>Model Drift Guard</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <span className="text-2xl text-cyan-300 font-bold">0.00% Drift</span>
          <span className="text-[10px] text-emerald-400 block mt-1">Constitutional Anchoring Intact</span>
        </div>
      </div>

      {/* Main Grid: Learning Cycles History & Meta-Cognitive Trace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Epoch History List */}
        <div className="lg:col-span-5 flex flex-col gap-2 overflow-y-auto pr-1">
          <div className="text-[11px] uppercase tracking-widest text-cyan-500/60 mb-1">
            Reflection Epochs ({cycles.length})
          </div>

          {cycles.map(cycle => {
            const isSelected = cycle.id === selectedCycleId;
            return (
              <div
                key={cycle.id}
                onClick={() => { sound.playTick(); setSelectedCycleId(cycle.id); }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'bg-black/40 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-black/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-white tracking-wide">Epoch #{cycle.epoch}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold bg-cyan-900/40 border border-cyan-500/30 text-cyan-300">
                    {cycle.status}
                  </span>
                </div>
                <div className="text-[11px] text-cyan-300/80 truncate mb-1">{cycle.topic}</div>
                <div className="flex items-center justify-between text-[10px] text-cyan-500/60 border-t border-cyan-500/10 pt-1">
                  <span>Loss: <strong className="text-emerald-400">{cycle.lossValue}</strong></span>
                  <span>{cycle.timestamp}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Meta-Cognitive Dossier */}
        <div className="lg:col-span-7 flex flex-col border border-cyan-500/30 rounded-2xl bg-black/60 p-4 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <span className="text-[10px] text-cyan-500/70 uppercase tracking-widest">
                META-COGNITIVE REFLECTION // EPOCH {selectedCycle.epoch}
              </span>
              <h3 className="text-lg text-white font-bold tracking-wide">{selectedCycle.topic}</h3>
            </div>
            <span className="text-xs text-cyan-400/70">{selectedCycle.timestamp}</span>
          </div>

          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/20 mb-4">
            <span className="text-[10px] text-cyan-500/70 uppercase tracking-wider block mb-1">
              Synthetic Self-Reflection Analysis
            </span>
            <p className="text-xs text-white/90 leading-relaxed font-sans">{selectedCycle.metaReflection}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
              <span className="text-[10px] text-cyan-500/60 block uppercase mb-1">Heuristic Delta</span>
              <span className="text-white font-bold">{selectedCycle.heuristicDelta}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20">
              <span className="text-[10px] text-cyan-500/60 block uppercase mb-1">Constitutional Convergence</span>
              <span className="text-emerald-400 font-bold">100% Boundary Safety</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
