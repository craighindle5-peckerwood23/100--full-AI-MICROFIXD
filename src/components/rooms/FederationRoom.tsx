import React, { useState } from 'react';
import { 
  Network, 
  Wifi, 
  Globe, 
  RefreshCw, 
  ShieldCheck, 
  Send, 
  Radio,
  CheckCircle2,
  Server
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { voice } from '../../utils/voice';

interface PeerNode {
  id: string;
  name: string;
  endpoint: string;
  protocol: string;
  latencyMs: number;
  status: 'SYNCHRONIZED' | 'CONNECTING' | 'STANDBY';
  packetsExchanged: number;
}

export default function FederationRoom() {
  const [peers, setPeers] = useState<PeerNode[]>([
    { id: 'p1', name: 'Sigma-09 Edge Orbital', endpoint: 'mcp://edge-sigma-09.os.net:8443', protocol: 'MCP-v2 / TLS 1.3', latencyMs: 14.2, status: 'SYNCHRONIZED', packetsExchanged: 14280 },
    { id: 'p2', name: 'Orion Cloud Deep Storage', endpoint: 'mcp://orion-cluster.os.net:8443', protocol: 'MCP-v2 / TLS 1.3', latencyMs: 38.6, status: 'SYNCHRONIZED', packetsExchanged: 8490 },
    { id: 'p3', name: 'Quantum-Subnet Relay', endpoint: 'qnet://quantum-relay-01.os.net:9001', protocol: 'Q-Mesh / Quantum Auth', latencyMs: 2.1, status: 'SYNCHRONIZED', packetsExchanged: 92400 },
    { id: 'p4', name: 'Tokyo Microkernel Hive', endpoint: 'mcp://jp-east-hive.os.net:8443', protocol: 'MCP-v2 / TLS 1.3', latencyMs: 28.4, status: 'SYNCHRONIZED', packetsExchanged: 31200 },
  ]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handlePingPeers = async () => {
    sound.playWarp();
    voice.speak('Pinging Model Context Protocol federation mesh.');
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 700));

    setPeers(prev => prev.map(p => ({
      ...p,
      latencyMs: +(p.latencyMs * (0.9 + Math.random() * 0.2)).toFixed(1),
      packetsExchanged: p.packetsExchanged + Math.floor(Math.random() * 120)
    })));
    setIsSyncing(false);
    sound.playSuccess();
    voice.speak('All federated peer nodes synchronized.');
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 text-cyan-400 font-mono overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Network size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white tracking-wider">
                FEDERATION LAYER & MCP ROUTING
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                CHAPTER 16 // DISTRIBUTED MESH
              </span>
            </div>
            <p className="text-xs text-cyan-500/80 mt-0.5">
              Cross-cluster agent synchronization, Model Context Protocol (MCP) routing & zero-trust federation.
            </p>
          </div>
        </div>

        <button
          onClick={handlePingPeers}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'Synchronizing...' : 'Ping Federation Mesh'}</span>
        </button>
      </div>

      {/* Peer Node Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {peers.map(peer => (
          <div 
            key={peer.id}
            className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 space-y-3 backdrop-blur-md shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-cyan-400" />
                <span className="font-bold text-white text-sm">{peer.name}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                <CheckCircle2 size={10} />
                {peer.status}
              </span>
            </div>

            <div className="text-xs text-cyan-300/80 font-mono bg-cyan-950/30 p-2 rounded border border-cyan-500/20 truncate">
              {peer.endpoint}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-cyan-500/10">
              <div>
                <span className="text-[10px] text-cyan-500/70 block">Protocol</span>
                <span className="text-white text-[11px] font-bold">{peer.protocol}</span>
              </div>
              <div>
                <span className="text-[10px] text-cyan-500/70 block">Roundtrip RTT</span>
                <span className="text-cyan-300 text-[11px] font-bold">{peer.latencyMs}ms</span>
              </div>
              <div>
                <span className="text-[10px] text-cyan-500/70 block">Packets</span>
                <span className="text-white text-[11px] font-bold">{peer.packetsExchanged.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
