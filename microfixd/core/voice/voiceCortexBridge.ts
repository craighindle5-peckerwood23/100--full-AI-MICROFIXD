// @ts-nocheck
/**
 * microfixd/core/voice/voiceCortexBridge.ts
 * VOICE → CORTEX BRIDGE
 * Wires browser Web Speech API → LangGraph cortex pipeline.
 * VoiceOrgan (existing) handles TTS output.
 * This handles STT input → runCortex() → voice response.
 */
import { runCortex } from "../../langgraph/graph";

type TranscriptCallback = (text: string) => void;
type ResponseCallback   = (text: string) => void;
type StatusCallback     = (status: "listening" | "processing" | "speaking" | "idle") => void;

class VoiceCortexBridge {
  private recognition: SpeechRecognition | null = null;
  private synth        = window.speechSynthesis;
  private _active      = false;
  private _continuous  = false;

  onTranscript?: TranscriptCallback;
  onResponse?:   ResponseCallback;
  onStatus?:     StatusCallback;

  init(): boolean {
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
            ?? (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) {
      console.warn("[voice_cortex] Web Speech API not supported in this browser.");
      return false;
    }

    this.recognition = new SR();
    this.recognition.continuous    = false;
    this.recognition.interimResults = false;
    this.recognition.lang           = "en-US";

    this.recognition.onresult = async (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;

      this.onTranscript?.(transcript);
      this.onStatus?.("processing");

      try {
        const result   = await runCortex(transcript, `voice_${Date.now()}`);
        const response = result.final_output || "Task complete.";
        this.onResponse?.(response);
        this.speak(response);
      } catch (err) {
        const errMsg = "I encountered an error. Please try again.";
        this.speak(errMsg);
        this.onResponse?.(errMsg);
      }
    };

    this.recognition.onstart = () => this.onStatus?.("listening");
    this.recognition.onend   = () => {
      if (this._continuous && this._active) {
        setTimeout(() => this.recognition?.start(), 500);
      } else {
        this.onStatus?.("idle");
      }
    };

    this.recognition.onerror = (e) => {
      console.warn("[voice_cortex] Recognition error:", e.error);
      this.onStatus?.("idle");
    };

    return true;
  }

  startListening(continuous = false): boolean {
    if (!this.recognition) return false;
    this._active     = true;
    this._continuous = continuous;
    this.onStatus?.("listening");
    this.recognition.start();
    return true;
  }

  stopListening(): void {
    this._active = false;
    this.recognition?.stop();
    this.onStatus?.("idle");
  }

  speak(text: string, voice?: string): void {
    this.synth.cancel();
    this.onStatus?.("speaking");
    const utt         = new SpeechSynthesisUtterance(text);
    utt.rate          = 0.95;
    utt.pitch         = 1.0;
    utt.volume        = 1.0;
    utt.onend         = () => {
      this.onStatus?.("idle");
      if (this._continuous && this._active) {
        setTimeout(() => this.recognition?.start(), 300);
      }
    };

    // Use preferred voice if available
    const voices = this.synth.getVoices();
    const preferred = voice
      ? voices.find(v => v.name.includes(voice))
      : voices.find(v => v.lang === "en-US" && v.localService);
    if (preferred) utt.voice = preferred;

    this.synth.speak(utt);
  }

  isActive(): boolean { return this._active; }
}

export const voiceCortexBridge = new VoiceCortexBridge();
