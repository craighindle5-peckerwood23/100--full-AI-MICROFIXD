/**
 * src/voice/speechCleaner.ts
 * AudioWorklet-based speech cleaner.
 * Loads the audioWorklet.js processor and applies:
 *   - Noise gate
 *   - RMS level monitoring
 *   - Talking/silence state detection
 * Reports RMS to voiceState for UI visualization.
 */
import { useVoiceStore } from "./voiceState";

class SpeechCleaner {
  private ctx:       AudioContext | null = null;
  private worklet:   AudioWorkletNode | null = null;
  private source:    MediaStreamAudioSourceNode | null = null;
  private stream:    MediaStream | null = null;
  private _active    = false;

  async start(): Promise<void> {
    if (this._active) return;
    try {
      this.stream  = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.ctx     = new AudioContext({ sampleRate: 44100 });
      await this.ctx.audioWorklet.addModule("/audioWorklet.js");

      this.source  = this.ctx.createMediaStreamSource(this.stream);
      this.worklet = new AudioWorkletNode(this.ctx, "microfixd-voice-processor");

      // Listen for talking/silence events from worklet
      this.worklet.port.onmessage = (e) => {
        const { type, rms } = e.data as { type: string; rms: number };
        useVoiceStore.getState().setRms(rms);
        if (type === "talking") {
          useVoiceStore.getState().setMode("listening");
        }
      };

      // Update noise threshold from state
      const { noiseThreshold } = useVoiceStore.getState();
      this.worklet.port.postMessage({ noiseThreshold });

      this.source.connect(this.worklet);
      // Do NOT connect worklet to destination — we only analyze, not output mic audio
      this._active = true;
      console.log("[speech_cleaner] AudioWorklet active");
    } catch (err) {
      console.warn("[speech_cleaner] Failed to start AudioWorklet:", err);
    }
  }

  stop(): void {
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    this.ctx?.close();
    this.ctx     = null;
    this.source  = null;
    this.worklet = null;
    this.stream  = null;
    this._active = false;
    useVoiceStore.getState().setRms(0);
    console.log("[speech_cleaner] Stopped");
  }

  setNoiseThreshold(threshold: number): void {
    this.worklet?.port.postMessage({ noiseThreshold: threshold });
    useVoiceStore.getState().setConfig({ noiseThreshold: threshold });
  }

  isActive(): boolean { return this._active; }
}

export const speechCleaner = new SpeechCleaner();
