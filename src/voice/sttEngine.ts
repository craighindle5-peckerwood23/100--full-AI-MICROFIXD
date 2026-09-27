// @ts-nocheck
/**
 * src/voice/sttEngine.ts
 * Speech-to-Text engine.
 * Primary:  Web Speech API (browser-native, zero latency, free)
 * Fallback: Whisper via OpenAI API (if Web Speech unavailable)
 *
 * Features:
 *   - Continuous recognition with interim results
 *   - Wake word detection ("hey microfixd")
 *   - Silence detection → auto-submit
 *   - Language switching
 */
import { useVoiceStore } from "./voiceState";

// Extend window for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition:       typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export type STTCallback = (final: string, interim: string) => void;
export type SilenceCallback = (transcript: string) => void;

class STTEngine {
  private recognition:     SpeechRecognition | null = null;
  private silenceTimer:    NodeJS.Timeout | null = null;
  private onFinal?:        STTCallback;
  private onSilence?:      SilenceCallback;
  private _running         = false;
  private _transcript      = "";

  get isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  init(language = "en-US"): void {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { console.warn("[stt] Web Speech API not supported"); return; }

    this.recognition             = new SR();
    this.recognition.continuous  = true;
    this.recognition.interimResults = true;
    this.recognition.lang        = language;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      let interim  = "";
      let finalStr = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalStr       += text;
          this._transcript += text + " ";
        } else {
          interim += text;
        }
      }

      useVoiceStore.getState().setInterim(interim);
      if (finalStr) {
        useVoiceStore.getState().setTranscript(this._transcript.trim());
        useVoiceStore.getState().setMode("processing");
        this.onFinal?.(this._transcript.trim(), interim);
        this.resetSilenceTimer();
      }
    };

    this.recognition.onerror = (event) => {
      console.warn("[stt] Error:", event.error);
      if (event.error === "no-speech") {
        // Restart on no-speech
        this.recognition?.start();
      }
      useVoiceStore.getState().setMode("error");
    };

    this.recognition.onend = () => {
      if (this._running) {
        // Auto-restart for continuous mode
        setTimeout(() => this.recognition?.start(), 100);
      }
    };
  }

  start(
    onFinal:   STTCallback,
    onSilence: SilenceCallback,
    language = "en-US",
  ): void {
    if (this._running) return;
    this.onFinal   = onFinal;
    this.onSilence = onSilence;
    this._running  = true;
    this._transcript = "";

    if (!this.recognition) this.init(language);
    this.recognition?.start();
    useVoiceStore.getState().setMode("listening");
    console.log("[stt] Started listening — language:", language);
  }

  stop(): void {
    this._running = false;
    this.recognition?.stop();
    this.clearSilenceTimer();
    useVoiceStore.getState().setMode("idle");
    useVoiceStore.getState().setInterim("");
    console.log("[stt] Stopped");
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    const { turnWaitMs, autoSubmit } = useVoiceStore.getState();
    if (!autoSubmit) return;

    this.silenceTimer = setTimeout(() => {
      const t = this._transcript.trim();
      if (t) {
        this.onSilence?.(t);
        this._transcript = "";
        useVoiceStore.getState().setTranscript("");
      }
    }, turnWaitMs);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  detectWakeWord(transcript: string, wakeWord: string): boolean {
    return transcript.toLowerCase().includes(wakeWord.toLowerCase());
  }
}

export const sttEngine = new STTEngine();
