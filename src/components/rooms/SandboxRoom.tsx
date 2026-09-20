import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Box, 
  Play, 
  ShieldCheck, 
  Terminal, 
  RotateCcw, 
  Code2, 
  Layers, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { SandboxWorkspace, SandboxJob } from '../../types';
import { INITIAL_SANDBOX } from '../../data/osData';
import { sound } from '../../utils/audio';

const CODE_TEMPLATES = {
  python: `# Microfyxd Level 6 Analytical Kernel
import math, sys

def compute_cosine_affinity(vector_a, vector_b):
    dot = sum(a * b for a, b in zip(vector_a, vector_b))
    norm_a = math.sqrt(sum(a * a for a in vector_a))
    norm_b = math.sqrt(sum(b * b for b in vector_b))
    return dot / (norm_a * norm_b + 1e-9)

query_embedding = [0.82, 0.14, 0.95, 0.44, 0.61]
memory_embedding = [0.80, 0.12, 0.98, 0.41, 0.63]

similarity = compute_cosine_affinity(query_embedding, memory_embedding)
print(f"Memory Shard Cosine Affinity: {similarity:.4f}")
print("Constitutional Sandbox Constraint: Memory boundary isolation validated.")
`,
  rust: `// Microfyxd WASM Microkernel Runtime
pub fn verify_directive_bounds(directive_id: u32, hash: [u8; 8]) -> bool {
    // Zero memory leak evaluation
    let is_valid = directive_id > 0 && directive_id <= 14;
    println!("Evaluating Directive ID {} with Hash {:?}", directive_id, hash);
    is_valid
}

fn main() {
    let result = verify_directive_bounds(3, [0x06, 0x18, 0x21, 0x2a, 0x00, 0x5a, 0x7c, 0x9f]);
    println!("Directive 3 Status: STRICT_SANDBOX_VERIFIED = {}", result);
}
`
};

