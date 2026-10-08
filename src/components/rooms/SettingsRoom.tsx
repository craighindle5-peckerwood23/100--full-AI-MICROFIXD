import GroqConnectionPanel from './GroqConnectionPanel';
import React, { useState, useEffect } from 'react';
import { Settings2, ShieldCheck, Cpu, Volume2, Database, Rocket, Activity, Wrench, ArrowUpRight, Check, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import type { Subsystem } from '../../types';
import { voice } from '../../utils/voice';
import { sound } from '../../utils/audio';
import { ttsEngine } from '../../voice/ttsEngine';
import { useVoiceStore } from '../../voice/voiceState';
import { getCommandPreferences, saveCommandPreferences } from '../../lib/commandPreferences';

export const SETTINGS_SECTIONS = [
  {id:'general',label:'General',icon:Settings2,description:'Access, preferences, and your workspace.'},
  {id:'autonomy',label:'Autonomy',icon:ShieldCheck,description:'Manage autonomous work and human oversight.'},
  {id:'engines',label:'Engines & Router',icon:Cpu,description:'Configure recall and manage the intelligence engine.'},
  {id:'voice',label:'Voice',icon:Volume2,description:'Speech playback and conversation timing.'},
  {id:'connections',label:'Connections',icon:Database,description:'Supabase, integrations, and service health.'},
  {id:'missions',label:'Mission Control',icon:Rocket,description:'Manage goals, agents, and recurring work.'},
  {id:'telemetry',label:'Telemetry',icon:Activity,description:'Inspect system activity and infrastructure.'},
  {id:'tools',label:'Tools & Safety',icon:Wrench,description:'Execution tools, governance, and system reference.'},
] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number]['id'];
const card='rounded-2xl border border-white/10 bg-white/[0.025] p-5';
const field='w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15';
const button='rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50';

