import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Target, 
  Brain, 
  Cpu, 
  Box, 
  Layout, 
  Server, 
  Activity, 
  Database, 
  GraduationCap, 
  Zap 
} from 'lucide-react';
import { Subsystem } from '../../types';
import { sound } from '../../utils/audio';

interface OrbitRingProps {
  activeSubsystem: Subsystem | null;
  onSelect: (subsystem: Subsystem) => void;
}

const NODES: { id: Subsystem; icon: React.ElementType; label: string }[] = [
  { id: 'mission_control', icon: Target, label: 'Mission Control' },
  { id: 'ai_core', icon: Brain, label: 'AI Core' },
  { id: 'agents', icon: Cpu, label: 'Agents' },
  { id: 'sandbox', icon: Box, label: 'Sandbox' },
  { id: 'workspace', icon: Layout, label: 'Workspace' },
  { id: 'infra', icon: Server, label: 'System Infra' },
  { id: 'telemetry', icon: Activity, label: 'Telemetry' },
  { id: 'memory', icon: Database, label: 'Memory' },
  { id: 'learning', icon: GraduationCap, label: 'Learning' },
  { id: 'automation', icon: Zap, label: 'Automation' },
];

export default function OrbitRing({ activeSubsystem, onSelect }: OrbitRingProps) {
  const [radius, setRadius] = useState(220);

  useEffect(() => {
    const handleResize = () => {
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      // Adjust radius dynamically based on screen size, with min 120px and max 280px
      const newRadius = Math.max(120, Math.min(280, (minDimension / 2) - 80));
      setRadius(newRadius);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalNodes = NODES.length;
  const diameter = radius * 2;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
      animate={{ opacity: activeSubsystem ? 0 : 1, scale: activeSubsystem ? 1.5 : 1, rotate: activeSubsystem ? 45 : 0 }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ pointerEvents: activeSubsystem ? 'none' : 'auto' }}
    >
      {/* Orbital Path */}
      <div 
        className="absolute rounded-full border border-cyan-500/10 transition-all duration-300" 
        style={{ width: diameter, height: diameter }} 
      />
      <div 
        className="absolute rounded-full border border-cyan-400/5 rotate-45 transition-all duration-300" 
        style={{ width: diameter, height: diameter }} 
      />

      {/* Nodes */}
      {NODES.map((node, index) => {
        const angle = (index / totalNodes) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const Icon = node.icon;

        // Smaller icons on small screens
        const iconSize = radius < 150 ? 16 : 20;
        const btnSize = radius < 150 ? 'w-10 h-10' : 'w-12 h-12';
        const lblTop = radius < 150 ? 'top-12' : 'top-14';

        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x, y }}
            transition={{ delay: 1 + index * 0.1, x: { duration: 0.3 }, y: { duration: 0.3 } }}
            className="absolute flex flex-col items-center justify-center group"
          >
            <button
              onClick={() => { sound.playWarp(); onSelect(node.id); }}
              onMouseEnter={() => sound.playTick()}
              className={`${btnSize} rounded-full bg-black/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:scale-115 hover:bg-cyan-500/20 hover:border-cyan-300 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] pointer-events-auto relative`}
              title={`${node.label} (Press ${index === 9 ? '0' : index + 1})`}
            >
              <Icon size={iconSize} />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 border border-cyan-500/40 text-[8px] flex items-center justify-center text-cyan-300/70 font-mono">
                {index === 9 ? '0' : index + 1}
              </span>
            </button>
            <div className={`absolute ${lblTop} text-[9px] md:text-[10px] uppercase tracking-widest text-cyan-300 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap bg-black/70 px-2 py-0.5 rounded border border-cyan-500/20 pointer-events-none`}>
              {node.label}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
