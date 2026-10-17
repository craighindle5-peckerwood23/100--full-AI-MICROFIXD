import type { Evidence } from './evidence';
const ROOT = 'https://gmail.googleapis.com/gmail/v1/users/me';
export const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const ACCOUNT = 'craighindle5@gmail.com';
export type GmailFetch = typeof fetch;
async function get(path: string, token: string, request: GmailFetch) {
  const r = await request(`${ROOT}${path}`, {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
  if (!r.ok) throw new Error(r.status===401?'Google authorization expired. Connect Gmail again.':`Gmail request failed (${r.status}). Check Gmail API access and consent.`);
  return r.json();
}
function decode(s: string) {
  return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0)));
}
export function normalize(m: any): Evidence {
  const headers = m.payload?.headers ?? [];
  const h = (name:string) => headers.find((x:any)=>x.name.toLowerCase()===name)?.value ?? '';
  const bodies:string[]=[]; const attachments:string[]=[];
  function walk(p:any) {
    if (p.filename) attachments.push(p.filename);
    if(p.mimeType==='text/plain' && !p.filename && p.body?.data) bodies.push(decode(p.body.data));
    for(const child of p.parts??[]) walk(child);
  }
  walk(m.payload??{});
  return {id:m.id,date:h('Date'),from:h('From'),to:h('To'),subject:h('Subject'),text:bodies.join('\n') || '[No inline plain-text body. Open the original message to review HTML or externally stored content.]',labels:m.labelIds??[],attachments,source:'gmail'};
}
export async function searchGmail(token:string, query:string, pageToken='', request:GmailFetch=fetch) {
  const profile = await get('/profile',token,request);
  if(profile.emailAddress?.toLowerCase()!==ACCOUNT) throw new Error(`Use ${ACCOUNT}. No messages were loaded.`);
  const params=new URLSearchParams({q:query,maxResults:'20',includeSpamTrash:'true'});
  if(pageToken)params.set('pageToken',pageToken);
  const result=await get(`/messages?${params}`,token,request);
  const rows:Evidence[]=[];
  // Bounded batches avoid flooding Gmail with parallel reads.
  const ids=result.messages??[];
  for(let i=0;i<ids.length;i+=4) rows.push(...await Promise.all(ids.slice(i,i+4).map(async (m:any)=>normalize(await get(`/messages/${encodeURIComponent(m.id)}?format=full`,token,request)))));
  return {rows,nextPageToken:result.nextPageToken??''};
}