export default function SettingsRoom({initialSection='general',onNavigate,onReboot}: {initialSection?:SettingsSection;onNavigate?:(id:Subsystem)=>void;onReboot?:()=>void}) {
  const [section,setSection]=useState<SettingsSection>(initialSection);
  useEffect(()=>setSection(initialSection),[initialSection]);
  const [token,setToken]=useState(()=>sessionStorage.getItem('microfixd_operator_token')||'');
  const [visible,setVisible]=useState(false);
  const [access,setAccess]=useState('');const [checking,setChecking]=useState(false);
  const [muted,setMuted]=useState(sound.isMuted);
  const [voiceOn,setVoiceOn]=useState(voice.isEnabled());
  const config=useVoiceStore();
  const [preferences,setPreferences]=useState(getCommandPreferences);
  const [saved,setSaved]=useState(false);
  const [health,setHealth]=useState<any>(null);const [healthMessage,setHealthMessage]=useState('');
  const active=SETTINGS_SECTIONS.find(s=>s.id===section)!;
  async function connect(e:React.FormEvent){
    e.preventDefault();if(!token.trim())return;setChecking(true);setAccess('');
    try {
      const response=await fetch('/api/classification/map',{headers:{Authorization:`Bearer ${token.trim()}`}});
      if(!response.ok)throw new Error(response.status===403?'Token not accepted. Check the operator or admin token configured on your server.':'Connection check failed. Please retry.');
      const result=await response.json();if(!Array.isArray(result.objects))throw new Error('Unexpected server response. Check the deployed service.');
      sessionStorage.setItem('microfixd_operator_token',token.trim());
      window.dispatchEvent(new Event('microfixd:auth-changed'));setAccess('Connected. Protected controls are ready in this tab.');
    } catch(err){setAccess(err instanceof Error?err.message:String(err));}finally{setChecking(false);}
  }
  const open=(id:Subsystem)=>onNavigate?.(id);
  const destination=(id:Subsystem,title:string,description:string)=>(
    <button key={id} onClick={()=>open(id)} disabled={!onNavigate} className={`${card} group text-left hover:border-cyan-400/40 transition-colors disabled:opacity-50`}>
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-100">{title}</h3><ArrowUpRight size={17} className="text-cyan-400 group-hover:translate-x-0.5 transition-transform" /></div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p><span className="mt-4 block text-xs font-medium text-cyan-300">Open management workspace</span>
    </button>
  );
  const toggle=(label:string,description:string,checked:boolean,change:()=>void)=>(
    <div className="flex items-center justify-between gap-5 py-3"><div><div className="text-sm font-medium text-slate-100">{label}</div><p className="mt-1 text-xs leading-5 text-slate-400">{description}</p></div><button role="switch" aria-label={label} aria-checked={checked} onClick={change} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked?'bg-cyan-400':'bg-slate-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${checked?'left-6':'left-1'}`} /></button></div>
  );
  return <div className="flex h-full min-h-0 flex-col md:flex-row text-slate-200 font-sans">
    <aside className="shrink-0 border-b md:border-b-0 md:border-r border-white/10 bg-black/15 md:w-56 p-3">
      <p className="hidden md:block px-3 py-3 text-[10px] tracking-[0.2em] uppercase text-slate-500">Workspace preferences</p>
      <div role="tablist" aria-label="Settings sections" className="flex md:flex-col gap-1 overflow-x-auto" onKeyDown={e=>{if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=SETTINGS_SECTIONS.findIndex(s=>s.id===section);const next=e.key==='Home'?0:e.key==='End'?SETTINGS_SECTIONS.length-1:(i+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)+SETTINGS_SECTIONS.length)%SETTINGS_SECTIONS.length;setSection(SETTINGS_SECTIONS[next].id);document.getElementById(`settings-tab-${SETTINGS_SECTIONS[next].id}`)?.focus();}}>
        {SETTINGS_SECTIONS.map(item=><button key={item.id} id={`settings-tab-${item.id}`} role="tab" aria-selected={section===item.id} aria-controls="settings-content" tabIndex={section===item.id?0:-1} onClick={()=>setSection(item.id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 whitespace-nowrap text-sm text-left transition-colors ${section===item.id?'bg-cyan-400/10 text-cyan-200 ring-1 ring-inset ring-cyan-400/20':'text-slate-400 hover:bg-white/5 hover:text-white'}`}><item.icon size={17}/>{item.label}</button>)}
      </div>
      <p className="hidden md:block px-3 pt-8 text-xs leading-5 text-slate-500">One place to configure.<br/>A focused space to work.</p>
    </aside>
    <section id="settings-content" role="tabpanel" aria-labelledby={`settings-tab-${section}`} className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-8 select-text">
      <div className="mb-7"><div className="text-xs uppercase tracking-[0.18em] text-cyan-400/80">Microfixd / Settings</div><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{active.label}</h2><p className="mt-2 text-sm text-slate-400">{active.description}</p></div>
      <div className="space-y-4 max-w-3xl">
      {section==='general' && <>
        <form onSubmit={connect} className={card}><div className="flex items-center gap-2 mb-2"><KeyRound size={18} className="text-cyan-300"/><h3 className="font-semibold">Operator access</h3></div><p className="text-sm leading-6 text-slate-400 mb-4">Connect this browser tab to your protected commands, memory, and sandbox.</p>
          <label htmlFor="operator-token" className="block text-sm mb-2">Admin or operator token</label><div className="relative"><input id="operator-token" autoComplete="off" spellCheck={false} type={visible?'text':'password'} value={token} onChange={e=>{setToken(e.target.value);setAccess('');}} placeholder="Enter your server’s operator token" className={`${field} pr-12`}/><button type="button" aria-label={visible?'Hide token':'Show token'} onClick={()=>setVisible(!visible)} className="absolute right-3 top-3 text-slate-400">{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          <p className="text-xs leading-5 text-slate-500 mt-2">Use the value of OPERATOR_TOKEN or ADMIN_TOKEN from your server settings. Saved only in this tab.</p>
          <div className="flex flex-wrap gap-3 mt-4"><button type="submit" disabled={checking||!token.trim()} className={`${button} flex items-center gap-2`}>{checking?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>}Verify & connect</button><button type="button" className="px-3 text-sm text-slate-400 hover:text-white" onClick={()=>{sessionStorage.removeItem('microfixd_operator_token');setToken('');setAccess('Disconnected from protected controls.');window.dispatchEvent(new Event('microfixd:auth-changed'));}}>Disconnect</button></div><p role="status" className="mt-3 text-sm leading-6 text-cyan-200">{access}</p>
        </form>
        <div className={card}>{toggle('Interface sounds','Navigation and notification sounds.',!muted,()=>setMuted(sound.toggleMute()))}{onReboot&&<button className="mt-3 text-sm text-slate-400 hover:text-white" onClick={onReboot}>Replay startup sequence</button>}</div>
      </>}
      {section==='autonomy'&&<div className="grid sm:grid-cols-2 gap-4">{destination('autonomy','Autonomous Core','Watchdog, execution activity, and self-repair controls.')}{destination('world_thinking','Oversight','Inspect reasoning and supervised orchestration.')}{destination('governance','Governance','Review constitutional rules and safety controls.')}{destination('learning','Learning','Inspect learning activity and adaptation.')}</div>}
      {section==='engines'&&<><GroqConnectionPanel/><div className={card}><h3 className="font-semibold">Conversation retrieval</h3><p className="text-sm leading-6 text-slate-400 mt-2 mb-4">Choose how much session memory command requests can recall. Whole records are preserved within this budget.</p><div className="grid sm:grid-cols-2 gap-4"><label className="text-sm">Recent records<select aria-label="Recent records" className={`${field} mt-2`} value={preferences.retrieval.limit} onChange={e=>{setSaved(false);setPreferences({...preferences,retrieval:{...preferences.retrieval,limit:Number(e.target.value)}});}}>{[10,30,50,100].map(n=><option key={n} value={n}>{n} records</option>)}</select></label><label className="text-sm">Context budget<select aria-label="Context budget" className={`${field} mt-2`} value={preferences.retrieval.max_chars} onChange={e=>{setSaved(false);setPreferences({...preferences,retrieval:{...preferences.retrieval,max_chars:Number(e.target.value)}});}}>{[8000,20000,60000,80000,100000].map(n=><option key={n} value={n}>{n.toLocaleString()} characters</option>)}</select></label></div><button className={`${button} mt-4`} onClick={()=>{saveCommandPreferences(preferences);setSaved(true);}}>{saved?'Preferences saved':'Save retrieval preferences'}</button><p className="text-xs text-slate-500 mt-3">Model credentials and response-token limits are managed on the server.</p></div><div className="grid sm:grid-cols-2 gap-4">{destination('ai_core','Omni Router','Open the engine and provider management workspace.')}{destination('memory','Memory','Inspect memory and retained context.')}</div></>}
      {section==='voice'&&<div className={card}>{toggle('Spoken responses','Read completed command responses aloud.',voiceOn,()=>{const next=!voiceOn;voice.setEnabled(next);setVoiceOn(next);window.dispatchEvent(new Event('microfixd:preferences-changed'));})}<label className="block text-sm mt-5">Voice style<select className={`${field} mt-2`} value={config.voiceStyle} onChange={e=>config.setConfig({voiceStyle:e.target.value as "natural"|"synthetic"})}><option value="natural">Natural</option><option value="synthetic">Synthetic — low pitch</option></select></label><label className="block text-sm mt-5">Speech language<select className={`${field} mt-2`} value={config.language} onChange={e=>config.setConfig({language:e.target.value})}>{[['en-US','English (US)'],['en-GB','English (UK)'],['es-US','Spanish'],['fr-FR','French'],['de-DE','German']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label className="block text-sm mt-5">Pause before submitting speech<select className={`${field} mt-2`} value={config.turnWaitMs} onChange={e=>config.setConfig({turnWaitMs:Number(e.target.value)})}>{[800,1200,2000,3000].map(n=><option key={n} value={n}>{n/1000} seconds</option>)}</select></label><div className="mt-5 flex flex-wrap gap-3"><button className={button} onClick={()=>void ttsEngine.speak('Microfixd voice playback is ready.').catch(err=>setAccess(String(err)))}>Test voice</button><button className="text-sm text-slate-400 px-3" onClick={()=>ttsEngine.interrupt()}>Stop playback</button></div><p role="status" className="text-sm mt-3 text-slate-400">{access}</p></div>}
      {section==='connections'&&<><div className={card}><h3 className="font-semibold">Service connections</h3><p className="text-sm text-slate-400 leading-6 my-3">Check the backend’s configured database and inference services.</p><button className={button} onClick={async()=>{setHealthMessage('Checking…');try{const response=await fetch('/api/health/deep');const result=await response.json();setHealth(result);setHealthMessage(response.ok?'Health check received.':'One or more services need attention.');}catch{setHealthMessage('Could not reach the backend.');}}}>Check connections</button><p role="status" className="text-sm text-slate-400 mt-3">{healthMessage}</p>{health&&<dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><dt>Durable memory</dt><dd>{health.memory?.durable?'Available':'Unavailable'}</dd><dt>Inference credentials</dt><dd>{health.configured?.llm?'Configured':'Not configured'}</dd></dl>}<a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="inline-flex gap-2 items-center mt-5 text-sm text-cyan-300">Open Supabase dashboard<ArrowUpRight size={15}/></a></div><div className="grid sm:grid-cols-2 gap-4">{destination('supabase','Supabase workspace','Database connection and cloud management.')}{destination('federation','Federation','Manage connected peers and integrations.')}</div></>}
      {section==='missions'&&<div className="grid sm:grid-cols-2 gap-4">{destination('mission_control','Mission Control','Review goals, progress, and task outcomes.')}{destination('agents','Agent Matrix','Inspect agents and assignments.')}{destination('automation','Automation','Manage recurring workflows and triggers.')}</div>}
      {section==='telemetry'&&<div className="grid sm:grid-cols-2 gap-4">{destination('telemetry','Telemetry','Open activity, event, and monitoring views.')}{destination('infra','Infrastructure','Inspect runtime services and infrastructure.')}</div>}
      {section==='tools'&&<div className="grid sm:grid-cols-2 gap-4">{destination('sandbox','Sandbox','Run supervised code and review approvals.')}{destination('workspace','Workspace','Return to your working environment.')}{destination('governance','Safety & Governance','Review the system’s operating constraints.')}{destination('bible','System reference','Browse architecture and operating documentation.')}</div>}
      </div>
    </section>
  </div>;
}
