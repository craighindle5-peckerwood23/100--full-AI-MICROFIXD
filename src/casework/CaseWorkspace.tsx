import React, { useEffect, useRef, useState } from 'react';
import PostalMime from 'postal-mime';
import { ACCOUNT, SCOPE, searchGmail } from './gmail';
import { chronological, demo, report, topic, topics, type Evidence } from './evidence';
import './casework.css';

type GoogleClient = {requestAccessToken:(options:{prompt:string})=>void};
export default function CaseWorkspace() {
  const [rows,setRows]=useState<Evidence[]>([]), [selected,setSelected]=useState<string[]>([]);
  const [filter,setFilter]=useState('All'), [query,setQuery]=useState('in:anywhere -in:drafts {mcnicholas browngreer "client file"}');
  const [clientId,setClientId]=useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [status,setStatus]=useState('Choose Demo, import original email files, or connect Gmail.'), [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false),[page,setPage]=useState('');
  const token=useRef(''),expires=useRef(0),client=useRef<GoogleClient|null>(null),generation=useRef(0);
  useEffect(()=>()=>{token.current='';generation.current++;},[]);
  function clear() {generation.current++;token.current='';expires.current=0;setRows([]);setSelected([]);setPage('');setStatus('Page cleared and disconnected. Google permission can also be removed in your Google Account.');}
  function merge(incoming:Evidence[]) {setRows(old=>[...new Map([...old,...incoming].map(e=>[e.id,e])).values()]);}
  async function search(next='') {
    const run=generation.current;
    if(!token.current || Date.now()>expires.current){setStatus('Connect Gmail to authorize this session.');return;}
    setBusy(true);
    try {const result=await searchGmail(token.current,query,next);if(run!==generation.current)return;merge(result.rows);setPage(result.nextPageToken);setStatus(`Loaded ${result.rows.length} messages. ${result.nextPageToken?'More results available.':'End of this search.'} This is not a complete case review.`);}
    catch(e){if(run===generation.current)setStatus((e as Error).message);}finally{setBusy(false);}
  }
  function loadGoogle() {
    if((window as any).google?.accounts?.oauth2){setReady(true);return;}
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>setReady(true);script.onerror=()=>setStatus('Google sign-in could not load. Import .eml files to work offline.');document.head.appendChild(script);
  }
  function connect() {
    try {
      const oauth=(window as any).google.accounts.oauth2;
      client.current=oauth.initTokenClient({client_id:clientId.trim(),scope:SCOPE,include_granted_scopes:false,login_hint:ACCOUNT,
        callback:(r:any)=>{if(r.error || !r.access_token || !oauth.hasGrantedAllScopes(r,SCOPE)){setStatus('Gmail read permission was not granted.');return;} token.current=r.access_token;expires.current=Date.now()+Number(r.expires_in)*1000;setStatus('Authorized for this session. Click Search Gmail; account is checked before reading messages.');},
        error_callback:()=>setStatus('Google sign-in closed or failed. Try again.')});
      client.current!.requestAccessToken({prompt:'consent'});
    }catch{setStatus('Google authorization could not start. Check the OAuth client ID and allowed website origin.');}
  }
  async function importFiles(files:FileList|null) {
    if(!files)return;setBusy(true);
    try {
      const loaded:Evidence[]=[];
      for(const f of Array.from(files)) {
        if(f.size>15_000_000)throw new Error('Each email must be smaller than 15 MB.');
        const bytes=await f.arrayBuffer();const raw=new Uint8Array(bytes);const parsed=await PostalMime.parse(bytes);
        const hash=await crypto.subtle.digest('SHA-256',bytes);
        const id=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
        loaded.push({id,date:parsed.date??'',from:parsed.from?.address??'',to:parsed.to?.map(x=>x.address).join(', ')??'',subject:parsed.subject??f.name,text:parsed.text || '[No plain-text body; review original .eml]',labels:[],attachments:parsed.attachments.map(x=>x.filename??'Unnamed attachment'),source:'eml',raw});
      }
      merge(loaded);setStatus(`Imported ${loaded.length} email files. Check delivery status in the originals; imported files are not assumed sent.`);
    }catch(e){setStatus((e as Error).message);}finally{setBusy(false);}
  }
  function download(name:string,text:string|Uint8Array,mime='text/plain') {const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const visible=chronological(rows.filter(e=>filter==='All'||topic(e)===filter));
  const chosen=rows.filter(e=>selected.includes(e.id));
  return <main className="casework">
    <header><a href="/">← Microfixd OS</a><span>PRIVATE WORKSPACE · READ ONLY</span><h1>Correspondence → evidence</h1><p>McNicholas &amp; McNicholas correspondence review · {ACCOUNT}</p></header>
    <section><h2>1. Bring in correspondence</h2><p>Messages stay in this page’s memory. Export before closing. This workspace does not send email, change Gmail labels, or upload messages to AI.</p>
      <div className="case-actions"><button disabled={busy} onClick={()=>{clear();setRows(demo);setStatus('Fictional demo loaded. Select both messages and export the review index.');}}>Try fictional demo</button><label className="case-button">Import .eml files<input aria-label="Import email files" type="file" accept=".eml,message/rfc822" multiple disabled={busy} onChange={e=>void importFiles(e.target.files)}/></label><button disabled={busy} onClick={clear}>Clear &amp; disconnect</button></div>
      <details><summary>Connect Gmail (Google setup required)</summary><p>Requires a Google Web OAuth client with this website origin authorized and Gmail API enabled. Use your settlement account. Google tokens stay in memory.</p><label>Google OAuth client ID<input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="…apps.googleusercontent.com"/></label><div className="case-actions"><button onClick={loadGoogle}>Load Google sign-in</button><button disabled={!ready||!clientId||busy} onClick={connect}>Authorize Gmail read access</button></div><label>Gmail search<input value={query} onChange={e=>{setQuery(e.target.value);setPage('');}}/></label><div className="case-actions"><button disabled={busy} onClick={()=>void search()}>Search Gmail</button><button disabled={busy||!page} onClick={()=>void search(page)}>Load next 20</button></div></details>
    </section>
    <p role="status" aria-live="polite">{busy?'Working… ':''}{status}</p>
    <section><h2>2. Review &amp; select</h2><p>Topics use keyword matching. Notes are your statements. Neither establishes misconduct. Drafts and incomplete search results require special care.</p><div className="case-actions"><label>Topic<select value={filter} onChange={e=>setFilter(e.target.value)}>{topics.map(t=><option key={t}>{t}</option>)}</select></label><button onClick={()=>setSelected(visible.map(e=>e.id))}>Select visible</button><button onClick={()=>setSelected([])}>Deselect all</button></div>
      <p>{rows.length} messages loaded · {selected.length} selected</p>
      {visible.map(e=><article key={e.id}><label><input type="checkbox" checked={selected.includes(e.id)} onChange={v=>setSelected(old=>v.target.checked?[...old,e.id]:old.filter(id=>id!==e.id))}/><strong>{e.subject||'(No subject)'}</strong></label><p>{e.date||'Date unknown'} · {topic(e)} · {e.source.toUpperCase()} {e.labels.includes('DRAFT')?'· DRAFT — not proof of sending':''}</p><p>From: {e.from}<br/>To: {e.to}</p><p>Attachments indexed: {e.attachments.join(', ')||'None'}</p><details><summary>Read message text</summary><pre>{e.text}</pre></details><label>Your note (unverified)<textarea value={e.note??''} onChange={v=>setRows(old=>old.map(x=>x.id===e.id?{...x,note:v.target.value}:x))}/></label>{e.source==='gmail'&&<a target="_blank" rel="noreferrer" href={`https://mail.google.com/mail/u/?authuser=${encodeURIComponent(ACCOUNT)}#all/${encodeURIComponent(e.id)}`}>Open original in Gmail ↗</a>}{e.raw&&<button onClick={()=>download(`${e.id}.eml`,e.raw,'message/rfc822')}>Download original email</button>}</article>)}
      {!rows.length&&<p>No correspondence loaded yet. Start with the fictional demo above.</p>}
    </section>
    <section><h2>3. Export your review</h2><p>Chronological index with exhibit numbers, message IDs, attachment names, text, and your notes. Gmail attachments and original MIME are not bundled; preserve originals separately. This is a working index, not a court filing or a complete evidence archive.</p><button disabled={!chosen.length} onClick={()=>download('correspondence-review.md',report(chosen),'text/markdown')}>Export selected evidence index</button></section>
  </main>;
}
