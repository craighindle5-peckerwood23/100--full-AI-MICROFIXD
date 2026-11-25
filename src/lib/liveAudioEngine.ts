/**
 * src/lib/liveAudioEngine.ts
 * Low-latency duplex PCM audio capture (16 kHz PCM16 LE) and gapless
 * audio playback (24 kHz PCM16 LE) for Gemini Live API.
 */

function float32ToInt16Base64(float32: Float32Array, sourceRate: number, targetRate = 16000): string {
  let samples = float32;
  if (sourceRate !== targetRate && sourceRate > targetRate) {
    const ratio = sourceRate / targetRate;
    const targetLen = Math.floor(float32.length / ratio);
    const resampled = new Float32Array(targetLen);
    for (let i = 0; i < targetLen; i++) {
      const idx = i * ratio;
      const lo = Math.floor(idx);
      const hi = Math.min(float32.length - 1, lo + 1);
      const frac = idx - lo;
      resampled[i] = float32[lo] * (1 - frac) + float32[hi] * frac;
    }
    samples = resampled;
  }

  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): { float32: Float32Array; rms: number } {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const float32 = new Float32Array(int16.length);
  let sumSq = 0;
  for (let i = 0; i < int16.length; i++) {
    const v = int16[i] / 0x8000;
    float32[i] = v;
    sumSq += v * v;
  }
  const rms = int16.length > 0 ? Math.min(1, Math.sqrt(sumSq / int16.length) * 3) : 0;
  return { float32, rms };
}

export class LiveAudioEngine {
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private muted = false;

  async startMic(options: {
    onChunk: (base64Pcm16: string, rms: number) => void;
    onLevel?: (rms: number) => void;
  }): Promise<void> {
    this.stopMic();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser audio capture API (getUserMedia) is unavailable.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    this.micStream = stream;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx({ sampleRate: 16000 });
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.inputCtx = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    this.micSource = source;
    this.processor = processor;
    this.silentGain = silentGain;

    processor.onaudioprocess = (event) => {
      if (this.muted) {
        options.onLevel?.(0);
        return;
      }
      const data = event.inputBuffer.getChannelData(0);
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        sumSq += data[i] * data[i];
      }
      const rms = data.length > 0 ? Math.min(1, Math.sqrt(sumSq / data.length) * 3.5) : 0;
      options.onLevel?.(rms);
      const encoded = float32ToInt16Base64(data, ctx.sampleRate, 16000);
      options.onChunk(encoded, rms);
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  stopMic(): void {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }
    this.micSource?.disconnect();
    this.micSource = null;
    this.silentGain?.disconnect();
    this.silentGain = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    if (this.inputCtx) {
      void this.inputCtx.close().catch(() => {});
      this.inputCtx = null;
    }
  }

  async playPcm24kChunk(
    base64: string,
    callbacks?: { onStart?: (rms: number) => void; onDrain?: () => void },
  ): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!this.outputCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.outputCtx = new AudioCtx({ sampleRate: 24000 });
    }
    if (this.outputCtx.state === 'suspended') {
      await this.outputCtx.resume();
    }

    const { float32, rms } = base64Pcm16ToFloat32(base64);
    if (float32.length === 0) return;

    const buffer = this.outputCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.outputCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputCtx.destination);

    const now = this.outputCtx.currentTime;
    const startAt = Math.max(now, this.nextStartTime);
    this.nextStartTime = startAt + buffer.duration;

    this.activeSources.add(source);
    callbacks?.onStart?.(rms);

    source.onended = () => {
      source.disconnect();
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.nextStartTime = 0;
        callbacks?.onDrain?.();
      }
    };

    source.start(startAt);
  }

  interruptPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // ignore stopped source errors
      }
    }
    this.activeSources.clear();
    this.nextStartTime = 0;
  }

  isPlaying(): boolean {
    return this.activeSources.size > 0;
  }

  destroy(): void {
    this.stopMic();
    this.interruptPlayback();
    if (this.outputCtx) {
      void this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }
  }
}

export const liveAudioEngine = new LiveAudioEngine();
