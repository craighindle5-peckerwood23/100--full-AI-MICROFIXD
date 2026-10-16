import React,{useEffect,useRef,useState}from'react';
import type{ShellViewModel}from'../../integration/ShellAPI';
import{HIO}from'../../hio';
import type{Profile}from'../../hio';
export function HolographicHeadCanvas({vm}:{vm:ShellViewModel}){
 const host=useRef<HTMLDivElement>(null),organ=useRef<HIO|null>(null);const[error,setError]=useState('');
 useEffect(()=>{
  if(!host.current)return;
  let hio:HIO;
  try{hio=new HIO(host.current);organ.current=hio;hio.start();}catch(e){setError(e instanceof Error?e.message:String(e));return;}
  const off=hio.onEvent(status=>{if(status.error)setError(status.error);window.dispatchEvent(new CustomEvent('microfixd:hio-status',{detail:status}));});
  const profile=(event:Event)=>hio.setProfile((event as CustomEvent<Profile|'auto'>).detail);
  window.addEventListener('microfixd:hio-profile',profile);
  return()=>{off();window.removeEventListener('microfixd:hio-profile',profile);hio.dispose();organ.current=null;};
 },[]);
 useEffect(()=>{organ.current?.ingest({...vm.hio,speaking:vm.mouth==='speaking',error:vm.emotion==='error',yaw:vm.pose.yaw*Math.PI/180,pitch:vm.pose.pitch*Math.PI/180,cognition:vm.hio?.cognition||{reflectionState:vm.emotion==='thinking'?'thinking':'idle'}});},[vm]);
 return <div className="mx-hio-renderer" ref={host}>{error&&<div role="status" className="mx-hio-fallback">Avatar unavailable<br/><small>{error}</small><p>Commands and speech remain available.</p></div>}</div>;
}
