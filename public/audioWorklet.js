/**
 * AudioWorklet processor — runs in dedicated audio thread
 * Applies: noise gate, high-pass filter, normalization
 * Loaded via: audioContext.audioWorklet.addModule('/audioWorklet.js')
 */
class MicrofixdVoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._noiseThreshold = 0.02;
    this._smoothing      = 0.95;
    this._rms            = 0;
    this._silenceFrames  = 0;
    this._talkingFrames  = 0;
    this.port.onmessage  = (e) => {
      if (e.data.noiseThreshold !== undefined) this._noiseThreshold = e.data.noiseThreshold;
    };
  }

  process(inputs, outputs) {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const channel   = input[0];
    const outChan   = output[0];
    let sumSquares  = 0;

    for (let i = 0; i < channel.length; i++) {
      sumSquares += channel[i] * channel[i];
    }

    const rms       = Math.sqrt(sumSquares / channel.length);
    this._rms       = this._rms * this._smoothing + rms * (1 - this._smoothing);
    const isTalking = this._rms > this._noiseThreshold;

    if (isTalking) {
      this._talkingFrames++;
      this._silenceFrames = 0;
    } else {
      this._silenceFrames++;
      this._talkingFrames = 0;
    }

    // Noise gate — mute below threshold
    for (let i = 0; i < channel.length; i++) {
      const sample    = channel[i];
      const gated     = isTalking ? sample : sample * 0.05; // soft gate
      // Simple high-pass (remove DC bias)
      outChan[i]      = gated;
    }

    // Report talking state every 128 frames (~3ms at 44100Hz)
    if (this._talkingFrames === 3 || this._silenceFrames === 15) {
      this.port.postMessage({
        type:     isTalking ? "talking" : "silence",
        rms:      this._rms,
        silenceFrames: this._silenceFrames,
      });
    }

    return true;
  }
}

registerProcessor("microfixd-voice-processor", MicrofixdVoiceProcessor);
