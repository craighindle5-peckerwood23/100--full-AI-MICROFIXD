// Synthetic Voice Feedback System for Microfyxd OS (Chapter 2 & 21)
type VoiceListener = (isSpeaking: boolean, text: string) => void;

class SyntheticVoiceEngine {
  private isVoiceEnabled: boolean = true;
  private voiceRate: number = 1.05;
  private voicePitch: number = 0.92;
  private listeners: Set<VoiceListener> = new Set();
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeakingNow: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('microfyxd_voice_enabled');
      this.isVoiceEnabled = saved !== 'false';

      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.initVoice();
        };
        this.initVoice();
      }
    }
  }

  private initVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // Prioritize natural English synthetic voice
    this.selectedVoice = 
      voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel'))) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0] || null;
  }

  public subscribe(fn: VoiceListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(isSpeaking: boolean, text: string = '') {
    this.isSpeakingNow = isSpeaking;
    this.listeners.forEach(fn => fn(isSpeaking, text));
  }

  public speak(text: string, priority: boolean = false) {
    if (!this.isVoiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      if (priority) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = this.voiceRate;
      utterance.pitch = this.voicePitch;

      utterance.onstart = () => {
        this.notify(true, text);
      };

      utterance.onend = () => {
        this.notify(false, '');
      };

      utterance.onerror = () => {
        this.notify(false, '');
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      this.notify(false, '');
    }
  }

  public stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.notify(false, '');
    }
  }

  public toggleVoice(): boolean {
    this.isVoiceEnabled = !this.isVoiceEnabled;
    if (!this.isVoiceEnabled) {
      this.stop();
    }
    localStorage.setItem('microfyxd_voice_enabled', String(this.isVoiceEnabled));
    return this.isVoiceEnabled;
  }

  public isEnabled(): boolean {
    return this.isVoiceEnabled;
  }

  public isSpeaking(): boolean {
    return this.isSpeakingNow;
  }
}

export const voice = new SyntheticVoiceEngine();
