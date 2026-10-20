import React,{useEffect,useState} from 'react';
import {api} from '../lib/serverApi';
import type {Vehicle,DiagnosticCase} from '../../server/automotive/schemas';
import type {sessionView} from '../../server/automotive/obd/interpreter';
type Session=ReturnType<typeof sessionView>;
export default function OBDPanel({vehicles,onCase}:{vehicles:Vehicle[];onCase:(c:DiagnosticCase)=>void}){
 const [sessions,setSessions]=useState<Session[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  async function load(){try{const result=await api<Session[]>('GET','/automotive/obd/sessions');if(active){setSessions(result);setError('');}}catch(e){if(active)setError((e as Error).message);}}
  void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},5000);
  return ()=>{active=false;clearInterval(timer);};
 },[]);
 const current=sessions.find(s=>s.id===selected)??sessions[0];
 return <section aria-label="Live OBD connection"><p className="eyebrow">LOCAL HARDWARE BRIDGE / READ-ONLY OBD</p><h2>Vehicle connection</h2>
 <p>J2534 Pass-Thru is primary. Secondary adapters use ELM327 over USB/serial, paired Bluetooth SPP, or Wi-Fi/TCP. Start the bridge on the computer connected to your adapter.</p>
 <code>python integrations/obd-bridge/bridge.py --list-j2534</code>
 <p>Launch instructions: <a href="https://github.com/craighindle5-peckerwood23/100--full-AI-MICROFIXD/blob/feat/vector-automotive-mvp/integrations/obd-bridge/README.md" target="_blank" rel="noreferrer">Local adapter setup</a></p>
 {error&&<p role="status">OBD sessions unavailable: {error}</p>}
 {!sessions.length?<p>No session received. A plugged-in cable alone does not establish a vehicle connection.</p>:<>
 <label>Adapter session<select value={current?.id??''} onChange={e=>setSelected(e.target.value)}>{sessions.map(s=><option key={s.id} value={s.id}>{s.label} · {s.state}</option>)}</select></label>
 {current&&<><p role="status"><strong>{current.state}</strong> · Last bridge receipt: {current.ageSeconds===null?'none':`${current.ageSeconds}s ago`}</p><p>Session ID: <code>{current.id}</code></p><p>{current.understanding.nextAction}</p><p>Protocol: {current.latest?.protocol??'unknown'} · Adapter: {current.adapter}</p>
 <p>VIN: {current.interpreted?.vin??'not confirmed'} · Engine running: {current.understanding.engineRunning===null?'unknown':current.understanding.engineRunning?'yes':'no'}</p>
 <p>{current.state==='connected'?'Recent decoded readings (each query has its own freshness window)':'Historical readings only; do not treat these as current vehicle state.'}</p>
 <div className="obd-readings">{current.interpreted?.readings.map((r,i)=><p key={`${r.ecu}-${r.name}-${i}`}><strong>{r.name}</strong>: {r.value} {r.unit} <small>ECU: {r.ecu}</small></p>)}</div>
 <h3>Observed DTCs</h3>{current.interpreted?.dtcs.length?<ul>{current.interpreted.dtcs.map((d,i)=><li key={i}>{d.code} · {d.kind} · ECU {d.ecu}</li>)}</ul>:<p>No DTC responses in the recent snapshot. This does not prove the vehicle is fault-free.</p>}
 {current.interpreted?.warnings.map((w,i)=><p key={i} className="error">{w}</p>)}
 {current.state==='connected'&&<details><summary>Create diagnosis from this live session</summary><form onSubmit={async e=>{
  e.preventDefault();const fields=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);setError('');
  try{const created=await api<DiagnosticCase>('POST','/automotive/cases/from-obd',{obdSessionId:current.id,vehicleId:fields.vehicleId,complaint:fields.complaint,identityConfirmed:true});onCase(created);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }}><label>Confirm vehicle profile<select name="vehicleId" required><option value="">Select exact vehicle and engine</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.year} {v.make} {v.model} / {v.engine}</option>)}</select></label><label>Actual vehicle complaint<textarea name="complaint" required maxLength={4000}/></label><label><input type="checkbox" required/>I confirmed this adapter is connected to the selected vehicle</label><button disabled={busy||!vehicles.length}>Create case from live OBD</button></form></details>}
 <p>Microfixd can call <code>list_obd_sessions</code> and <code>read_obd_status</code> with this session ID. These tools understand recorded responses; they cannot directly access a cloud host’s USB port.</p>
 </>}
 </>}
 </section>;
}
