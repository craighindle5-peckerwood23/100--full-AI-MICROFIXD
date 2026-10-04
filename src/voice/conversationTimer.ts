/**
 * src/voice/conversationTimer.ts
 * Conversation timing manager.
 * Handles:
 *   - Turn-taking (wait for human to finish before responding)
 *   - Silence detection windows
 *   - Response timing (don't interrupt while thinking)
 *   - Conversation state machine
 */
import { useVoiceStore } from "./voiceState";

export type ConvState = "idle" | "human_talking" | "waiting_for_silence" | "ai_processing" | "ai_speaking" | "turn_transition";

type StateChangeCallback = (state: ConvState) => void;

class ConversationTimer {
  private state:         ConvState = "idle";
  private listeners:     StateChangeCallback[] = [];
  private silenceTimer:  NodeJS.Timeout | null = null;
  private processingStart = 0;

  getState(): ConvState { return this.state; }

  onStateChange(cb: StateChangeCallback): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private setState(s: ConvState): void {
    if (this.state === s) return;
    this.state = s;
    this.listeners.forEach(l => l(s));
    console.log(`[conv_timer] State → ${s}`);
  }

  // Called when STT detects speech
  onHumanSpeech(): void {
    this.clearSilenceTimer();
    if (["ai_speaking", "ai_processing", "turn_transition"].includes(this.state)) {
      // Ignore microphone echo during playback. Explicit Stop remains available.
      return;
    }
    this.setState("human_talking");
  }

  // Called when STT detects silence after speech
  onSilenceDetected(transcript: string, submitFn: (t: string) => void): void {
    if (this.state !== "human_talking") return;
    this.setState("waiting_for_silence");

    const { turnWaitMs } = useVoiceStore.getState();
    this.silenceTimer = setTimeout(() => {
      if (transcript.trim()) {
        this.setState("ai_processing");
        this.processingStart = Date.now();
        submitFn(transcript);
      } else {
        this.setState("idle");
      }
    }, turnWaitMs);
  }

  // Called when AI starts generating
  onAIProcessing(): void {
    this.setState("ai_processing");
  }

  // Called when AI response ready — start speaking
  async onAIResponseReady(text: string): Promise<void> {
    this.setState("ai_speaking");
    try {
      const {ttsEngine}=await import("./ttsEngine");
      await ttsEngine.speak(text);
    } finally {this.setState("idle");}
  }

  // Reset to idle
  reset(): void {
    this.clearSilenceTimer();
    import("./ttsEngine").then(({ ttsEngine }) => ttsEngine.interrupt());
    this.setState("idle");
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
  }
}

export const conversationTimer = new ConversationTimer();
