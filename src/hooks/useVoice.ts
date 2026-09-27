import { useCallback } from "react";
import { speechEngine } from "../voice/speechEngine";
import { ttsEngine }    from "../voice/ttsEngine";
import { useVoiceStore } from "../voice/voiceState";
import { OrganApi }     from "../lib/organApi";

export function useVoice() {
  const store = useVoiceStore();

  const toggle = useCallback(async () => {
    await speechEngine.toggle(async (transcript) => {
      const result = await OrganApi.command(transcript) as { output: string };
      return result.output ?? "";
    });
  }, []);

  const speak    = useCallback((text: string) => ttsEngine.speak(text), []);
  const interrupt = useCallback(() => ttsEngine.interrupt(), []);

  return {
    enabled:           store.enabled,
    mode:              store.mode,
    transcript:        store.transcript,
    interimTranscript: store.interimTranscript,
    isSpeaking:        store.isSpeaking,
    speakingText:      store.speakingText,
    rmsLevel:          store.rmsLevel,
    toggle,
    speak,
    interrupt,
    setConfig:         store.setConfig,
  };
}