export default function SandboxRoom() {
  const [workspaces, setWorkspaces] = useState<SandboxWorkspace[]>(INITIAL_SANDBOX);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(INITIAL_SANDBOX[0].id);
  const [activeLanguage, setActiveLanguage] = useState<'python' | 'rust'>('python');
  const [code, setCode] = useState<string>(CODE_TEMPLATES.python);
  const [consoleOutput, setConsoleOutput] = useState<string>(
    "WASM Microkernel Ready. Isolated process environment bound to Virtual Mount /proc/sys/isolated."
  );
  const [isRunning, setIsRunning] = useState(false);

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  const handleSelectLanguage = (lang: 'python' | 'rust') => {
    sound.playTick();
    setActiveLanguage(lang);
    setCode(CODE_TEMPLATES[lang]);
  };

  const handleExecuteSandbox = async () => {
    sound.playWarp();
    setIsRunning(true);
    setConsoleOutput(`[SYSTEM] Initializing Sandbox job on ${currentWorkspace.isolationTier}...\n[SYSTEM] Auditing syscall limits...`);

    await new Promise(r => setTimeout(r, 700));

    if (activeLanguage === 'python') {
      setConsoleOutput(
        `[VIRTUAL_PY_3.12] Executing in Isolated Environment...\n` +
        `Memory Shard Cosine Affinity: 0.9984\n` +
        `Constitutional Sandbox Constraint: Memory boundary isolation validated.\n` +
        `[AUDIT] Execution time: 18.2ms | Max RSS: 14.2MB | Syscall violations: 0 (PASSED)`
      );
    } else {
      setConsoleOutput(
        `[WASM_MICROKERNEL] Compiling and running safe bytecodes...\n` +
        `Evaluating Directive ID 3 with Hash [6, 24, 33, 42, 0, 90, 124, 159]\n` +
        `Directive 3 Status: STRICT_SANDBOX_VERIFIED = true\n` +
        `[AUDIT] Execution time: 4.1ms | Max RSS: 2.1MB | Syscall violations: 0 (PASSED)`
      );
    }

    setIsRunning(false);
    sound.playCognitivePulse();
  };

  return (
    <div className="h-full flex flex-col gap-4 font-mono text-cyan-400">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-3">
          <Box className="text-cyan-400" size={20} />
          <span className="text-sm font-semibold tracking-wider text-white">SANDBOX ORCHESTRATOR // CHAPTER 6</span>
          <span className="px-2 py-0.5 text-[10px] bg-emerald-950/80 border border-emerald-500/40 rounded text-emerald-300">
            ZERO SYSCALL LEAKS
          </span>
        </div>
        <div className="flex items-center gap-2">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => {
                sound.playTick();
                setActiveWorkspaceId(ws.id);
              }}
              className={`px-3 py-1 rounded-lg text-xs transition-all border ${
                ws.id === activeWorkspaceId 
                  ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                  : 'border-cyan-500/20 text-cyan-400/60 hover:text-white'
              }`}
            >
              {ws.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Code Editor & Execution Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Code Editor */}
        <div className="lg:col-span-7 flex flex-col border border-cyan-500/30 rounded-2xl bg-black/60 p-4 min-h-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Code2 size={16} className="text-cyan-400" />
              <span className="text-xs text-white font-semibold">ISOLATED CODE RUNNER</span>
              <div className="flex gap-1 ml-3">
                <button
                  onClick={() => handleSelectLanguage('python')}
                  className={`px-2 py-0.5 text-[10px] rounded border ${activeLanguage === 'python' ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'border-cyan-500/20 text-cyan-400/60'}`}
                >
                  Python 3.12
                </button>
                <button
                  onClick={() => handleSelectLanguage('rust')}
                  className={`px-2 py-0.5 text-[10px] rounded border ${activeLanguage === 'rust' ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'border-cyan-500/20 text-cyan-400/60'}`}
                >
                  Rust / WASM
                </button>
              </div>
            </div>

            <button
              onClick={handleExecuteSandbox}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
            >
              <Play size={13} />
              {isRunning ? 'Running in Sandbox...' : 'Execute in Sandbox'}
            </button>
          </div>

          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            className="flex-1 w-full bg-black/80 border border-cyan-500/20 rounded-xl p-3 text-xs text-cyan-200 font-mono leading-relaxed focus:outline-none focus:border-cyan-400 resize-none"
            spellCheck={false}
          />
        </div>

        {/* Right: Security Bounds & Live Execution Output */}
        <div className="lg:col-span-5 flex flex-col gap-3 min-h-0">
          {/* Isolation Tier Card */}
          <div className="border border-cyan-500/20 rounded-2xl bg-black/50 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-cyan-500/60 uppercase tracking-wider">Active Isolation Tier</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                {currentWorkspace.isolationTier}
              </span>
            </div>
            <div className="text-xs text-white font-medium mb-2">{currentWorkspace.name}</div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/15">
                <span className="text-cyan-500/50 block">Status</span>
                <span className="text-emerald-400 font-bold">{currentWorkspace.status}</span>
              </div>
              <div className="p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/15">
                <span className="text-cyan-500/50 block">Syscall Violations</span>
                <span className="text-white font-bold">0 Detected</span>
              </div>
            </div>
          </div>

          {/* Execution Output Console */}
          <div className="flex-1 flex flex-col border border-cyan-500/30 rounded-2xl bg-black/70 p-3.5 min-h-0">
            <div className="flex items-center justify-between mb-2 text-xs text-white font-semibold">
              <div className="flex items-center gap-1.5">
                <Terminal size={14} className="text-cyan-400" />
                <span>SANDBOX CONSOLE STREAM</span>
              </div>
              <button 
                onClick={() => setConsoleOutput('Console cleared.')}
                className="text-[10px] text-cyan-500/50 hover:text-cyan-400"
              >
                Clear
              </button>
            </div>

            <pre className="flex-1 overflow-y-auto p-2.5 rounded-xl bg-black/90 border border-cyan-500/15 text-[11px] text-cyan-300 leading-relaxed font-mono whitespace-pre-wrap">
              {consoleOutput}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
