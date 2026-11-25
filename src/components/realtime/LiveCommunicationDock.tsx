import React from 'react';
import {
  Camera,
  CameraOff,
  Maximize2,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Radio,
  Square,
  Volume2,
} from 'lucide-react';
import { useLiveCommunication } from '../../lib/liveCommunication';

export default function LiveCommunicationDock() {
  const {
    connectionState,
    micMuted,
    visionSource,
    turnState,
    inputRms,
    outputRms,
    lastBrief,
    startLiveSession,
    stopLiveSession,
    toggleMute,
    startVision,
    stopVision,
    interrupt,
    expandLastBrief,
    setDrawerOpen,
  } = useLiveCommunication();

  const isLive = connectionState === 'live';
  const isConnecting = connectionState === 'authenticating' || connectionState === 'connecting';
  const level = Math.max(inputRms, outputRms);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-cyan-500/25 bg-[#031019]/90 px-2.5 py-1.5 text-[11px]"
      role="region"
      aria-label="Live Voice and Vision Dock"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {!isLive && !isConnecting ? (
          <button
            type="button"
            onClick={() => void startLiveSession()}
            className="inline-flex items-center gap-1.5 rounded border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-medium text-cyan-100 whitespace-nowrap shrink-0 hover:bg-cyan-500/25"
          >
            <Mic size={13} className="text-cyan-300" />
            <span>Live Voice</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => stopLiveSession()}
            className="inline-flex items-center gap-1.5 rounded border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200 whitespace-nowrap shrink-0 hover:bg-rose-500/20 hover:border-rose-400/50 hover:text-rose-200"
          >
            <Radio size={13} className={isLive ? 'text-emerald-300' : 'text-amber-300'} />
            <span>{isConnecting ? 'Connecting…' : 'End Live'}</span>
          </button>
        )}

        {isLive && (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] whitespace-nowrap shrink-0 ${
              micMuted
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                : 'border-white/15 bg-black/40 text-slate-200 hover:bg-white/10'
            }`}
          >
            {micMuted ? <MicOff size={12} /> : <Mic size={12} />}
            <span>{micMuted ? 'Muted' : 'Mic On'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => (visionSource === 'camera' ? stopVision() : void startVision('camera'))}
          aria-pressed={visionSource === 'camera'}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] whitespace-nowrap shrink-0 ${
            visionSource === 'camera'
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
              : 'border-white/15 bg-black/40 text-slate-300 hover:bg-white/10'
          }`}
          title="Share live camera frames"
        >
          {visionSource === 'camera' ? <CameraOff size={12} /> : <Camera size={12} />}
          <span>{visionSource === 'camera' ? 'Stop Cam' : 'Camera'}</span>
        </button>

        <button
          type="button"
          onClick={() => (visionSource === 'screen' ? stopVision() : void startVision('screen'))}
          aria-pressed={visionSource === 'screen'}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] whitespace-nowrap shrink-0 ${
            visionSource === 'screen'
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
              : 'border-white/15 bg-black/40 text-slate-300 hover:bg-white/10'
          }`}
          title="Share screen frames"
        >
          {visionSource === 'screen' ? <MonitorOff size={12} /> : <Monitor size={12} />}
          <span>{visionSource === 'screen' ? 'Stop Screen' : 'Screen'}</span>
        </button>

        {(turnState === 'speaking' || turnState === 'thinking') && (
          <button
            type="button"
            onClick={interrupt}
            className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[10px] text-amber-200 whitespace-nowrap shrink-0 hover:bg-amber-500/25"
          >
            <Square size={10} />
            <span>Interrupt</span>
          </button>
        )}

        {lastBrief?.hasMore && (
          <button
            type="button"
            onClick={() => void expandLastBrief()}
            className="inline-flex items-center gap-1 rounded border border-cyan-400/35 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200 whitespace-nowrap shrink-0 hover:bg-cyan-500/20"
            title="Hear full expanded details"
          >
            <Volume2 size={11} />
            <span>Expand</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div
          className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-slate-400"
          title="Live audio meter and stream format"
        >
          <span className="inline-block h-1.5 w-12 overflow-hidden rounded-sm bg-slate-800">
            <span
              className={`block h-full transition-all ${
                turnState === 'speaking' ? 'bg-cyan-300' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.round(level * 100))}%` }}
            />
          </span>
          <span className={isLive ? 'text-emerald-300' : 'text-slate-400'}>
            {isLive ? `16k/24k · ${turnState.toUpperCase()}` : 'STANDBY'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-1 rounded border border-white/15 bg-black/40 px-2 py-1 text-[10px] text-cyan-200 whitespace-nowrap shrink-0 hover:bg-white/10"
        >
          <Maximize2 size={11} />
          <span>Comms &amp; Apps</span>
        </button>
      </div>
    </div>
  );
}
