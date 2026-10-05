/**
 * src/voice/voiceState.ts
 * Shared voice state — single source of truth for all voice components.
 */
import { create } from "zustand";

export type VoiceMode = "idle" | "listening" | "processing" | "speaking" | "error";

export interface VoiceState {
  // Toggle
  enabled:          boolean;
  mode:             VoiceMode;

  // STT
  transcript:       string;
  interimTranscript: string;
  isListening:      boolean;

  // TTS
  isSpeaking:       boolean;
  speakingText:     string;
  ttsMethod:        "browser" | "elevenlabs";

  // Conversation timing
  lastSpeechAt:     number;
  silenceDuration:  number;
  turnWaitMs:       number;

  // Audio quality
  rmsLevel:         number;
  noiseThreshold:   number;

  // Config
  voiceStyle:       "natural" | "synthetic";
  voiceId:          string;
  language:         string;
  autoSubmit:       boolean; // submit on silence
  wakeWord:         string;

  // Actions
  setEnabled:       (v: boolean) => void;
  setMode:          (m: VoiceMode) => void;
  setTranscript:    (t: string) => void;
  setInterim:       (t: string) => void;
  setSpeaking:      (v: boolean, text?: string) => void;
  setRms:           (r: number) => void;
  setConfig:        (c: Partial<Pick<VoiceState, "voiceStyle" | "voiceId" | "language" | "autoSubmit" | "wakeWord" | "noiseThreshold" | "turnWaitMs">>) => void;
  reset:            () => void;
}

function savedVoicePreferences():{language?:string;turnWaitMs?:number;voiceStyle?:"natural"|"synthetic"} {
  try {
    const value=JSON.parse(localStorage.getItem('microfixd_voice_preferences')||'{}');
    return {voiceStyle:value.voiceStyle==='synthetic'?'synthetic':'natural',language:['en-US','en-GB','es-US','fr-FR','de-DE'].includes(value.language)?value.language:'en-US',turnWaitMs:[800,1200,2000,3000].includes(value.turnWaitMs)?value.turnWaitMs:1200};
  }catch{return {};}
}
const savedVoice=savedVoicePreferences();

export const useVoiceStore = create<VoiceState>((set) => ({
  enabled:           false,
  mode:              "idle",
  transcript:        "",
  interimTranscript: "",
  isListening:       false,
  isSpeaking:        false,
  speakingText:      "",
  ttsMethod:         "browser",
  lastSpeechAt:      0,
  silenceDuration:   0,
  turnWaitMs:        savedVoice.turnWaitMs ?? 1200,
  rmsLevel:          0,
  noiseThreshold:    0.02,
  voiceStyle:        savedVoice.voiceStyle ?? "natural",
  voiceId:           "21m00Tcm4TlvDq8ikWAM",
  language:          savedVoice.language ?? "en-US",
  autoSubmit:        true,
  wakeWord:          "hey microfixd",

  setEnabled:    (enabled)       => set({ enabled, mode: enabled ? "idle" : "idle" }),
  setMode:       (mode)          => set({ mode }),
  setTranscript: (transcript)    => set({ transcript, lastSpeechAt: Date.now() }),
  setInterim:    (interimTranscript) => set({ interimTranscript }),
  setSpeaking:   (isSpeaking, speakingText = "") => set({ isSpeaking, speakingText, mode: isSpeaking ? "speaking" : "idle" }),
  setRms:        (rmsLevel)      => set({ rmsLevel }),
  setConfig: (c) => set(state=>{
    const next={...state,...c};
    try {localStorage.setItem('microfixd_voice_preferences',JSON.stringify({language:next.language,turnWaitMs:next.turnWaitMs,voiceStyle:next.voiceStyle}));}catch{}
    return c;
  }),
  reset:         ()              => set({ transcript: "", interimTranscript: "", mode: "idle", isListening: false }),
}));
