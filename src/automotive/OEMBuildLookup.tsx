import React,{useEffect,useState} from 'react';
import {api} from '../lib/serverApi';
type BuildResponse={build:Record<string,unknown>|null;vehicle?:Record<string,unknown>;catalog?:Record<string,unknown>|null;missing?:unknown[];reason?:string;retryable?:boolean};
export default function OEMBuildLookup({vin:initialVIN=''}:{vin?:string}){
 const [vin,setVIN]=useState(initialVIN),[result,setResult]=useState<BuildResponse|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{setVIN(initialVIN);setResult(null);setError('');},[initialVIN]);
 return <details><summary>Factory build and equipment (Auto.dev)</summary>
 <p>Look up the VIN’s recorded factory build. Provider access is required. Catalog options describe availability, not equipment installed on this vehicle.</p>
 <form onSubmit={event=>{event.preventDefault();setBusy(true);setError('');setResult(null);void api<BuildResponse>('GET',`/automotive/oem/build/${encodeURIComponent(vin.trim().toUpperCase())}`).then(setResult).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>
 <label>17-character VIN<input aria-label="OEM build VIN" value={vin} onChange={e=>{setVIN(e.target.value);setResult(null);}} required pattern="[A-HJ-NPR-Z0-9a-hj-npr-z]{17}" maxLength={17}/></label><button disabled={busy}>{busy?'Looking up…':'Look up factory build'}</button></form>
 {error&&<p role="alert">{error}</p>}
 {result&&<div role="status">
 <h3>{result.build===null?'Partial result — no VIN-specific build record':'VIN-specific factory build'}</h3>
 {result.build===null&&<><p>Reason: {result.reason??'not supplied'}. {result.retryable?'The provider permits a later retry.':'No automatic retry is scheduled.'}</p><pre>{JSON.stringify(result.vehicle,null,2)}</pre></>}
 {result.build&&<dl>{Object.entries(result.build).map(([key,value])=><React.Fragment key={key}><dt>{key}</dt><dd>{typeof value==='object'?JSON.stringify(value):String(value??'unavailable')}</dd></React.Fragment>)}</dl>}
 {result.missing?.length>0&&<><h4>Unavailable fields</h4><pre>{JSON.stringify(result.missing,null,2)}</pre></>}
 {result.catalog&&<details><summary>Catalog possibilities — installed equipment unconfirmed</summary><pre>{JSON.stringify(result.catalog,null,2)}</pre></details>}
 </div>}
 </details>;
}
