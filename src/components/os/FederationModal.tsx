import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Network, 
  X, 
  Wifi, 
  Globe, 
  RefreshCw, 
  ShieldCheck, 
  Send, 
  Radio 
} from 'lucide-react';
import { sound } from '../../utils/audio';

interface PeerNode {
  id: string;
  name: string;
  endpoint: string;
  protocol: string;
  latencyMs: number;
  status: 'SYNCHRONIZED' | 'CONNECTING' | 'STANDBY';
  packetsExchanged: number;
}

interface Props {
  onClose: () => void;
}

export default function FederationModal({ onClose }: Props) {
  const [peers, setPeers] = useState<PeerNode[]>([
    { id: 'p1', name: 'Sigma-09 Edge Orbital', endpoint: 'mcp://edge-sigma-09.os.net:8443', protocol: 'MCP-v2 / TLS 1.3', latencyMs: 14.2, status: 'SYNCHRONIZED', packetsExchanged: 14280 },
    { id: 'p2', name: 'Orion Cloud Deep Storage', endpoint: 'mcp://orion-cluster.os.net:8443', protocol: 'MCP-v2 / TLS 1.3', latencyMs: 38.6, status: 'SYNCHRONIZED', packetsExchanged: 8490 },
    { id: 'p3', name: 'Quantum-Subnet Relay', endpoint: 'qnet://quantum-relay-01.os.net:9001', protocol: 'Q-Mesh / Quantum Auth', latencyMs: 2.1, status: 'SYNCHRONIZED', packetsExchanged: 92400 },
  ]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handlePingPeers = async () => {
    sound.playWarp();
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 900));

    setPeers(prev => prev.map(p => ({
      ...p,
      latencyMs: +(p.latencyMs * (0.9 + Math.random() * 0.2)).toFixed(1),
      packetsExchanged: p.packetsExchanged + Math.floor(10 + Math.random() * 40)
    })));
    setIsSyncing(false);
    sound.playCognitivePulse();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl font-mono text-cyan-400">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl bg-[#04090f] border border-cyan-500/40 rounded-3xl p-6 shadow-[0_0_80px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Network size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-wider">FEDERATION LAYER</span>
                <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  CHAPTER 16 // MCP ACTIVE
                </span>
              </div>
              <p className="text-xs text-cyan-400/70">
                Distributed agent orchestration, A2A consensus, and cross-cluster peer routing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePingPeers}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400 text-xs text-white"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              Ping Mesh
            </button>
            <button
              onClick={() => { sound.playTick(); onClose(); }}
              className="w-9 h-9 rounded-full border border-cyan-500/20 hover:bg-cyan-500/10 flex items-center justify-center text-cyan-400/80 hover:text-cyan-300 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Peer Nodes List */}
        <div className="space-y-3 overflow-y-auto max-h-[55vh] pr-1">
          {peers.map(peer => (
            <div
              key={peer.id}
              className="p-4 rounded-2xl border border-cyan-500/25 bg-black/60 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-white tracking-wide">{peer.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
                    {peer.status}
                  </span>
                </div>
                <div className="text-xs text-cyan-400/70 font-mono mb-1">{peer.endpoint}</div>
                <div className="text-[10px] text-cyan-500/60">Protocol: {peer.protocol}</div>
              </div>

              <div className="flex items-center gap-4 text-xs border-t md:border-t-0 md:border-l border-cyan-500/20 pt-2 md:pt-0 md:pl-4">
                <div>
                  <span className="text-[10px] text-cyan-500/60 block uppercase">RTT Latency</span>
                  <span className="text-emerald-300 font-bold">{peer.latencyMs} ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-cyan-500/60 block uppercase">Packets Exchanged</span>
                  <span className="text-white font-bold">{peer.packetsExchanged.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
