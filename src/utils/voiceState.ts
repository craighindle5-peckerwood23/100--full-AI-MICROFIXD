type VoiceStateListener = (state: { isListening: boolean; isProcessing: boolean }) => void;

class VoiceStateManager {
  private isListening = false;
  private isProcessing = false;
  private listeners: Set<VoiceStateListener> = new Set();

  public setListening(listening: boolean) {
    if (this.isListening !== listening) {
      this.isListening = listening;
      this.notify();
    }
  }

  public setProcessing(processing: boolean) {
    if (this.isProcessing !== processing) {
      this.isProcessing = processing;
      this.notify();
    }
  }

  public getState() {
    return {
      isListening: this.isListening,
      isProcessing: this.isProcessing,
    };
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach(l => l(s));
  }
}

export const voiceState = new VoiceStateManager();
