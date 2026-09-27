import React from 'react';
import { motion } from 'motion/react';
import { AvatarState } from '../../types';

interface AvatarProps {
  state: AvatarState;
  isZoomed: boolean;
  onClick: () => void;
  speechText?: string | null;
}

export default function Avatar({ state, isZoomed, onClick, speechText }: AvatarProps) {
  // Define glow colors and animations based on state
  const stateConfigs = {
    idle: {
      color: 'rgba(6, 182, 212, 0.5)', // Cyan
      boxShadow: '0 0 50px rgba(6, 182, 212, 0.25)',
      ringColor: 'rgba(6, 182, 212, 0.4)',
      scale: [1, 1.03, 1],
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
    },
    processing: {
      color: 'rgba(59, 130, 246, 0.7)', // Blue
      boxShadow: '0 0 70px rgba(59, 130, 246, 0.5)',
      ringColor: 'rgba(59, 130, 246, 0.5)',
      scale: [1, 1.1, 1],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
    },
    alert: {
      color: 'rgba(239, 68, 68, 0.7)', // Red
      boxShadow: '0 0 70px rgba(239, 68, 68, 0.5)',
      ringColor: 'rgba(239, 68, 68, 0.6)',
      scale: [1, 1.08, 1],
      transition: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
    },
    success: {
      color: 'rgba(16, 185, 129, 0.7)', // Green
      boxShadow: '0 0 60px rgba(16, 185, 129, 0.4)',
      ringColor: 'rgba(16, 185, 129, 0.5)',
      scale: [1, 1.12, 1],
      transition: { duration: 2, repeat: Infinity, ease: 'easeOut' }
    },
    learning: {
      color: 'rgba(168, 85, 247, 0.7)', // Purple
      boxShadow: '0 0 60px rgba(168, 85, 247, 0.4)',
      ringColor: 'rgba(168, 85, 247, 0.5)',
      scale: [1, 1.06, 1],
      transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
    }
  };

  const config = stateConfigs[state];

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Speech balloon if speaking */}
      {speechText && !isZoomed && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute -top-24 z-50 max-w-sm px-4 py-2.5 rounded-2xl bg-black/80 border border-cyan-400/50 backdrop-blur-xl text-center shadow-[0_0_30px_rgba(6,182,212,0.3)] pointer-events-none"
        >
          <div className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase mb-0.5">CARTER // SYNTHETIC ENTITY</div>
          <div className="text-xs text-white font-mono font-medium leading-tight">{speechText}</div>
          <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-cyan-400/80" />
        </motion.div>
      )}

      {/* Main Avatar Entity */}
      <motion.div
        onClick={onClick}
        className={`relative cursor-pointer z-50 rounded-full flex items-center justify-center transition-all duration-700 select-none ${
          isZoomed 
            ? 'w-12 h-12 md:w-16 md:h-16 opacity-40 fixed top-4 left-4 md:top-8 md:left-8' 
            : 'w-28 h-28 md:w-36 md:h-36'
        }`}
        layout
        style={{
          boxShadow: isZoomed ? 'none' : config.boxShadow,
        }}
        animate={{ scale: isZoomed ? 1 : config.scale }}
        transition={isZoomed ? { duration: 0.6, ease: 'easeInOut' } : config.transition}
        title="Click to interact with Microfyxd Core Entity"
      >
        {/* Holographic outer orbital gyroscopes */}
        {!isZoomed && (
          <>
            <div 
              className="absolute -inset-4 rounded-full border border-cyan-500/20 animate-[spin_8s_linear_infinite] pointer-events-none" 
              style={{ borderColor: config.ringColor }}
            />
            <div 
              className="absolute -inset-8 rounded-full border border-cyan-400/10 animate-[spin_12s_linear_infinite_reverse] pointer-events-none" 
            />
          </>
        )}

        {/* Core sphere */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div 
            className="absolute inset-0 rounded-full opacity-85 mix-blend-screen transition-all duration-500"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${config.color} 0%, transparent 75%)`
            }}
          />
          
          {/* Swirling inner details */}
          <motion.div 
            className="absolute inset-[-50%] opacity-40"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, ${config.color} 90deg, transparent 180deg)`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
        </div>
        
        {/* Central Iris / Cognitive Core */}
        <div className={`rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner ${
          isZoomed ? 'w-5 h-5 md:w-6 md:h-6' : 'w-10 h-10 md:w-14 md:h-14'
        }`}>
          <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-white/80 animate-pulse shadow-[0_0_10px_#fff]" />
        </div>
      </motion.div>

      {/* State label below Avatar when in chamber */}
      {!isZoomed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-cyan-500/30 text-[9px] font-mono uppercase tracking-widest text-cyan-300"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>COGNITION: {state}</span>
        </motion.div>
      )}
    </div>
  );
}
