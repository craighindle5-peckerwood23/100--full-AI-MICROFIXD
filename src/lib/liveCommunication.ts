import { create } from 'zustand';
import { liveAudioEngine } from './liveAudioEngine';
import { useVoiceStore } from '../voice/voiceState';
import { ttsEngine } from '../voice/ttsEngine';
import { voice } from '../utils/voice';
import {
  classifyServerEventForSpeech,
  matchesExpandIntent,
  shapeIntelligentSpeech,
  type ShapedSpeechResult,
} from '../voice/speechFeedbackCoordinator';

export type LiveConnectionState = 'idle' | 'authenticating' | 'connecting' | 'live' | 'error';
export type LiveModelProfile = 'fast' | 'extended';
export type LiveVisionSource = 'none' | 'camera' | 'screen';
export type LiveTurnState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface LiveTranscriptItem {
  id: string;
  role: 'user' | 'assistant' | 'briefing' | 'alert';
  text: string;
  expandableDetail?: string;
  expanded?: boolean;
  timestamp: string;
  urgency?: 'normal' | 'high' | 'critical';
}

export interface LiveToolActivity {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  ts: string;
}

interface LiveCommunicationStore {
  connectionState: LiveConnectionState;
  modelProfile: LiveModelProfile;
  voicePreset: string;
  micActive: boolean;
  micMuted: boolean;
  visionSource: LiveVisionSource;
  turnState: LiveTurnState;
  inputRms: number;
  outputRms: number;
  fps: number;
  drawerOpen: boolean;
  drawerTab: 'live' | 'connections';
  lastError: string | null;
  transcripts: LiveTranscriptItem[];
  toolActivities: LiveToolActivity[];
  lastBrief: ShapedSpeechResult | null;
  videoStream: MediaStream | null;

  setDrawerOpen: (open: boolean, tab?: 'live' | 'connections') => void;
  setDrawerTab: (tab: 'live' | 'connections') => void;
  setModelProfile: (profile: LiveModelProfile) => void;
  setVoicePreset: (voice: string) => void;
  toggleMute: () => void;
  startLiveSession: (options?: { contextNote?: string }) => Promise<void>;
  stopLiveSession: () => void;
  startVision: (source: 'camera' | 'screen') => Promise<void>;
  stopVision: () => void;
  sendTextTurn: (text: string) => void;
  interrupt: () => void;
  toggleTranscriptExpand: (id: string) => void;
  speakAdaptiveBrief: (input: { text: string; title?: string; source?: string; urgency?: 'normal' | 'high' | 'critical' }) => Promise<ShapedSpeechResult>;
  expandLastBrief: () => Promise<void>;
  handleProactiveServerEvent: (event: { type?: string; payload?: unknown }) => void;
}

const LIVE_MODELS = {
  fast: 'gemini-3.8-live',
  extended: 'gemini-3.8-live-extended-thinking',
} as const;

let liveWs: WebSocket | null = null;
let videoTimer: ReturnType<typeof setInterval> | null = null;
let hiddenVideoEl: HTMLVideoElement | null = null;
let offscreenCanvas: HTMLCanvasElement | null = null;
const alertCooldowns = new Map<string, number>();

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    window.sessionStorage.getItem('microfixd_operator_token') ||
    window.sessionStorage.getItem('microfixd_supabase_access_token') ||
    ''
  );
}

function buildLiveWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/live`;
}

function publishHioVoiceTelemetry(state: LiveTurnState, signal = 0): void {
  const voiceStore = useVoiceStore.getState();
  if (state === 'speaking') {
    voiceStore.setSpeaking(true, 'Live voice active');
  } else if (state === 'listening') {
    voiceStore.setSpeaking(false);
    voiceStore.setMode('listening');
  } else {
    voiceStore.setSpeaking(false);
    voiceStore.setMode('idle');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('microfixd:telemetry', {
        detail: {
          type: 'voice.state',
          state,
          signal: Math.round(signal * 100),
          timestamp: Date.now(),
        },
      }),
    );
  }
}

function appendOrMergeTranscript(
  list: LiveTranscriptItem[],
  role: 'user' | 'assistant' | 'briefing' | 'alert',
  text: string,
  extra?: Partial<LiveTranscriptItem>,
): LiveTranscriptItem[] {
  const cleaned = text;
  if (!cleaned.trim()) return list;
  const last = list.at(-1);
  if ((role === 'user' || role === 'assistant') && last && last.role === role) {
    const needsSpace = !last.text.endsWith(' ') && !cleaned.startsWith(' ') && !/^[.,!?]/.test(cleaned);
    const updated = {
      ...last,
      text: `${last.text}${needsSpace ? ' ' : ''}${cleaned}`,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    return [...list.slice(0, -1), updated];
  }

  return [
    ...list.slice(-39),
    {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role,
      text: cleaned.trim(),
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ...extra,
    },
  ];
}

export const useLiveCommunication = create<LiveCommunicationStore>((set, get) => ({
  connectionState: 'idle',
  modelProfile: 'fast',
  voicePreset: 'Zephyr',
  micActive: false,
  micMuted: false,
  visionSource: 'none',
  turnState: 'idle',
  inputRms: 0,
  outputRms: 0,
  fps: 0,
  drawerOpen: false,
  drawerTab: 'live',
  lastError: null,
  transcripts: [],
  toolActivities: [],
  lastBrief: null,
  videoStream: null,

  setDrawerOpen: (drawerOpen, tab) =>
    set((s) => ({ drawerOpen, drawerTab: tab ?? s.drawerTab })),
  setDrawerTab: (drawerTab) => set({ drawerTab }),

  setModelProfile: (modelProfile) => set({ modelProfile }),

  setVoicePreset: (voicePreset) => set({ voicePreset }),

  toggleMute: () => {
    const nextMuted = !get().micMuted;
    liveAudioEngine.setMuted(nextMuted);
    set({ micMuted: nextMuted });
  },

  startLiveSession: async (options) => {
    const current = get().connectionState;
    if (current === 'authenticating' || current === 'connecting' || current === 'live') {
      return;
    }

    const token = getToken();
    if (!token) {
      set({
        connectionState: 'error',
        lastError: 'Operator authentication required before opening Live Voice & Vision.',
        drawerOpen: true,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('microfixd:auth-required'));
      }
      return;
    }

    set({ connectionState: 'authenticating', lastError: null });

    try {
      await liveAudioEngine.startMic({
        onChunk: (base64) => {
          if (liveWs?.readyState === WebSocket.OPEN && get().connectionState === 'live') {
            liveWs.send(JSON.stringify({ type: 'audio.chunk', data: base64 }));
          }
        },
        onLevel: (rms) => {
          useVoiceStore.getState().setRms(rms);
          set({ inputRms: rms });
        },
      });
      set({ micActive: true, micMuted: false });
      liveAudioEngine.setMuted(false);
    } catch (err) {
      set({
        connectionState: 'error',
        micActive: false,
        lastError: `Microphone unavailable: ${err instanceof Error ? err.message : String(err)}`,
        drawerOpen: true,
      });
      return;
    }

    const ws = new WebSocket(buildLiveWsUrl());
    liveWs = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'authenticate', payload: { token } }));
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, any>;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }

      switch (msg.type) {
        case 'authenticated': {
          set({ connectionState: 'connecting' });
          const model = LIVE_MODELS[get().modelProfile];
          ws.send(
            JSON.stringify({
              type: 'session.start',
              model,
              voiceName: get().voicePreset,
              thinkingLevel: get().modelProfile === 'extended' ? 'MEDIUM' : undefined,
              contextNote: options?.contextNote,
            }),
          );
          break;
        }
        case 'live.ready': {
          set({ connectionState: 'live', turnState: 'listening', lastError: null });
          publishHioVoiceTelemetry('listening', 0.25);
          break;
        }
        case 'audio.chunk': {
          if (typeof msg.data === 'string') {
            void liveAudioEngine.playPcm24kChunk(msg.data, {
              onStart: (rms) => {
                set({ turnState: 'speaking', outputRms: rms });
                publishHioVoiceTelemetry('speaking', rms);
              },
              onDrain: () => {
                set({ turnState: get().micActive ? 'listening' : 'idle', outputRms: 0 });
                publishHioVoiceTelemetry(get().micActive ? 'listening' : 'idle', 0);
              },
            });
          }
          break;
        }
        case 'transcript.input': {
          const text = String(msg.text || '');
          set((s) => ({
            transcripts: appendOrMergeTranscript(s.transcripts, 'user', text),
          }));
          if (matchesExpandIntent(text) && get().lastBrief?.hasMore) {
            void get().expandLastBrief();
          }
          break;
        }
        case 'transcript.output': {
          const text = String(msg.text || '');
          set((s) => ({
            transcripts: appendOrMergeTranscript(s.transcripts, 'assistant', text),
          }));
          break;
        }
        case 'interaction.status': {
          const nextTurn = msg.status === 'IN_PROGRESS' ? 'thinking' : liveAudioEngine.isPlaying() ? 'speaking' : 'listening';
          set({ turnState: nextTurn });
          publishHioVoiceTelemetry(nextTurn, nextTurn === 'thinking' ? 0.5 : 0.2);
          break;
        }
        case 'interrupted': {
          liveAudioEngine.interruptPlayback();
          set({ turnState: get().micActive ? 'listening' : 'idle', outputRms: 0 });
          publishHioVoiceTelemetry(get().micActive ? 'listening' : 'idle', 0);
          break;
        }
        case 'tool.call': {
          const id = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
          set((s) => ({
            toolActivities: [
              ...s.toolActivities.slice(-5),
              { id, name: String(msg.name || 'tool'), status: 'running', ts: new Date().toLocaleTimeString('en-GB') },
            ],
          }));
          break;
        }
        case 'tool.result': {
          set((s) => ({
            toolActivities: s.toolActivities.map((item) =>
              item.name === msg.name && item.status === 'running'
                ? { ...item, status: msg.ok ? 'completed' : 'failed' }
                : item,
            ),
          }));
          break;
        }
        case 'error': {
          const errText = String(msg.message || msg.code || 'Live session error');
          set({
            connectionState: msg.code === 'GEMINI_API_KEY_NOT_CONFIGURED' || msg.code === 'LIVE_CONNECT_FAILED' ? 'error' : get().connectionState,
            lastError: errText,
            drawerOpen: true,
          });
          if (msg.code === 'GEMINI_API_KEY_NOT_CONFIGURED' || msg.code === 'LIVE_CONNECT_FAILED') {
            liveAudioEngine.stopMic();
            set({ micActive: false, turnState: 'idle' });
            publishHioVoiceTelemetry('idle', 0);
          }
          break;
        }
        case 'live.stopped': {
          liveAudioEngine.interruptPlayback();
          set({ connectionState: 'idle', turnState: 'idle', outputRms: 0 });
          publishHioVoiceTelemetry('idle', 0);
          break;
        }
      }
    };

    ws.onerror = () => {
      set({
        connectionState: 'error',
        lastError: 'Live WebSocket connection error.',
      });
    };

    ws.onclose = (ev) => {
      if (liveWs === ws) liveWs = null;
      liveAudioEngine.stopMic();
      liveAudioEngine.interruptPlayback();
      const authFailed = ev.code === 1008;
      set((s) => ({
        connectionState: authFailed ? 'error' : s.connectionState === 'error' ? 'error' : 'idle',
        micActive: false,
        turnState: 'idle',
        inputRms: 0,
        outputRms: 0,
        lastError: authFailed ? ev.reason || 'Live authentication rejected.' : s.lastError,
      }));
      publishHioVoiceTelemetry('idle', 0);
    };
  },

  stopLiveSession: () => {
    get().stopVision();
    liveAudioEngine.destroy();
    if (liveWs) {
      if (liveWs.readyState === WebSocket.OPEN) {
        liveWs.send(JSON.stringify({ type: 'session.stop' }));
      }
      liveWs.onclose = null;
      liveWs.close();
      liveWs = null;
    }
    set({
      connectionState: 'idle',
      micActive: false,
      micMuted: false,
      turnState: 'idle',
      inputRms: 0,
      outputRms: 0,
    });
    publishHioVoiceTelemetry('idle', 0);
  },

  startVision: async (source) => {
    get().stopVision();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      set({ lastError: 'Media capture APIs are unavailable in this browser.', drawerOpen: true });
      return;
    }

    try {
      const stream =
        source === 'screen'
          ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 5, max: 10 } }, audio: false })
          : await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          get().stopVision();
        };
      }

      if (!hiddenVideoEl) {
        hiddenVideoEl = document.createElement('video');
        hiddenVideoEl.muted = true;
        hiddenVideoEl.playsInline = true;
      }
      hiddenVideoEl.srcObject = stream;
      await hiddenVideoEl.play().catch(() => {});

      if (!offscreenCanvas) {
        // Detached offscreen canvas only — never appended to DOM so HIO canvas count remains 1.
        offscreenCanvas = document.createElement('canvas');
      }

      set({ visionSource: source, videoStream: stream, fps: 1, lastError: null, drawerOpen: true });

      videoTimer = setInterval(() => {
        if (!hiddenVideoEl || !offscreenCanvas) return;
        if (liveWs?.readyState !== WebSocket.OPEN || get().connectionState !== 'live') return;
        const vw = hiddenVideoEl.videoWidth || 640;
        const vh = hiddenVideoEl.videoHeight || 480;
        const scale = Math.min(1, 640 / Math.max(vw, vh));
        const w = Math.max(160, Math.round(vw * scale));
        const h = Math.max(120, Math.round(vh * scale));
        offscreenCanvas.width = w;
        offscreenCanvas.height = h;
        const ctx = offscreenCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(hiddenVideoEl, 0, 0, w, h);
        const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.72);
        const base64 = dataUrl.split(',')[1];
        if (base64) {
          liveWs.send(JSON.stringify({ type: 'video.frame', data: base64 }));
        }
      }, 1000);
    } catch (err) {
      set({
        visionSource: 'none',
        videoStream: null,
        fps: 0,
        lastError: `Vision capture denied or failed: ${err instanceof Error ? err.message : String(err)}`,
        drawerOpen: true,
      });
    }
  },

  stopVision: () => {
    if (videoTimer) {
      clearInterval(videoTimer);
      videoTimer = null;
    }
    const stream = get().videoStream;
    stream?.getTracks().forEach((t) => t.stop());
    if (hiddenVideoEl) {
      hiddenVideoEl.srcObject = null;
    }
    set({ visionSource: 'none', videoStream: null, fps: 0 });
  },

  sendTextTurn: (rawText) => {
    const text = rawText.trim();
    if (!text) return;
    if (matchesExpandIntent(text) && get().lastBrief?.hasMore) {
      set((s) => ({
        transcripts: appendOrMergeTranscript(s.transcripts, 'user', text),
      }));
      void get().expandLastBrief();
      return;
    }
    if (liveWs?.readyState === WebSocket.OPEN && get().connectionState === 'live') {
      liveWs.send(JSON.stringify({ type: 'text.turn', text }));
      set((s) => ({
        transcripts: appendOrMergeTranscript(s.transcripts, 'user', text),
      }));
    }
  },

  interrupt: () => {
    liveAudioEngine.interruptPlayback();
    ttsEngine.interrupt();
    if (liveWs?.readyState === WebSocket.OPEN) {
      liveWs.send(JSON.stringify({ type: 'session.interrupt' }));
    }
    set({ turnState: get().micActive ? 'listening' : 'idle', outputRms: 0 });
    publishHioVoiceTelemetry(get().micActive ? 'listening' : 'idle', 0);
  },

  toggleTranscriptExpand: (id) => {
    set((s) => ({
      transcripts: s.transcripts.map((item) =>
        item.id === id ? { ...item, expanded: !item.expanded } : item,
      ),
    }));
  },

  speakAdaptiveBrief: async (input) => {
    const shaped = shapeIntelligentSpeech(input);
    set((s) => ({
      lastBrief: shaped,
      transcripts: appendOrMergeTranscript(s.transcripts, 'briefing', shaped.summary, {
        expandableDetail: shaped.hasMore ? shaped.expandableDetail : undefined,
        urgency: shaped.urgency,
      }),
    }));

    const liveActive = get().connectionState === 'live' && liveWs?.readyState === WebSocket.OPEN;
    if (liveActive) {
      // Inject as concise live spoken narration if Gemini Live is currently hosting the audio stream.
      liveWs!.send(
        JSON.stringify({
          type: 'text.turn',
          text: `Read this brief update cleanly in 1-2 sentences without adding extra speculation: ${shaped.summary}`,
        }),
      );
      return shaped;
    }

    if (voice.isEnabled()) {
      try {
        await ttsEngine.speak(shaped.summary);
      } catch {
        // Browser speech may be unavailable in headless tests; transcript still recorded.
      }
    }
    return shaped;
  },

  expandLastBrief: async () => {
    const brief = get().lastBrief;
    if (!brief || !brief.expandableDetail) return;
    set((s) => ({
      transcripts: appendOrMergeTranscript(s.transcripts, 'briefing', brief.expandableDetail, {
        urgency: brief.urgency,
      }),
    }));

    const liveActive = get().connectionState === 'live' && liveWs?.readyState === WebSocket.OPEN;
    if (liveActive) {
      liveWs!.send(
        JSON.stringify({
          type: 'text.turn',
          text: `Summarize the full expanded details clearly for the operator: ${brief.expandableDetail.slice(0, 3000)}`,
        }),
      );
      return;
    }

    if (voice.isEnabled()) {
      try {
        await ttsEngine.speak(brief.expandableDetail.slice(0, 1400));
      } catch {
        // ignore headless TTS absence
      }
    }
  },

  handleProactiveServerEvent: (event) => {
    const voiceEnabled =
      get().connectionState === 'live' ||
      voice.isEnabled();

    const decision = classifyServerEventForSpeech(event, {
      voiceActive: voiceEnabled,
      liveSessionActive: get().connectionState === 'live',
    });

    if (!decision.shouldSpeak) return;

    const now = Date.now();
    const lastFired = alertCooldowns.get(decision.dedupeKey) ?? 0;
    if (now - lastFired < 20_000) return;
    alertCooldowns.set(decision.dedupeKey, now);

    set((s) => ({
      transcripts: appendOrMergeTranscript(s.transcripts, 'alert', decision.spokenBrief, {
        expandableDetail: decision.fullDetail,
        urgency: decision.urgency,
      }),
    }));

    const liveActive = get().connectionState === 'live' && liveWs?.readyState === WebSocket.OPEN;
    if (liveActive) {
      liveWs!.send(
        JSON.stringify({
          type: 'text.turn',
          text: `Urgent system notification — inform the user immediately in one concise sentence: ${decision.spokenBrief}`,
        }),
      );
      return;
    }

    if (voiceEnabled) {
      ttsEngine.interrupt();
      void ttsEngine.speak(decision.spokenBrief).catch(() => {});
    }
  },
}));
