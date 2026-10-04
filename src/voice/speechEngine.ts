import {deliverSpokenResponse} from '../lib/outputDelivery';
/**
 * src/voice/speechEngine.ts
 * MASTER SPEECH ENGINE
 * Orchestrates: STT → speechCleaner → conversationTimer → TTS
 * Single entry point for all voice functionality.
 */
import { sttEngine }         from "./sttEngine";
import { ttsEngine }         from "./ttsEngine";
import { speechCleaner }     from "./speechCleaner";
import { conversationTimer } from "./conversationTimer";
import { useVoiceStore }     from "./voiceState";
import { OrganApi }          from "../lib/organApi";
import { omniRouter }        from "../utils/omniRouter";

type SubmitCallback = (transcript: string) => Promise<string>;

class SpeechEngine {
  private _active     = false;
  private _submitFn?: SubmitCallback;

  /** Main toggle — enables/disables entire voice system */
  async enable(submitFn: SubmitCallback): Promise<void> {
    if (this._active) return;
    this._submitFn = submitFn;
    this._active   = true;
    useVoiceStore.getState().setEnabled(true);

    // Start AudioWorklet cleaner
    await speechCleaner.start();

    const { language, wakeWord } = useVoiceStore.getState();

    // Start STT
    sttEngine.start(
      // onFinal — transcript segment ready
      (final, _interim) => {
        conversationTimer.onHumanSpeech();
      },
      // onSilence — submit after pause
      (transcript) => {
        const { enabled } = useVoiceStore.getState();
        if (!enabled || ["ai_speaking", "ai_processing", "turn_transition"].includes(conversationTimer.getState())) return;

        // Wake word check
        if (sttEngine.detectWakeWord(transcript, wakeWord)) {
          this.speak("Yes, I'm listening.");
          return;
        }

        conversationTimer.onSilenceDetected(transcript, async (t) => {
          conversationTimer.onAIProcessing();
          try {
            // Send to Groq Central Command & Orchestration Layer
            const decision = await omniRouter.evaluateAndOrchestrate(t, "ai_core", "spoken");
            await deliverSpokenResponse(decision,text=>conversationTimer.onAIResponseReady(text));
          } catch (err) {
            this.speak(`The command failed. ${err instanceof Error ? err.message : String(err)}`);
            conversationTimer.reset();
          }
        });
      },
      language,
    );

    console.log("[speech_engine] Voice system enabled");
  }

  async disable(): Promise<void> {
    if (!this._active) return;
    this._active = false;
    sttEngine.stop();
    ttsEngine.interrupt();
    speechCleaner.stop();
    conversationTimer.reset();
    useVoiceStore.getState().setEnabled(false);
    useVoiceStore.getState().reset();
    console.log("[speech_engine] Voice system disabled");
  }

  speak(text: string): void {
    ttsEngine.speak(text);
  }

  toggle(submitFn: SubmitCallback): void {
    if (this._active) this.disable();
    else this.enable(submitFn);
  }

  isActive(): boolean { return this._active; }
}

export const speechEngine = new SpeechEngine();
