import React,{useEffect,useState}from'react';
import type{StoreApi}from'zustand/vanilla';
import type{ShellState}from'../core/shellState';
import type{CommandBus}from'../core/commandBus';
import{HolographicHead}from'../components/head/HolographicHead';
import{OrbitContainer}from'../components/head/OrbitContainer';
import{StatusRing}from'../components/hud/StatusRing';
import{AgentBadges}from'../components/hud/AgentBadges';
import{SignalBars}from'../components/hud/SignalBars';
import{NotificationPips}from'../components/hud/NotificationPips';
export function HolographicHeadShell({store,commands,title='MICROFIXD',embedded=false}:{store:StoreApi<ShellState>;commands:CommandBus;title?:string;embedded?:boolean}){
 const[vm,setVm]=useState(store.getState().vm);useEffect(()=>store.subscribe(s=>setVm(s.vm)),[store]);
 return <main className={'mx-shell '+(embedded?'mx-embedded':'mx-standalone')}>
   <header><b>{title}</b><span>{vm.indicators.status}</span></header>
   <section className="mx-stage"><OrbitContainer><HolographicHead vm={vm}/></OrbitContainer></section>
   <aside><StatusRing status={vm.indicators.status}/><AgentBadges count={vm.indicators.agents}/><SignalBars value={vm.indicators.signal}/><NotificationPips severity={vm.indicators.severity}/><span>{vm.emotion.toUpperCase()}</span></aside>
   <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const q=String(f.get('q')||'').trim();if(q)void commands.send({kind:'user.command',payload:{text:q}});e.currentTarget.reset()}}><input name="q" aria-label="Command" placeholder="What would you like me to accomplish?"/><button>EXECUTE</button></form>
 </main>
}