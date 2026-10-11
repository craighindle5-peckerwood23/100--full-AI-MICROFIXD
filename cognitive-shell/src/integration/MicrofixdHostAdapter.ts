import type{ShellChannels,ShellCommand,TelemetryEvent,TelemetryStream}from'./ShellAPI';

type Listener=(e:TelemetryEvent)=>void;
export interface MicrofixdHostOptions{baseUrl?:string;token:string;sessionId?:string;source?:string;healthIntervalMs?:number}

export function createMicrofixdHostAdapter(o:MicrofixdHostOptions):ShellChannels&{close():void}{
  const base=(o.baseUrl||window.location.origin).replace(/\/$/,'');
  const listeners=new Set<Listener>();
  const sessionId=o.sessionId||crypto.randomUUID();
  let ws:WebSocket|null=null,reconnectTimer=0,healthTimer=0,retry=0,closed=false;
  const emit=(event:TelemetryEvent)=>listeners.forEach(fn=>fn(event));
  const normalize=(m:any):TelemetryEvent=>{const p=m?.payload&&typeof m.payload==='object'?m.payload:{};return{type:String(m?.type||'unknown'),timestamp:m?.ts?Date.parse(m.ts):Date.now(),severity:p.severity,state:p.state,message:p.message,agents:Number.isFinite(p.agents)?p.agents:undefined,signal:Number.isFinite(p.signal)?p.signal:undefined,data:p}};

  const connect=()=>{
    if(closed)return;
    const socket=new WebSocket(base.replace(/^http/,'ws')+'/ws');ws=socket;
    socket.addEventListener('open',()=>{retry=0;socket.send(JSON.stringify({type:'authenticate',payload:{token:o.token}}));emit({type:'connection.open',state:'authenticating',signal:75,timestamp:Date.now()})});
    socket.addEventListener('message',e=>{try{const m=JSON.parse(String(e.data));emit(normalize(m))}catch{emit({type:'telemetry.parse-error',severity:'warn',state:'degraded',message:'Malformed telemetry frame ignored',timestamp:Date.now()})}});
    socket.addEventListener('close',()=>{if(closed)return;emit({type:'connection.closed',severity:'warn',state:'reconnecting',signal:20,timestamp:Date.now()});const delay=Math.min(8000,600*Math.pow(2,retry++));window.clearTimeout(reconnectTimer);reconnectTimer=window.setTimeout(connect,delay)});
    socket.addEventListener('error',()=>{try{socket.close()}catch{}});
  };

  const probeHealth=async()=>{
    try{
      const readyResp=await fetch(base+'/readyz',{cache:'no-store'});
      const ready=await readyResp.json().catch(()=>({}));
      emit({type:'system.readiness',timestamp:Date.now(),state:String(ready.status|| (readyResp.ok?'ok':'degraded')),severity:readyResp.ok?'info':'warn',signal:readyResp.ok?100:45,message:readyResp.ok?'Runtime readiness verified':'Runtime reports degraded readiness',data:ready});
    }catch(error){emit({type:'system.readiness',timestamp:Date.now(),state:'unreachable',severity:'error',signal:0,message:String(error)})}
    try{
      const deepResp=await fetch(base+'/api/health/deep',{cache:'no-store',headers:{authorization:'Bearer '+o.token}});
      const deep=await deepResp.json().catch(()=>({}));
      const runtime=deep?.runtime||{};const failed=Array.isArray(runtime.failedOrgans)?runtime.failedOrgans:[];
      emit({type:'system.deep-health',timestamp:Date.now(),state:String(deep.status|| (deepResp.ok?'ok':'degraded')),severity:failed.length?'warn':deepResp.ok?'info':'warn',agents:Number(runtime.registeredOrgans)||0,signal:deepResp.ok&&deep.ready!==false?100:55,message:failed.length?`${failed.length} registered organ(s) report error`:'Authenticated runtime health verified',data:deep});
    }catch(error){emit({type:'system.deep-health',timestamp:Date.now(),state:'unavailable',severity:'warn',signal:35,message:String(error)})}
  };

  const telemetry$:TelemetryStream={subscribe(next){listeners.add(next);return()=>listeners.delete(next)}};

  async function sendCommand(command:ShellCommand){
    const task=String(command.payload?.text||command.payload?.task||'').trim();
    if(!task)throw new Error('Shell command requires payload.text or payload.task');
    const requestId=command.requestId||crypto.randomUUID();
    emit({type:'command.submitted',timestamp:Date.now(),state:'thinking',message:task,data:{requestId}});
    const response=await fetch(base+'/api/command/run',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+o.token},body:JSON.stringify({task,session_id:sessionId,source:o.source||'cognitive-shell',context:{shellCommand:{...command,requestId}}})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){emit({type:'command.error',timestamp:Date.now(),state:'error',severity:'error',message:String(body?.error||body?.message||`Command rejected: ${response.status}`),data:{requestId,status:response.status,...body}});throw new Error(String(body?.error||body?.message||`Command rejected: ${response.status}`))}
    const ok=body?.success!==false;
    emit({type:ok?'command.completed':'command.failed',timestamp:Date.now(),state:ok?'idle':'error',severity:ok?'info':'error',message:String(body?.output||body?.message|| (ok?'Command completed':'Command failed')),data:{requestId,...body}});
  }

  connect();void probeHealth();healthTimer=window.setInterval(()=>void probeHealth(),Math.max(5000,o.healthIntervalMs||15000));
  return{telemetry$,sendCommand,close(){closed=true;window.clearTimeout(reconnectTimer);window.clearInterval(healthTimer);try{ws?.close()}catch{}listeners.clear()}};
}