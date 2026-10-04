/** One ordered playback queue. Completion means every chunk emitted its end event. */
import { useVoiceStore } from './voiceState';
import { VoiceOrgan } from '../lib/organApi';

export function speechChunks(text: string, size = 700): string[] {
  const chunks: string[] = [];
  while (text.length > size) {
    const boundary = text.lastIndexOf(' ', size);
    const end = boundary > size / 2 ? boundary + 1 : size;
    chunks.push(text.slice(0, end)); text = text.slice(end);
  }
  if (text) chunks.push(text);
  return chunks;
}
interface SpeechTask { text:string; start?:()=>void; end?:()=>void; resolve:()=>void; reject:(err:Error)=>void }
export class TTSEngine {
  private queue:SpeechTask[]=[];
  private processing=false;
  private epoch=0;
  private cancelChunk?:()=>void;
  private cleanupChunk?:()=>void;
  private audioEl:HTMLAudioElement|null=null;
  private utterance:SpeechSynthesisUtterance|null=null;
  constructor(private testPlayer?: (text:string)=>Promise<void>) {}
  get isSupported():boolean {return typeof window!=='undefined' && 'speechSynthesis' in window;}
  speak(text:string,onStart?:()=>void,onEnd?:()=>void):Promise<void> {
    const promise=new Promise<void>((resolve,reject)=>{
      this.queue.push({text:this.cleanTextForSpeech(text),start:onStart,end:onEnd,resolve,reject});
      void this.drain();
    });
    // Some notification callers deliberately do not await; still report their failures.
    void promise.catch(err=>console.warn('[tts] Playback incomplete:',err.message));
    return promise;
  }
  interrupt():void {
    this.epoch++;
    this.queue.splice(0).forEach(task=>task.reject(new Error('Playback cancelled')));
    this.cancelChunk?.();
    if(typeof window!=='undefined')window.speechSynthesis?.cancel();
    this.audioEl?.pause();
  }
  private async drain():Promise<void> {
    if(this.processing)return;
    this.processing=true;
    while(this.queue.length){
      const task=this.queue.shift()!;const epoch=this.epoch;
      try {
        if(!task.text)throw new Error('No speakable text');
        task.start?.();useVoiceStore.getState().setSpeaking(true,task.text);
        const chunks=speechChunks(task.text);
        for(const chunk of chunks){
          if(epoch!==this.epoch)throw new Error('Playback cancelled');
          await this.playChunk(chunk,epoch);
        }
        if(epoch!==this.epoch)throw new Error('Playback cancelled');
        task.end?.();task.resolve();
      } catch(err){task.reject(err instanceof Error?err:new Error(String(err)));}
      finally {useVoiceStore.getState().setSpeaking(false);}
    }
    this.processing=false;
  }
  private playChunk(text:string,epoch:number):Promise<void> {
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(err?:Error)=>{
        if(settled)return;settled=true;clearTimeout(timer);this.cancelChunk=undefined;
        this.cleanupChunk?.();this.cleanupChunk=undefined;
        if(err){this.audioEl?.pause();if(typeof window!=='undefined')window.speechSynthesis?.cancel();reject(err);}else resolve();
      };
      this.cancelChunk=()=>finish(new Error('Playback cancelled'));
      const timer=setTimeout(()=>finish(new Error('Playback end acknowledgment timed out')),120000);
      const play=async()=>{
        if(this.testPlayer){await this.testPlayer(text);return;}
        if(useVoiceStore.getState().ttsMethod==='elevenlabs'){
          let result:{audio_base64?:string;content_type?:string}|undefined;
          try {result=await VoiceOrgan.synthesize(text,useVoiceStore.getState().voiceId) as typeof result;}
          catch(err){if(settled || epoch!==this.epoch)throw err;console.warn('[tts] Provider failed; using browser playback');}
          if(settled || epoch!==this.epoch)throw new Error('Playback cancelled');
          if(result?.audio_base64){await this.playAudio(result.audio_base64,result.content_type);return;}
        }
        if(settled || epoch!==this.epoch)throw new Error('Playback cancelled');
        await this.playBrowser(text);
      };
      void play().then(()=>finish(),err=>finish(err instanceof Error?err:new Error(String(err))));
    });
  }
  private playAudio(base64:string,type='audio/mpeg'):Promise<void>{
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type}));
      const audio=new Audio(url);this.audioEl=audio;
      const release=()=>{audio.pause();audio.onended=null;audio.onerror=null;URL.revokeObjectURL(url);this.audioEl=null;};
      this.cleanupChunk=release;
      audio.onended=()=>{release();resolve();};audio.onerror=()=>{release();reject(new Error('Audio playback failed'));};
      audio.play().catch(err=>{release();reject(err);});
    });
  }
  private playBrowser(text:string):Promise<void>{
    return new Promise((resolve,reject)=>{
      if(!this.isSupported){reject(new Error('Browser speech synthesis unavailable'));return;}
      const utterance=new SpeechSynthesisUtterance(text);this.utterance=utterance;
      utterance.lang=useVoiceStore.getState().language;utterance.rate=0.95;utterance.pitch=1;
      const voices=window.speechSynthesis.getVoices();
      utterance.voice=voices.find(v=>v.lang.startsWith('en')&&v.localService) || voices[0] || null;
      this.cleanupChunk=()=>{utterance.onend=null;utterance.onerror=null;this.utterance=null;};
      utterance.onend=()=>{this.utterance=null;resolve();};
      utterance.onerror=e=>{this.utterance=null;reject(new Error(`Speech playback failed: ${e.error}`));};
      window.speechSynthesis.speak(utterance);
    });
  }
  cleanTextForSpeech(text:string):string {
    return text.replace(/```[\s\S]*?```/g,' code block available in the written response ')
      .replace(/`([^`]+)`/g,'$1').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
      .replace(/[*_#]/g,'').replace(/\s+/g,' ').trim();
  }
}
export const ttsEngine=new TTSEngine();
