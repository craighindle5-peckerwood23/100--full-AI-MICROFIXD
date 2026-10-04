import test from 'node:test';
import assert from 'node:assert/strict';
import {TTSEngine,speechChunks} from '../src/voice/ttsEngine';
import {deliverSpokenResponse} from '../src/lib/outputDelivery';
import {runSystemCommand} from '../src/lib/commandApi';

test('all speech chunks finish in order before acknowledgment; queue never overlaps',async()=>{
  const originalFetch=globalThis.fetch;const chunks:string[]=[];const release:(()=>void)[]=[];const acknowledgments:any[]=[];
  globalThis.fetch=async(_url,init)=>{acknowledgments.push(JSON.parse(String(init?.body)));return Response.json({success:true});};
  const engine=new TTSEngine(text=>new Promise<void>(resolve=>{chunks.push(text);release.push(resolve);}));
  const text=('Full explanation with retained evidence. ').repeat(60)+'FINAL SENTENCE.';
  let ended=false;
  const delivered=deliverSpokenResponse({speech:text,responseId:'r1',sessionId:'s1'},t=>engine.speak(t,undefined,()=>{ended=true;}));
  const queued=engine.speak('Next response.');
  const expected=speechChunks(engine.cleanTextForSpeech(text));
  try{
    for(let i=0;i<expected.length;i++){
      assert.equal(chunks.length,i+1);assert.equal(acknowledgments.length,0);assert.equal(ended,false);
      release[i]();await new Promise(resolve=>setImmediate(resolve));
    }
    await delivered;assert.equal(ended,true);assert.equal(acknowledgments.length,1);assert.equal(acknowledgments[0].status,'played');
    assert.equal(chunks.slice(0,expected.length).join(''),engine.cleanTextForSpeech(text));
    assert.equal(chunks.at(-1),'Next response.');release.at(-1)!();await queued;
  }finally{engine.interrupt();globalThis.fetch=originalFetch;}
});
test('cancelled and failed playback never acknowledge completion and subsequent speech can run',async()=>{
  const originalFetch=globalThis.fetch;const statuses:string[]=[];
  globalThis.fetch=async(_url,init)=>{statuses.push(JSON.parse(String(init?.body)).status);return Response.json({success:true});};
  const engine=new TTSEngine(()=>new Promise(()=>{}));
  try{
    const delivery=deliverSpokenResponse({speech:'Long explanation',responseId:'r',sessionId:'s'},t=>engine.speak(t));
    engine.interrupt();await assert.rejects(delivery,/cancelled/);assert.deepEqual(statuses,['cancelled']);
    await assert.rejects(deliverSpokenResponse({speech:'Another response',responseId:'r',sessionId:'s'},()=>Promise.reject(new Error('audio device failure'))),/audio device/);
    assert.deepEqual(statuses,['cancelled','failed']);
  }finally{globalThis.fetch=originalFetch;}
});
test('HTTP response body must finish before output is delivered; broken stream rejects',async()=>{
  const originalFetch=globalThis.fetch;let controller:ReadableStreamDefaultController<Uint8Array>;let resolved=false;
  const stream=new ReadableStream<Uint8Array>({start(c){controller=c;c.enqueue(new TextEncoder().encode('{"success":true,"output":"first'));}});
  globalThis.fetch=async()=>new Response(stream,{headers:{'Content-Type':'application/json'}});
  try{
    const command=runSystemCommand('explain',{},'stream-session').then(result=>{resolved=true;return result;});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(resolved,false);
    controller!.enqueue(new TextEncoder().encode(' and final sentence"}'));controller!.close();
    assert.equal((await command).output,'first and final sentence');
    globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"success":true'));c.error(new Error('connection closed early'));}}));
    await assert.rejects(runSystemCommand('broken',{},'stream-session'),/closed early/);
  }finally{globalThis.fetch=originalFetch;}
});

test('browser speech end/error events control resolution rather than submission',async()=>{
  const previousWindow=(globalThis as any).window,previousUtterance=(globalThis as any).SpeechSynthesisUtterance;
  const pending:any[]=[];
  (globalThis as any).window={speechSynthesis:{getVoices:()=>[],speak:(u:any)=>pending.push(u),cancel:()=>{}}};
  (globalThis as any).SpeechSynthesisUtterance=class {constructor(public text:string){}};
  const engine=new TTSEngine();let done=false;
  try{
    const speech=engine.speak('A sentence. '.repeat(150)).then(()=>{done=true;});
    while(!done){
      await new Promise(resolve=>setImmediate(resolve));
      const utterance=pending.shift();assert.ok(utterance);assert.equal(done,false);utterance.onend();
      await new Promise(resolve=>setImmediate(resolve));
    }
    await speech;
    const failed=engine.speak('Must fail.');pending.shift().onerror({error:'audio-busy'});
    await assert.rejects(failed,/audio-busy/);
  }finally{engine.interrupt();(globalThis as any).window=previousWindow;(globalThis as any).SpeechSynthesisUtterance=previousUtterance;}
});
