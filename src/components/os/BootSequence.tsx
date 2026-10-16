import React,{useEffect,useRef,useState} from 'react';
import {FastForward,CheckCircle2,AlertTriangle} from 'lucide-react';
import {useBrand} from '../../branding/BrandProvider';
import {sound} from '../../utils/audio';
import {HolographicHeadCanvas} from '../../../cognitive-shell/src/components/head/HolographicHeadCanvas';
import type {ShellViewModel} from '../../../cognitive-shell/src/integration/ShellAPI';
import '../../../cognitive-shell/src/styles/globals.css';
import './hio-boot.css';
const STAGES=[['BOOT SEQUENCE','Initializing the interface'],['EMERGENCE','A presence takes shape'],['AWARENESS','Avatar systems initialized'],['GREETING','Hello. I am Microfixd.'],['INTERACTION','What would you like to accomplish?'],['FULL INTERFACE','Opening your cockpit']] as const;
interface Probe{label:string;state:'pending'|'ready'|'degraded';detail:string}
const INITIAL:Probe[]=[{label:'Client renderer',state:'pending',detail:'Checking WebGL 2'},{label:'Runtime API',state:'pending',detail:'Requesting health'},{label:'Durable memory',state:'pending',detail:'Requesting readiness'},{label:'Cognitive spine',state:'pending',detail:'Checking advertised services'},{label:'Voice runtime',state:'pending',detail:'Checking browser capability'},{label:'Governance / HITL',state:'pending',detail:'Checking advertised services'}];
export default function BootSequence({onComplete}:{onComplete?:()=>void}={}){
 const brand=useBrand(),[elapsed,setElapsed]=useState(0),[probes,setProbes]=useState(INITIAL),[finished,setFinished]=useState(false),[done,setDone]=useState(false);
 const completion=useRef(onComplete);completion.current=onComplete;const ended=useRef(false);
 const complete=()=>{if(ended.current)return;ended.current=true;sound.playSuccess();if(completion.current)completion.current();else setDone(true);};
 useEffect(()=>{
  let start:number|null=null;const mountedAt=performance.now(),controller=new AbortController();let cancelled=false;
  const readyFrame=(event:Event)=>{const status=(event as CustomEvent).detail;if(start===null&&status?.model==='ready')start=performance.now();};
  window.addEventListener('microfixd:hio-status',readyFrame);
  const patch=(index:number,state:Probe['state'],detail:string)=>{if(!cancelled)setProbes(prev=>prev.map((p,i)=>i===index?{...p,state,detail}:p));};
  const c=document.createElement('canvas'),gl=c.getContext('webgl2');patch(0,gl?'ready':'degraded',gl?'WebGL 2 available':'WebGL 2 unavailable; avatar fallback');gl?.getExtension('WEBGL_lose_context')?.loseContext();
  patch(4,'speechSynthesis'in window?'ready':'degraded','speechSynthesis'in window?'Browser speech available':'Speech unavailable');
  const fetchJSON=async(path:string)=>{const r=await fetch(path,{signal:controller.signal,cache:'no-store'});return {ok:r.ok,data:await r.json()};};
  const timeout=window.setTimeout(()=>controller.abort(),6500);
  const health=fetchJSON('/api/health').then(({ok,data})=>{
   const services=Array.isArray(data.services)?data.services:[];patch(1,ok?'ready':'degraded',ok?String(data.status||'API responded'):'API reports unavailable');
   const cognition=ok&&services.includes('command')&&services.includes('organs');patch(3,cognition?'ready':'degraded',cognition?'Command + organ services advertised':'Command/organ services unverified');
   const governed=ok&&['security','execution','hitl'].every(s=>services.includes(s));patch(5,governed?'ready':'degraded',governed?'Security + execution + HITL advertised':'Governance service set unverified');
  }).catch(()=>{[1,3,5].forEach(i=>patch(i,'degraded','Runtime API unreachable'));});
  const ready=fetchJSON('/readyz').then(({ok,data})=>patch(2,ok&&data?.storage?.durable?'ready':'degraded',ok&&data?.storage?.durable?`Durable store: ${data.storage.engine||'configured'}`:'Durable memory not reported ready')).catch(()=>patch(2,'degraded','Readiness endpoint unreachable'));
  void Promise.all([health,ready]).then(()=>{clearTimeout(timeout);if(!cancelled)setFinished(true);});
  const timer=window.setInterval(()=>{if(!cancelled){const now=performance.now();if(start===null&&now-mountedAt>8000)start=now;if(start!==null)setElapsed(now-start);}},100);
  return()=>{cancelled=true;window.removeEventListener('microfixd:hio-status',readyFrame);clearInterval(timer);clearTimeout(timeout);controller.abort();};
 },[]);
 useEffect(()=>{if(elapsed>=11400&&finished)complete();},[elapsed,finished]);
 if(done)return null;
 const stage=Math.min(5,Math.floor(elapsed/1900));
 const reveal=stage===0?0:stage===1?.08+Math.min(1,(elapsed-1900)/1900)*.68:1;
 const vm:ShellViewModel={emotion:stage<3?'thinking':'calm',pose:{yaw:stage===4?-24:stage===3?8:0,pitch:0,attention:1},mouth:'idle',indicators:{status:'BOOT',agents:0,signal:0,severity:'info'},hio:{bootProgress:reveal}};
 return <div className="hio-boot">
  <header><div><b>{brand.productName.toUpperCase()}</b><span>HOLOGRAPHIC INTERFACE ORGAN</span></div><button onClick={complete}><FastForward size={13}/>Fast Boot</button></header>
  <div className="hio-boot-visual"><HolographicHeadCanvas vm={vm}/></div>
  <section className="hio-boot-caption" aria-live="polite"><span>0{stage+1} / 06</span><h1>{STAGES[stage][0]}</h1><p>{STAGES[stage][1]}</p></section>
  <section className="hio-boot-probes"><h2>LIVE READINESS <span>{finished?(probes.some(p=>p.state==='degraded')?'DEGRADED':'PROBES COMPLETE'):'CHECKING'}</span></h2>{probes.map(p=><div key={p.label} className={p.state}>{p.state==='ready'?<CheckCircle2 size={11}/>:p.state==='degraded'?<AlertTriangle size={11}/>:<span className="hio-probe-dot"/>}<span>{p.label}<small>{p.detail}</small></span></div>)}</section>
  <nav aria-label="Boot stages">{STAGES.map(([label],i)=><div key={label} className={stage===i?'active':stage>i?'past':''}><span>0{i+1}</span><b>{label}</b></div>)}</nav>
 </div>;
}
