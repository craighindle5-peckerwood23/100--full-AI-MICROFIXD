import React,{useEffect,useRef}from'react';
import{attachChannels,createMicrofixdHostAdapter,initShell}from'../../../cognitive-shell/src';
import type{ShellChannels,TelemetryEvent}from'../../../cognitive-shell/src';

const OPERATOR_TOKEN_KEY='microfixd_operator_token';
const SUPABASE_TOKEN_KEY='microfixd_supabase_access_token';

function currentToken(){if(typeof window==='undefined')return null;return window.sessionStorage.getItem(OPERATOR_TOKEN_KEY)||window.sessionStorage.getItem(SUPABASE_TOKEN_KEY)}
function authRequiredChannels():ShellChannels{
  return{
    telemetry$:{subscribe(next:(e:TelemetryEvent)=>void){next({type:'auth.required',state:'waiting',severity:'warn',signal:25,message:'Operator authentication required for live telemetry',timestamp:Date.now()});return()=>{}}},
    sendCommand:async()=>{window.dispatchEvent(new Event('microfixd:auth-required'));throw new Error('Operator authentication required')},
  };
}

export default function CognitiveShellBridge(){
  const mountRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const mount=mountRef.current;if(!mount)return;
    const id='microfixd-cognitive-shell-host';mount.id=id;
    const shell=initShell({mountSelector:'#'+id,title:'MICROFIXD',theme:'plaid-killer',embedded:true});
    let detach:undefined|(()=>void),adapter:undefined|ReturnType<typeof createMicrofixdHostAdapter>;
    const wire=()=>{detach?.();adapter?.close();adapter=undefined;const token=currentToken();if(token){adapter=createMicrofixdHostAdapter({token,source:'os-shell',healthIntervalMs:12000});detach=attachChannels(shell,adapter)}else detach=attachChannels(shell,authRequiredChannels())};
    wire();
    window.addEventListener('microfixd:auth-changed',wire);
    return()=>{window.removeEventListener('microfixd:auth-changed',wire);detach?.();adapter?.close();shell.destroy()};
  },[]);
  return <div ref={mountRef} className="absolute inset-0 pointer-events-none" aria-label="Microfixd cognitive shell"/>;
}