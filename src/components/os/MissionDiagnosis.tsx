import React,{useEffect,useRef,useState} from 'react';
import type {diagnoseMission} from '../../../server/planner/missionDiagnosis';
import {api} from '../../lib/serverApi';

type Report=NonNullable<Awaited<ReturnType<typeof diagnoseMission>>>;
export interface MissionRow {mission_id:string;objective:string;status:string}
export default function MissionDiagnosis({missions,registry,onOpen,onAccess}:{missions:MissionRow[];registry:string;onOpen:(id:string)=>void;onAccess:()=>void}){
  const [selected,setSelected]=useState('');
  const [report,setReport]=useState<Report|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{
    const clear=()=>{generation.current++;setSelected('');setReport(null);setMessage('');setBusy(false);};
    window.addEventListener('microfixd:auth-changed',clear);
    return ()=>{generation.current++;window.removeEventListener('microfixd:auth-changed',clear);};
  },[]);
  const run=async()=>{
    const request=++generation.current;
    setBusy(true);setReport(null);setMessage('Reading mission evidence…');
    try{
      const data=await api<Report>('GET',`/planner/missions/${encodeURIComponent(selected)}/diagnosis`);
      if(request===generation.current){setReport(data);setMessage('');}
    }catch(error){
      if(request===generation.current)setMessage(error instanceof Error?`Diagnosis unavailable. ${error.message}`:'Diagnosis unavailable.');
    }finally{if(request===generation.current)setBusy(false);}
  };
  if(!missions.length)return <div role="status">{registry==='Durable mission registry'?'No missions yet. Choose Run a task to create one.':registry}
    {registry==='Operator access required'&&<button type="button" onClick={onAccess}>Connect operator account</button>}</div>;
  return <div className="hio-diagnosis">
    <label>Mission <select aria-label="Select mission to diagnose" value={selected} onChange={e=>{generation.current++;setSelected(e.target.value);setBusy(false);setReport(null);setMessage('');}}>
      <option value="">Choose a mission</option>{missions.map(m=><option value={m.mission_id} key={m.mission_id}>{m.objective} · {m.status}</option>)}
    </select></label>
    <button type="button" disabled={!selected||busy} onClick={run}>Check mission evidence</button>
    <div aria-live="polite">{message}{report&&<>
      <strong>{report.title}</strong><p>{report.next}</p>
      <details><summary>Evidence and prior cases</summary>
        <ul>{report.observations.map(o=><li key={o}>{o}</li>)}</ul>
        {report.hypotheses.map(h=><p key={h}>{h}</p>)}
        {report.precedents.map(p=><button key={p.missionId} onClick={()=>onOpen(p.missionId)}>Inspect earlier {p.tool} case · {p.missionId.slice(0,8)}</button>)}
        <p>{report.memory==='unavailable'?'Procedure memory unavailable.':report.precedents.length?'Earlier missions succeeded after the same recorded stop. The cause of recovery still needs verification.':report.memory==='checked'?'No matching artifact-backed case found.':'No procedure comparison for this state.'}</p>
      </details>
      <button type="button" onClick={()=>onOpen(selected)}>Open this mission</button>
    </>}</div>
  </div>;
}
