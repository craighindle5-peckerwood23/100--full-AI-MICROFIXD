import React from 'react';
import { motion } from 'motion/react';
import { Subsystem } from '../../types';
import { X } from 'lucide-react';
import TelemetryPanel from './TelemetryPanel';
import MissionControlRoom from './MissionControlRoom';
import AICoreRoom from './AICoreRoom';
import AgentsRoom from './AgentsRoom';
import SandboxRoom from './SandboxRoom';
import WorkspaceRoom from './WorkspaceRoom';
import InfraRoom from './InfraRoom';
import MemoryRoom from './MemoryRoom';
import LearningRoom from './LearningRoom';
import AutomationRoom from './AutomationRoom';
import { sound } from '../../utils/audio';

interface DeepRoomProps {
  subsystem: Subsystem;
  onClose: () => void;
}

export default function DeepRoom({ subsystem, onClose }: DeepRoomProps) {
  // Map subsystems to components
  const renderContent = () => {
    switch (subsystem) {
      case 'telemetry':
        return <TelemetryPanel />;
      case 'mission_control':
        return <MissionControlRoom />;
      case 'ai_core':
        return <AICoreRoom />;
      case 'agents':
        return <AgentsRoom />;
      case 'sandbox':
        return <SandboxRoom />;
      case 'workspace':
        return <WorkspaceRoom />;
      case 'infra':
        return <InfraRoom />;
      case 'memory':
        return <MemoryRoom />;
      case 'learning':
        return <LearningRoom />;
      case 'automation':
        return <AutomationRoom />;
      default:
        return null;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="absolute inset-0 z-40 flex items-center justify-center p-3 pt-16 pb-3 md:p-6 md:pt-20"
    >
      <div className="w-full max-w-7xl h-full bg-[#03070d]/90 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl overflow-hidden relative shadow-[0_0_120px_rgba(6,182,212,0.15)] flex flex-col">
        
        {/* Header bar */}
        <div className="h-14 md:h-16 border-b border-cyan-500/20 flex items-center justify-between px-4 md:px-6 bg-black/60 z-50 flex-shrink-0">
          <div className="flex items-center gap-3 md:gap-4 text-cyan-400 font-mono text-xs md:text-sm tracking-widest uppercase">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            <span className="font-bold text-white tracking-wider">MICROFYXD OS // {subsystem.replace('_', ' ')}</span>
            <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
              SYNTHETIC DEEP ROOM
            </span>
          </div>
          <button 
            onClick={() => { sound.playTick(); onClose(); }}
            className="w-10 h-10 rounded-full hover:bg-cyan-500/10 flex items-center justify-center text-cyan-400/70 hover:text-cyan-300 transition-colors border border-transparent hover:border-cyan-500/30"
            title="Return to Orbit Chamber (ESC)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-6 overflow-hidden min-h-0">
          {renderContent()}
        </div>
      </div>
    </motion.div>
  );
}

