import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';
import { 
  FastForward, 
  Cpu, 
  Database, 
  Radio, 
  ShieldCheck, 
  Mic, 
  CheckCircle2, 
  Terminal,
  Activity
} from 'lucide-react';
interface DiagnosticStep {
  label: string;
  detail: string;
  threshold: number;
  icon: React.ElementType;
}

const DIAGNOSTIC_STEPS: DiagnosticStep[] = [
  { label: 'Hardware POST & Tensor Engine', detail: '8x NVIDIA H100 SXM5 / 640GB HBM3e memory map verified', threshold: 18, icon: Cpu },
  { label: 'Microkernel Initialization', detail: 'Microfyxd Zero-Trust Kernel v6.2.0 loaded into ring-0', threshold: 38, icon: Activity },
  { label: 'Supabase Cloud Backend Link', detail: 'Connecting to distributed PostgreSQL & persistent logs', threshold: 58, icon: Database },
  { label: 'Omni LLM Router Matrix', detail: 'Juggling Groq, Gemini & DeepSeek API key fallback chains', threshold: 78, icon: Radio },
  { label: 'Synthetic Voice Feedback Subsystem', detail: 'Web Speech & neural synthesis pipeline mounted', threshold: 92, icon: Mic },
  { label: 'Constitutional Safety & Federation', detail: 'Chapter 15 Ethical Directives & MCP peer mesh active', threshold: 100, icon: ShieldCheck }
];

interface BootSequenceProps {
  onComplete?: () => void;
}

