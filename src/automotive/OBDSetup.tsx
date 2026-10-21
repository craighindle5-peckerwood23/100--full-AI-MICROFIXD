import React,{useState} from 'react';
import {api} from '../lib/serverApi';
export default function OBDSetup(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[readiness,setReadiness]=useState('');
 const command=`python bridge.py --setup --server ${window.location.origin}`;
 async function download(){
  setBusy(true);setError('');
  try{
   const bundle=await api<{filename:string;archiveBase64:string;sha256:string}>('GET','/automotive/obd/bridge-package');
   const bytes=Uint8Array.from(atob(bundle.archiveBase64),c=>c.charCodeAt(0));
   const hash=await crypto.subtle.digest('SHA-256',bytes);
   const hex=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
   if(hex!==bundle.sha256)throw new Error('Connector download failed its integrity check');
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),link=document.createElement('a');
   link.href=url;link.download='microfixd-obd-bridge.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function check(){
  setBusy(true);setError('');
  try{const result=await api<{cloudStorageReachable:boolean;hardwareReady:boolean;nextAction:string}>('GET','/automotive/obd/readiness');setReadiness(`Last readiness check (${new Date().toLocaleTimeString()}): ${result.cloudStorageReachable?'Cloud session storage reachable. ':''}${result.hardwareReady?'A responding vehicle session is available. ':'No fresh responding vehicle session yet. '}${result.nextAction}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <details open><summary>Set up your adapter — model unknown is OK</summary>
 <ol><li>Download the connector on the computer attached to your vehicle interface.</li><li>Extract the ZIP. On Windows, run <code>START-WINDOWS.cmd</code>, or run the command below inside the extracted folder.</li><li>Choose a detected J2534 driver or serial port, or enter the adapter’s Wi-Fi/TCP address.</li><li>Enter your existing Microfixd operator/access token in the local prompt, then return here to see the vehicle session.</li></ol>
 <button type="button" disabled={busy} onClick={()=>void download()}>Download local connector</button>{' '}
 <button type="button" disabled={busy} onClick={()=>void check()}>Check connection readiness</button>
 <p><code>{command}</code></p>
 <p>Requires Python 3.10+. J2534 setup checks driver/Python CPU architecture. USB/serial and paired Bluetooth SPP require <code>python -m pip install -r requirements.txt</code>. Inventory does not establish vehicle connectivity.</p>
 {error&&<p role="alert" className="error">{error}</p>}{readiness&&<p role="status">{readiness}</p>}
 </details>;
}
