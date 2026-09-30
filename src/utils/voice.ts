// Synthetic Voice Feedback System for Microfyxd OS (Chapter 2 & 21)
type VoiceListener = (isSpeaking: boolean, text: string) => void;

class SyntheticVoiceEngine {
  private isVoiceEnabled: boolean = true;
  private voiceRate: number = 1.0;
  private voicePitch: number = 0.98;
  private listeners: Set<VoiceListener> = new Set();
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeakingNow: boolean = false;
  private speechTimeout: NodeJS.Timeout | null = null;

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
    // Prioritize natural sounding English voices with smooth contour
    this.selectedVoice = 
      voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Ava'))) ||
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

  /**
   * Prepares text for expressive, natural, contoured speech output:
   * Strips code, markdown, symbols, and formatting that cause robotic stutter.
   */
  public cleanForSpeech(raw: string): string {
    if (!raw) return '';
    return raw
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove markdown links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove URLs
      .replace(/https?:\/\/\S+/g, '')
      // Remove markdown headers, bold, italics, bullets, blockquotes
      .replace(/#{1,6}\s+/g, '')
      .replace(/[*_~]{1,3}/g, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*>\s+/gm, '')
      // Remove technical brackets, curly braces
      .replace(/[{}[\]]/g, '')
      // Replace multiple hyphens or underscores
      .replace(/[-_]{2,}/g, ' ')
      // Clean multiple spaces and newlines
      .replace(/\s+/g, ' ')
      .trim();
  }

  public speak(text: string, priority: boolean = false) {
    if (!this.isVoiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }

    try {
      // If priority or interrupted, cancel currently playing utterance
      if (priority || window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      const contouredText = this.cleanForSpeech(text);
      if (!contouredText) return;

      // Small natural conversational pause (120ms) to avoid clipping and allow ear adjustment
      this.speechTimeout = setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(contouredText);
          if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
          }
          utterance.rate = this.voiceRate;
          utterance.pitch = this.voicePitch;

          utterance.onstart = () => {
            this.notify(true, contouredText);
          };

          utterance.onend = () => {
            this.notify(false, '');
          };

          utterance.onerror = () => {
            this.notify(false, '');
          };

          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('Speech synthesis utterance error:', err);
          this.notify(false, '');
        }
      }, 120);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      this.notify(false, '');
    }
  }

  public stop() {
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
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

  public setEnabled(enabled: boolean) {
    this.isVoiceEnabled = enabled;
    if (!enabled) this.stop();
    if (typeof window !== 'undefined') {
      localStorage.setItem('microfyxd_voice_enabled', String(enabled));
    }
  }

  public isSpeaking(): boolean {
    return this.isSpeakingNow;
  }
}

export const voice = new SyntheticVoiceEngine();
