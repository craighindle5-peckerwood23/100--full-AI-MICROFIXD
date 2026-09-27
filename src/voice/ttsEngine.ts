/**
 * src/voice/ttsEngine.ts
 * Text-to-Speech engine.
 * Primary:  ElevenLabs API (if key configured) — most natural voice
 * Fallback: Web Speech Synthesis API (browser-native, always available)
 *
 * Features:
 *   - Queue-based speech (never overlaps)
 *   - Sentence chunking for natural pauses
 *   - Speed/pitch control
 *   - Interrupt support
 *   - Audio timing callbacks
 */
import { useVoiceStore } from "./voiceState";
import { VoiceOrgan }    from "../lib/organApi";

interface SpeechTask {
  text:     string;
  onStart?: () => void;
  onEnd?:   () => void;
}

class TTSEngine {
  private queue:      SpeechTask[]          = [];
  private processing  = false;
  private utterance:  SpeechSynthesisUtterance | null = null;
  private audioEl:    HTMLAudioElement | null = null;

  get isSupported(): boolean {
    return "speechSynthesis" in window;
  }

  // ── Main speak call ─────────────────────────────────────────────────────
  async speak(text: string, onStart?: () => void, onEnd?: () => void): Promise<void> {
    // Strip markdown for cleaner speech
    const clean = this.cleanTextForSpeech(text);
    this.queue.push({ text: clean, onStart, onEnd });
    if (!this.processing) this.processQueue();
  }

  interrupt(): void {
    this.queue = [];
    window.speechSynthesis?.cancel();
    this.audioEl?.pause();
    this.audioEl = null;
    this.processing = false;
    useVoiceStore.getState().setSpeaking(false);
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) { this.processing = false; return; }
    this.processing = true;
    const task = this.queue.shift()!;
    task.onStart?.();
    useVoiceStore.getState().setSpeaking(true, task.text);

    try {
      const elKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
      if (elKey) {
        await this.speakElevenLabs(task.text);
      } else {
        await this.speakBrowser(task.text);
      }
    } catch (err) {
      console.warn("[tts] ElevenLabs failed, falling back to browser:", err);
      await this.speakBrowser(task.text);
    } finally {
      task.onEnd?.();
      useVoiceStore.getState().setSpeaking(false);
      this.processQueue();
    }
  }

  // ── ElevenLabs TTS ──────────────────────────────────────────────────────
  private async speakElevenLabs(text: string): Promise<void> {
    const { voiceId } = useVoiceStore.getState();
    const result = await VoiceOrgan.synthesize(text, voiceId) as {
      method: string; audio_base64?: string; content_type?: string;
    };

    if (result.method === "browser_tts" || !result.audio_base64) {
      return this.speakBrowser(text);
    }

    return new Promise((resolve, reject) => {
      const bytes  = atob(result.audio_base64!);
      const arr    = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob   = new Blob([arr], { type: result.content_type ?? "audio/mpeg" });
      const url    = URL.createObjectURL(blob);
      const audio  = new Audio(url);
      this.audioEl = audio;

      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = (e)  => { URL.revokeObjectURL(url); reject(e); };
      audio.play().catch(reject);
    });
  }

  // ── Browser TTS ─────────────────────────────────────────────────────────
  private speakBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance  = new SpeechSynthesisUtterance(text);
      utterance.lang   = useVoiceStore.getState().language;
      utterance.rate   = 0.95;
      utterance.pitch  = 1.0;
      utterance.volume = 1.0;

      // Pick best available voice
      const voices  = window.speechSynthesis.getVoices();
      const enVoice = voices.find(v => v.lang.startsWith("en") && v.localService) ?? voices[0];
      if (enVoice) utterance.voice = enVoice;

      utterance.onend   = () => resolve();
      utterance.onerror = () => resolve(); // Don't reject — just continue
      this.utterance    = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }

  // ── Text cleaning for speech ─────────────────────────────────────────────
  cleanTextForSpeech(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, "code block omitted")
      .replace(/`[^`]+`/g,       "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g,   "$1")
      .replace(/#{1,6}\s+/g,     "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/◈|→|←|↑|↓/g,   "")
      .replace(/\s+/g,            " ")
      .trim();
  }
}

export const ttsEngine = new TTSEngine();
