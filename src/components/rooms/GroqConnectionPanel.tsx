import React,{useEffect,useState} from 'react';
import {api,AuthenticationRequiredError} from '../../lib/serverApi';
import {requestOperatorAccess} from '../../lib/operatorAccess';
export default function GroqConnectionPanel(){
  const [runtime,setRuntime]=useState<{configured:boolean;model:string}|null>(null);
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;api<any>('GET','/groq/status').then(value=>{if(active)setRuntime(value);}).catch(error=>{if(active)setMessage(error instanceof AuthenticationRequiredError?'Connect operator access to check the server.':String(error.message));});return()=>{active=false;};},[]);
  async function check(){
    setBusy(true);setMessage('Checking server → Groq inference…');
    try {
      let result:any;
      try {result=await api('POST','/groq/check',{});}catch(error){if(!(error instanceof AuthenticationRequiredError))throw error;await requestOperatorAccess();result=await api('POST','/groq/check',{});}
      setMessage(`Groq responded successfully using ${result.model} (${result.latency_ms} ms).`);
      setRuntime({configured:true,model:result.model});
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  }
  return <section className="rounded-2xl border border-cyan-400/20 bg-black/20 p-5 text-slate-200">
    <h3 className="font-semibold">Server inference connection</h3>
    <p className="mt-2 text-sm leading-6 text-slate-400">Commands use the server’s Groq credentials. This check runs an actual inference request independently of memory and orchestration.</p>
    {runtime&&<dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><dt>Credentials</dt><dd>{runtime.configured?'Configured; test required':'Missing on server'}</dd><dt>Model</dt><dd className="break-all">{runtime.model}</dd></dl>}
    <button disabled={busy} onClick={check} className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">{busy?'Checking Groq…':'Test Groq connection'}</button>
    <p role="status" className="mt-3 text-sm leading-6 text-cyan-100 break-words">{message}</p>
  </section>;
}
