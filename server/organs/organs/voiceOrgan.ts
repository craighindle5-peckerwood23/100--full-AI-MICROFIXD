/**
 * Voice Organ — server-side TTS via ElevenLabs or OS TTS
 * Client-side STT handled by Bundle G (browser Web Speech API)
 * Actions: synthesize, list_voices, status
 */
import https from "https";

const ELEVENLABS_KEY     = process.env.ELEVENLABS_API_KEY ?? "";
const DEFAULT_VOICE_ID   = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // Rachel voice

async function elevenLabsTTS(text: string, voiceId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const data   = JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.8 } });
    const opts   = {
      hostname: "api.elevenlabs.io",
      path:     `/v1/text-to-speech/${voiceId}`,
      method:   "POST",
      headers:  { "xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    };
    const req    = https.request(opts, res => {
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c));
      res.on("end",  ()  => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

export async function executeVoiceOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  switch (action) {
    case "synthesize": {
      if (!ELEVENLABS_KEY) {
        return { method: "browser_tts", text: String(p.text ?? ""), note: "No ElevenLabs key — use browser TTS" };
      }
      const audio  = await elevenLabsTTS(String(p.text ?? ""), String(p.voice_id ?? DEFAULT_VOICE_ID));
      return { method: "elevenlabs", audio_base64: audio.toString("base64"), content_type: "audio/mpeg" };
    }
    case "list_voices": {
      if (!ELEVENLABS_KEY) return { voices: [], note: "No ElevenLabs key" };
      const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": ELEVENLABS_KEY } });
      return r.json();
    }
    case "status":
      return { elevenlabs_configured: !!ELEVENLABS_KEY, default_voice_id: DEFAULT_VOICE_ID };
    default:
      throw new Error(`Voice organ: unknown action '${action}'`);
  }
}
