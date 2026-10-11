import React,{useEffect,useMemo,useRef,useState}from'react';
import{motion}from'motion/react';
import{sound}from'../../utils/audio';
import{voice}from'../../utils/voice';
import{useBrand}from'../../branding/BrandProvider';
import{FastForward,Cpu,Database,Radio,ShieldCheck,Mic,CheckCircle2,Terminal,Activity,AlertTriangle}from'lucide-react';

type ProbeState='pending'|'running'|'ready'|'degraded';
interface DiagnosticStep{key:string;label:string;detail:string;icon:React.ElementType;state:ProbeState}

interface BootSequenceProps{onComplete?:()=>void}

export default function BootSequence({onComplete}:BootSequenceProps={}){
 const brand=useBrand();
 const initial=useMemo<DiagnosticStep[]>(()=>[
  {key:'client',label:'Client Runtime',detail:'Checking browser rendering capabilities',icon:Cpu,state:'pending'},
  {key:'api',label:'Microfixd Runtime API',detail:'Checking public health surface',icon:Activity,state:'pending'},
  {key:'storage',label:'Durable Memory Backend',detail:'Checking readiness-reported storage state',icon:Database,state:'pending'},
  {key:'cognition',label:'Cognitive Execution Spine',detail:'Checking command and organ services',icon:Radio,state:'pending'},
  {key:'voice',label:'Voice Runtime',detail:'Checking browser speech capability',icon:Mic,state:'pending'},
  {key:'governance',label:'Governance & HITL Surface',detail:'Checking security, execution and approval services',icon:ShieldCheck,state:'pending'},
 ],[]);
 const[steps,setSteps]=useState(initial);
 const[status,setStatus]=useState('VERIFYING LIVE SYSTEM STATE');
 const[logs,setLogs]=useState<string[]>(['Boot sequence started. No synthetic hardware claims are emitted.']);
 const[done,setDone]=useState(false);
 const logRef=useRef<HTMLDivElement>(null);
 const progress=Math.round(steps.filter(s=>s.state==='ready'||s.state==='degraded').length/steps.length*100);
 const patch=(key:string,state:ProbeState,detail:string)=>setSteps(prev=>prev.map(s=>s.key===key?{...s,state,detail}:s));
 const log=(message:string)=>setLogs(prev=>[...prev,message].slice(-24));

 useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight},[logs]);

 useEffect(()=>{
  let cancelled=false;
  const run=async()=>{
   const canvas=document.createElement('canvas');const webgl=Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl'));
   const cores=navigator.hardwareConcurrency||0;
   patch('client',webgl?'ready':'degraded',webgl?`WebGL available${cores?`; ${cores} logical CPU threads reported by browser`:''}`:'WebGL unavailable; CSS fallback required');
   log(webgl?'CLIENT: WebGL renderer available.':'CLIENT: WebGL unavailable; visual fallback required.');

   let health:any={};let ready:any={};let healthOk=false,readyOk=false;
   patch('api','running','Requesting /api/health');
   try{const r=await fetch('/api/health',{cache:'no-store'});health=await r.json();healthOk=r.ok;patch('api',r.ok?'ready':'degraded',r.ok?`API responded ${health.status||'ok'}`:`API returned HTTP ${r.status}`);log(`API: /api/health HTTP ${r.status}.`)}catch(error){patch('api','degraded','Runtime API unreachable');log(`API: ${String(error)}`)}

   try{const r=await fetch('/readyz',{cache:'no-store'});ready=await r.json().catch(()=>({}));readyOk=r.ok;const durable=Boolean(ready?.storage?.durable);patch('storage',durable?'ready':'degraded',durable?`Durable store: ${ready.storage.engine||'configured'}`:'Durable store not reported ready');log(`READYZ: HTTP ${r.status}; system=${ready?.systemHealth||ready?.status||'unknown'}; storage=${ready?.storage?.engine||'unknown'}.`)}catch(error){patch('storage','degraded','Readiness endpoint unreachable');log(`READYZ: ${String(error)}`)}

   const services=Array.isArray(health?.services)?health.services:[];
   const cognition=healthOk&&services.includes('command')&&services.includes('organs');
   patch('cognition',cognition?'ready':'degraded',cognition?'Command + organ services advertised by runtime':'Command/organ services not both present in health response');
   log(`COGNITION: command=${services.includes('command')} organs=${services.includes('organs')}.`);

   const speech=typeof window!=='undefined'&&'speechSynthesis'in window;
   patch('voice',speech?'ready':'degraded',speech?'Browser speech synthesis available':'Browser speech synthesis unavailable');
   log(`VOICE: speech synthesis ${speech?'available':'unavailable'}.`);

   const governed=healthOk&&services.includes('security')&&services.includes('execution')&&services.includes('hitl');
   patch('governance',governed?'ready':'degraded',governed?'Security + execution + HITL services advertised':'Governance service set incomplete in health response');
   log(`GOVERNANCE: security=${services.includes('security')} execution=${services.includes('execution')} hitl=${services.includes('hitl')}.`);

   if(cancelled)return;
   setStatus(readyOk?'LIVE SYSTEM VERIFIED // ENTERING OS':'DEGRADED SYSTEM STATE RECORDED // ENTERING OS');
   sound.playSuccess();
   if(voice.isEnabled())void voice.speak(readyOk?`${brand.productName} runtime verified.`:`${brand.productName} started with degraded readiness.`).catch(()=>{});
   window.setTimeout(()=>{if(!cancelled){if(onComplete)onComplete();else setDone(true)}},850);
  };
  void run();
  return()=>{cancelled=true};
 },[brand.productName,onComplete]);

 const skip=()=>{sound.playSuccess();if(onComplete)onComplete();else setDone(true)};
 if(done)return null;
 return <div className="fixed inset-0 bg-[#020509] overflow-hidden flex flex-col items-center justify-between font-mono text-cyan-400 select-none p-4 md:p-8">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0%,transparent_70%)] pointer-events-none"/>
  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"/>
  <motion.div animate={{y:['-100%','100%']}} transition={{duration:4,repeat:Infinity,ease:'linear'}} className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent opacity-60 pointer-events-none"/>
  <div className="w-full z-20 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_rgba(6,182,212,1)]"/><div className="text-xs tracking-widest text-cyan-200"><b>{brand.productName.toUpperCase()}</b><span className="text-cyan-500/80 ml-2">// LIVE BOOT VERIFICATION</span></div></div><button onClick={skip} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-xs text-cyan-300"><FastForward size={13}/>Fast Boot</button></div>
  <div className="relative z-20 w-full max-w-3xl flex flex-col items-center gap-6 my-auto">
   <div className="w-28 h-28 rounded-3xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.25)]"><span className="text-2xl font-black text-white">MFX</span></div>
   <div className="text-center"><h1 className="text-lg md:text-xl font-bold tracking-wider text-white">{brand.productName.toUpperCase()}</h1><p className="text-xs text-cyan-400/80 tracking-widest mt-1">{status}</p></div>
   <div className="w-full"><div className="flex justify-between text-xs mb-2"><span>VERIFIED PROBE COMPLETION</span><b>{progress}%</b></div><div className="w-full h-3 rounded-full bg-cyan-950/80 border border-cyan-500/40 p-0.5"><div className="h-full rounded-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-indigo-400 transition-all" style={{width:`${progress}%`}}/></div></div>
   <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">{steps.map(step=>{const Icon=step.icon;const finished=step.state==='ready'||step.state==='degraded';return <div key={step.key} className={`flex items-start gap-2.5 p-2 rounded-lg border ${step.state==='ready'?'bg-cyan-950/30 border-cyan-500/40 text-cyan-200':step.state==='degraded'?'bg-amber-950/20 border-amber-500/40 text-amber-100':'bg-black/30 border-cyan-950 text-cyan-700'}`}>{finished?(step.state==='ready'?<CheckCircle2 size={13} className="text-emerald-400 mt-0.5"/>:<AlertTriangle size={13} className="text-amber-400 mt-0.5"/>):<Icon size={13} className="mt-0.5 animate-pulse"/>}<div><div className="font-semibold">{step.label}</div><p className="text-[9px] opacity-70 mt-0.5">{step.detail}</p></div></div>})}</div>
   <div className="w-full rounded-xl bg-black/80 border border-cyan-500/30 p-3"><div className="flex items-center gap-1.5 border-b border-cyan-500/20 pb-1.5 mb-2 text-[10px]"><Terminal size={12}/>VERIFIED BOOT EVENT STREAM</div><div ref={logRef} className="h-24 overflow-y-auto space-y-1 text-[10px] text-cyan-300/80">{logs.map((line,i)=><div key={i}>{line}</div>)}</div></div>
  </div>
  <div className="w-full z-20 text-[10px] text-cyan-500/50 flex justify-between"><span>{brand.productName.toUpperCase()} // GOVERNED RUNTIME</span><span>BOOT DATA FROM LIVE PROBES</span></div>
 </div>
}