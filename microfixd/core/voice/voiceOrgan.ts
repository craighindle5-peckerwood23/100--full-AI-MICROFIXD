// microfixd/core/voice/voiceOrgan.ts
import { UnifiedWiringOrgan } from "../wiring/unifiedWiring";
import { MemoryOrgan } from "../memory/memory";
import { AgentRouterOrgan } from "../agents/agentRouter";
import { SyntheticEmotionEngine } from "../autonomy/syntheticEmotionEngine";
import { CognitiveFeedbackLoop } from "../autonomy/cognitiveFeedbackLoop";
import { MissionStateMachine } from "../autonomy/missionStateMachine";
import { VoiceCommandGrammarEngine } from "./voiceCommandGrammarEngine";

export interface VoiceEvent {
  id: string;
  transcript: string;
  confidence: number;
  createdAt: string;
}

export class VoiceOrgan {
  private running = false;
  private recognition: any;

  constructor(
    private wiring: UnifiedWiringOrgan,
    private memory: MemoryOrgan,
    private router: AgentRouterOrgan,
    private emotion: SyntheticEmotionEngine,
    private cognition: CognitiveFeedbackLoop,
    private mission: MissionStateMachine,
    private voiceGrammar: VoiceCommandGrammarEngine
  ) {}

  async start() {
    // Register listener for UI activation
    this.wiring.on("voice", (payload) => {
      if (payload.type === "start_sensors") {
        this.initialize();
      }
    });
  }

  private async initialize() {
    if (this.running) return;
    
    // Guard for non-browser environments
    if (typeof window === 'undefined') {
      console.warn("VoiceOrgan: SpeechRecognition is only available in browser environments.");
      return;
    }

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SpeechRecognition) {
      console.error("VoiceOrgan: SpeechRecognition API not supported in this browser.");
      return;
    }

    this.running = true;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript.trim();
      const confidence = result[0].confidence;

      this.handleTranscript(transcript, confidence);
    };

    this.recognition.onerror = (event: any) => {
      console.error("VoiceOrgan Error:", event.error);
      if (event.error === 'not-allowed') {
        this.running = false; // Stop trying to restart if permission is denied
      }
    };

    this.recognition.onend = () => {
      if (this.running) {
        try {
          this.recognition.start();
        } catch (err) {
          console.error("VoiceOrgan: Failed to restart recognition", err);
          this.running = false;
        }
      }
    };

    try {
      this.recognition.start();
    } catch (err) {
      console.error("VoiceOrgan: Initial start failed", err);
      this.running = false;
    }
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  private async handleTranscript(transcript: string, confidence: number) {
    const event: VoiceEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      transcript,
      confidence,
      createdAt: new Date().toISOString(),
    };

    this.memory.remember("voice_event", JSON.stringify(event), { transcript });
    
    // Broadcast across multiple channels
    this.wiring.broadcast("cognition", event);
    this.wiring.broadcast("emotion", { type: "voice_input", transcript });
    this.wiring.broadcast("agent", { type: "voice_command", transcript });

    const parsed = this.voiceGrammar.parse(transcript);
    await this.voiceGrammar.execute(parsed);
  }
}