export default function BootSequence({ onComplete }: BootSequenceProps = {}) {
  const [bootCompleted, setBootCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('SYSTEM BOOT INITIATED // POWER ON RESET');
  const [logs, setLogs] = useState<string[]>([
    '[0.0001] BIOS: POST passed. Unified hardware topology verified.',
    '[0.0014] ACPI: DMAR tables parsed. IOMMU enabled with memory isolation.'
  ]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    let currentP = 0;
    const interval = setInterval(() => {
      // Simulate authentic OS boot speed curve (starts fast, holds slightly on driver links, then accelerates)
      const increment = currentP < 25 ? 2.5 : currentP < 60 ? 1.8 : currentP < 85 ? 2.2 : 3.5;
      currentP = Math.min(100, currentP + increment);
      setProgress(Math.round(currentP));

      // Append real-time diagnostic logs as progress crosses milestones
      if (currentP >= 15 && currentP < 18) {
        sound.playTick();
        setLogs(prev => [...prev, '[0.0120] CPU: 64 Core Synthetic Tensor Vector Units online at 4.2GHz']);
      } else if (currentP >= 35 && currentP < 38) {
        sound.playTick();
        setCurrentStatus('KERNEL RING-0 ONLINE // MICROFYXD MICROKERNEL 6.2');
        setLogs(prev => [...prev, '[0.0482] KERNEL: Microkernel v6.2.0 initialized. Zero-trust isolation active.']);
      } else if (currentP >= 55 && currentP < 58) {
        sound.playTick();
        setCurrentStatus('SUPABASE CLIENT PERSISTENCE // SYNC HANDSHAKE');
        setLogs(prev => [...prev, '[0.0890] SUPABASE: Connected to persistent database & audit logs engine.']);
      } else if (currentP >= 75 && currentP < 78) {
        sound.playTick();
        setCurrentStatus('OMNI LLM ROUTER INITIALIZED // GROQ + GEMINI + DEEPSEEK');
        setLogs(prev => [...prev, '[0.1340] OMNI.ROUTER: Juggling Groq, Gemini & DeepSeek API key fallback chain.']);
      } else if (currentP >= 90 && currentP < 93) {
        sound.playTick();
        setCurrentStatus('SYNTHETIC VOICE FEEDBACK // NEURAL AUDIO ACTIVE');
        setLogs(prev => [...prev, '[0.1760] VOICE: Web Speech Synthesis mounted. Audio feedback enabled.']);
      }

      if (currentP >= 100) {
        clearInterval(interval);
        sound.playSuccess();
        setCurrentStatus('LEVEL 6 SYNTHETIC AI OS ONLINE // ENTERING CHAMBER');
        setLogs(prev => [...prev, '[0.2100] SYSTEM READY: All subsystems nominal. Launching OS Shell.']);

        // Speak boot completion
        setTimeout(() => {
          voice.speak('Microfyxd OS Kernel 6.2 loaded. Synthetic voice feedback active. All systems nominal.');
        }, 300);

        setTimeout(() => {
          if (onComplete) {
            onComplete();
          } else {
            setBootCompleted(true);
          }
        }, 900);
      }
    }, 45);

    return () => clearInterval(interval);
  }, [onComplete]);

  const handleSkip = () => {
    sound.playSuccess();
    voice.speak('Fast boot sequence engaged.');
    if (onComplete) {
      onComplete();
    } else {
      setBootCompleted(true);
    }
  };

  if (bootCompleted) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-[#020509] overflow-hidden flex flex-col items-center justify-between font-mono text-cyan-400 select-none p-4 md:p-8">
      {/* Background cyber grid & scanner line */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      
      {/* Laser scanline animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ y: ['-100%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-full h-24 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent opacity-60"
        />
      </div>

      {/* Top Header during boot */}
      <div className="w-full z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_rgba(6,182,212,1)]" />
          <div className="text-xs tracking-widest text-cyan-200">
            <span className="font-bold">MICROFYXD OS</span>
            <span className="text-cyan-500/80 ml-2">// KERNEL v6.2.0 POST</span>
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-xs text-cyan-300 hover:bg-cyan-900/60 hover:border-cyan-300 transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)]"
        >
          <FastForward size={13} />
          <span>Fast Boot (Skip)</span>
        </button>
      </div>

      {/* Center Boot Hub */}
      <div className="relative z-20 w-full max-w-2xl flex flex-col items-center gap-6 my-auto">
        {/* Animated Modern OS Logo Badge */}
        <div className="relative flex items-center justify-center">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center relative shadow-[0_0_50px_rgba(6,182,212,0.25)] backdrop-blur-md">
            {/* Outer spinning dash ring */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-[-8px] rounded-3xl border border-dashed border-cyan-500/30 pointer-events-none"
            />
            {/* Counter-rotating accent ring */}
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-[-18px] rounded-full border border-dotted border-cyan-400/20 pointer-events-none"
            />

            {/* Glowing Hexagon Core */}
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black tracking-tighter text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]">
                MFX
              </span>
              <span className="text-[9px] font-bold text-cyan-400 tracking-widest mt-0.5">
                LEVEL 6 AI
              </span>
            </div>
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center space-y-1">
          <h1 className="text-lg md:text-xl font-bold tracking-wider text-white">
            MICROFYXD SYNTHETIC OS
          </h1>
          <p className="text-xs text-cyan-400/80 tracking-widest h-5">
            {currentStatus}
          </p>
        </div>

        {/* Enhanced Modern Progress Bar */}
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs text-cyan-300">
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              SYSTEM COMPONENT INITIALIZATION
            </span>
            <span className="font-bold text-sm tracking-widest text-cyan-200">
              {progress}%
            </span>
          </div>

          {/* Outer Track */}
          <div className="w-full h-3 rounded-full bg-cyan-950/80 border border-cyan-500/40 p-0.5 relative overflow-hidden shadow-[inset_0_0_12px_rgba(0,0,0,0.8)]">
            {/* Inner Glowing Progress Bar */}
            <motion.div 
              className="h-full rounded-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-indigo-400 relative"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.1 }}
            >
              {/* Scan reflection */}
              <div className="absolute inset-0 bg-white/30 animate-pulse" />
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white rounded-full shadow-[0_0_10px_#fff]" />
            </motion.div>
          </div>
        </div>

        {/* Diagnostic Check Matrix */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          {DIAGNOSTIC_STEPS.map((step, idx) => {
            const isDone = progress >= step.threshold;
            const isCurrent = progress < step.threshold && (idx === 0 || progress >= DIAGNOSTIC_STEPS[idx - 1].threshold);
            const Icon = step.icon;

            return (
              <div 
                key={step.label}
                className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all ${
                  isDone 
                    ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200' 
                    : isCurrent 
                    ? 'bg-cyan-900/30 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                    : 'bg-black/30 border-cyan-950 text-cyan-700'
                }`}
              >
                <div className="mt-0.5">
                  {isDone ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : (
                    <Icon size={13} className={isCurrent ? 'text-cyan-400 animate-pulse' : 'text-cyan-800'} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center justify-between">
                    <span className="truncate">{step.label}</span>
                    <span className="text-[9px] font-mono opacity-80">
                      {isDone ? '[READY]' : isCurrent ? '[LOADING]' : '[STANDBY]'}
                    </span>
                  </div>
                  <p className="text-[9px] text-cyan-400/60 truncate mt-0.5">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-time Diagnostic Terminal Log Box */}
        <div className="w-full rounded-xl bg-black/80 border border-cyan-500/30 p-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5 mb-2 text-[10px] text-cyan-500/80">
            <span className="flex items-center gap-1.5">
              <Terminal size={12} className="text-cyan-400" />
              MICROKERNEL BOOT LOG STREAM
            </span>
            <span>RING-0 ARCHITECTURE</span>
          </div>
          <div 
            ref={logContainerRef}
            className="h-20 overflow-y-auto space-y-1 font-mono text-[10px] text-cyan-300/80 scrollbar-thin scrollbar-thumb-cyan-700/40"
          >
            {logs.map((log, i) => (
              <div key={i} className="leading-tight">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="w-full z-20 text-center text-[10px] text-cyan-500/50 flex items-center justify-between">
        <span>MICROFYXD OS // SYNTHETIC INTELLIGENCE RUNTIME</span>
        <span className="hidden sm:inline">LEVEL 6 CERTIFIED COGNITIVE LATTICE</span>
        <span>BUILD 2026.09-L6</span>
      </div>
    </div>
  );
}
