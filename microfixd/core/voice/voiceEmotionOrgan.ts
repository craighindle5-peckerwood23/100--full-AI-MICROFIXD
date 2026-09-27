// microfixd/core/voice/voiceEmotionOrgan.ts
import { UnifiedWiringOrgan } from "../wiring/unifiedWiring";
import { MemoryOrgan } from "../memory/memory";
import { SyntheticEmotionEngine } from "../autonomy/syntheticEmotionEngine";
import { CognitiveFeedbackLoop } from "../autonomy/cognitiveFeedbackLoop";

export type VoiceToneEmotion =
  | "calm"
  | "focused"
  | "curious"
  | "urgent"
  | "stressed"
  | "overloaded"
  | "commanding"
  | "uncertain";

export interface VoiceToneEvent {
  id: string;
  emotion: VoiceToneEmotion;
  amplitude: number;
  frequency: number;
  createdAt: string;
}

export class VoiceEmotionOrgan {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private running = false;

  constructor(
    private wiring: UnifiedWiringOrgan,
    private memory: MemoryOrgan,
    private emotion: SyntheticEmotionEngine,
    private cognition: CognitiveFeedbackLoop
  ) {}

  async start() {
    this.wiring.on("voice", (payload) => {
      if (payload.type === "start_sensors") {
        this.initialize();
      }
    });
  }

  private async initialize() {
    if (this.running || typeof window === 'undefined') return;
    this.running = true;

    try {
      this.audioContext = new AudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      this.microphone.connect(this.analyser);

      this.loop();
    } catch (err) {
      console.error("VoiceEmotionOrgan: Failed to start audio context", err);
      this.running = false;
    }
  }

  stop() {
    this.running = false;
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  private async loop() {
    if (!this.analyser || !this.audioContext) return;
    
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);

    while (this.running) {
      this.analyser.getByteFrequencyData(buffer);

      const amplitude = buffer.reduce((a, b) => a + b, 0) / buffer.length;
      const frequency = this.detectPeakFrequency(buffer);

      const toneEmotion = this.mapToneToEmotion(amplitude, frequency);

      const event: VoiceToneEvent = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        emotion: toneEmotion,
        amplitude,
        frequency,
        createdAt: new Date().toISOString(),
      };

      this.memory.remember("voice_tone_event", JSON.stringify(event), { toneEmotion });
      this.wiring.broadcast("emotion", event);
      this.wiring.broadcast("cognition", { type: "tone", event });

      await this.sleep(120);
    }
  }

  private detectPeakFrequency(buffer: Uint8Array): number {
    if (!this.audioContext || !this.analyser) return 0;
    let max = 0;
    let index = 0;

    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] > max) {
        max = buffer[i];
        index = i;
      }
    }

    return index * (this.audioContext.sampleRate / this.analyser.fftSize);
  }

  private mapToneToEmotion(amplitude: number, frequency: number): VoiceToneEmotion {
    if (amplitude < 20 && frequency < 300) return "calm";
    if (amplitude < 40 && frequency < 500) return "focused";
    if (amplitude < 50 && frequency > 700) return "curious";
    if (amplitude > 60 && frequency > 600) return "urgent";
    if (amplitude > 70 && frequency > 800) return "stressed";
    if (amplitude > 80 && frequency > 900) return "overloaded";
    if (amplitude > 50 && frequency < 400) return "commanding";

    return "uncertain";
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
