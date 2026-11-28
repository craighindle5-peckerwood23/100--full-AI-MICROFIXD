import React,{useEffect,useRef,useState} from 'react';
import {api} from '../../lib/serverApi';

interface HealingStatus {
 configured:boolean;automatic_enabled:boolean;can_request_repair:boolean;source:string;
 repairs:{mission_id:string;mission_status:string;phase:string;healed:boolean;rolled_back:boolean;last_stop:string|null;status_url:string}[];
}
export function SelfHealingPanel(){
 const [status,setStatus]=useState<HealingStatus|null>(null),[error,setError]=useState('');
 const [objective,setObjective]=useState(''),[paths,setPaths]=useState('');
 const [pending,setPending]=useState(false),[submitted,setSubmitted]=useState<string|null>(null);
 const [diagnostic,setDiagnostic]=useState<string|null>(null);
 const request=useRef<{body:unknown;key:string}|null>(null);
 useEffect(()=>{let active=true;const refresh=async()=>{
  try{const result=await api<HealingStatus>('GET','/learning/self-healing/status');if(active){setStatus(result);setError('');}}
  catch(e){if(active){setStatus(null);setError(e instanceof Error?e.message:'Healing status unavailable');}}
 };void refresh();const timer=setInterval(()=>{void refresh();},15000);return()=>{active=false;clearInterval(timer);};},[]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(pending)return;setPending(true);setError('');
  const body={objective,paths:paths.split('\n').map(p=>p.trim()).filter(Boolean)};
  if(!request.current||JSON.stringify(request.current.body)!==JSON.stringify(body))request.current={body,key:crypto.randomUUID()};
  try{const result=await api<{mission_id:string}>('POST','/learning/self-healing/repair',body,{'Idempotency-Key':request.current.key});setSubmitted(result.mission_id);}
  catch(e){setError(e instanceof Error?e.message:'Repair submission unavailable');}
  finally{setPending(false);}
 };
 return <section aria-label="Governed self healing" className="flex-1 overflow-y-auto space-y-4 text-xs">
  <div className="rounded-xl border border-cyan-500/30 bg-black/50 p-4 space-y-2">
   <h2 className="text-white font-bold">Governed self healing</h2>
   <p>Observed fault → bounded source patch → isolated regression comparison → release → verified recovery.</p>
   {status?<p>Repair dependencies: {status.configured?'configured':'unavailable'}. Automatic eligible-fault detection: {status.automatic_enabled?'enabled':'disabled'}.</p>:<p>Status unavailable. Recovery has not been established.</p>}
   <p className="text-cyan-200/70">Protected architecture, credentials, billing and approval failures require their existing operator workflows.</p>
  </div>
  {error&&<p role="alert" className="text-amber-300">{error}</p>}
  <details className="border border-cyan-800 rounded p-3"><summary>Diagnostic example</summary>
   <p>This analyzes a sample fault. It does not execute or deploy a repair.</p>
   <button type="button" className="border border-cyan-600 rounded p-2 mt-2" onClick={async()=>{
    try{const result=await api<{mode:string;diagnosis?:{recommendedRepairStrategy?:string}}>('POST','/learning/self-healing',{source:'operator_diagnostic_example',error:'Simulated upstream rate limit: 429 Too Many Requests'});
     setDiagnostic(`${result.mode}: ${result.diagnosis?.recommendedRepairStrategy??'No strategy returned'}. No deployment was performed.`);
    }catch(e){setDiagnostic(e instanceof Error?e.message:'Diagnostic unavailable');}
   }}>Analyze sample fault</button>
   {diagnostic&&<p role="status" className="mt-2">{diagnostic}</p>}
  </details>
  <form onSubmit={submit} className="rounded-xl border border-cyan-500/30 p-4 space-y-3">
   <h3 className="text-white">Request a source repair</h3>
   <label className="block">Observed problem and regression case
    <textarea aria-label="Repair objective" required maxLength={4000} value={objective} onChange={e=>setObjective(e.target.value)} className="block mt-1 w-full bg-black border border-cyan-600 p-2 rounded" placeholder={'Describe the problem and required behavior.\nRegression case: tests/file.test.ts#exact existing test name'} />
   </label>
   <label className="block">Existing source paths, one per line
    <textarea aria-label="Repair source paths" required value={paths} onChange={e=>setPaths(e.target.value)} className="block mt-1 w-full bg-black border border-cyan-600 p-2 rounded" />
   </label>
   <button disabled={pending||!status?.configured||!status.can_request_repair} className="border border-cyan-400 rounded px-3 py-2 disabled:opacity-40">{pending?'Submitting repair mission…':'Submit governed repair'}</button>
   {!status?.can_request_repair&&<p>Owner administrator access is required to submit a source repair.</p>}
   {submitted&&<p role="status">Repair mission queued: {submitted}. Follow its recorded stages below or open Mission Control.</p>}
  </form>
  <div className="rounded-xl border border-cyan-500/30 p-4 space-y-3">
   <h3 className="text-white">Recorded repair missions</h3>
   {status&&!status.repairs.length&&<p>No dedicated repair missions in the current history window.</p>}
   {status?.repairs.map(repair=><article key={repair.mission_id} className="border-b border-cyan-800 pb-3 space-y-1">
    <p className="break-all">{repair.mission_id}</p>
    <p>Mission: {repair.mission_status}. Recorded stage: {repair.phase}.</p>
    <p>{repair.rolled_back?'Baseline restored after an unsuccessful candidate.':repair.healed?'Recovery recorded and mission completed.':'Recovery has not been verified.'}</p>
    {repair.last_stop&&<p className="text-amber-300">Recorded stop: {repair.last_stop}</p>}
   </article>)}
  </div>
 </section>;
}
