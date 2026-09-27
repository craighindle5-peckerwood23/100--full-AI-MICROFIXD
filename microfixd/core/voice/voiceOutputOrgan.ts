// microfixd/core/voice/voiceOutputOrgan.ts
import { UnifiedWiringOrgan } from "../wiring/unifiedWiring";
import { MemoryOrgan } from "../memory/memory";
import { SyntheticEmotionEngine } from "../autonomy/syntheticEmotionEngine";
import { CognitiveFeedbackLoop } from "../autonomy/cognitiveFeedbackLoop";

export interface VoiceOutputEvent {
  id: string;
  text: string;
  emotion: string;
  createdAt: string;
}

export class VoiceOutputOrgan {
  private synth?: SpeechSynthesis;

  constructor(
    private wiring: UnifiedWiringOrgan,
    private memory: MemoryOrgan,
    private emotion: SyntheticEmotionEngine,
    private cognition: CognitiveFeedbackLoop
  ) {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis;
    }
  }

  speak(text: string) {
    if (!this.synth) return;

    const emotion = this.emotion.getCurrentEmotion();

    const event: VoiceOutputEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      emotion,
      createdAt: new Date().toISOString(),
    };

    this.memory.remember("voice_output_event", JSON.stringify(event), { emotion });
    this.wiring.broadcast("emotion", { type: "voice_output", text, emotion });
    this.wiring.broadcast("cognition", { type: "voice_output", text });

    const utter = new SpeechSynthesisUtterance(text);

    // Emotion → voice modulation
    switch (emotion) {
      case "neutral":
        utter.pitch = 1.0;
        utter.rate = 1.0;
        break;
      case "focused":
        utter.pitch = 1.1;
        utter.rate = 1.05;
        break;
      case "curious":
        utter.pitch = 1.3;
        utter.rate = 1.1;
        break;
      case "confident":
        utter.pitch = 0.9;
        utter.rate = 1.0;
        break;
      case "stressed":
        utter.pitch = 1.4;
        utter.rate = 1.2;
        break;
      case "overloaded":
        utter.pitch = 0.7;
        utter.rate = 0.9;
        break;
      case "recovering":
        utter.pitch = 0.8;
        utter.rate = 0.95;
        break;
      case "adaptive":
        utter.pitch = 1.15;
        utter.rate = 1.05;
        break;
    }

    this.synth.speak(utter);
  }
}
