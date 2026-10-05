/** Adapted from Agent Reach channels/web.py and utils/url.py. See docs/agent-reach-license.txt. */
import { isIP } from 'node:net';
export function publicPageURL(input:string):string {
  if(!input || /[\s\\\x00-\x1f\x7f]/.test(input))throw new Error('Public HTTP(S) URL required');
  const url=new URL(input.includes('://')?input:`https://${input}`);
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!host.includes('.')||isIP(host)||host.startsWith('[')||/^(localhost|instance-data)$|(^|\.)(local|localhost|internal|lan|localdomain|home\.arpa)$/.test(host))throw new Error('Public hostname required; credentials and local addresses are forbidden');
  if(/^(127|10|0)\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host))throw new Error('Private addresses forbidden');
  for(const key of url.searchParams.keys())if(/token|password|secret|session|api.?key|authorization/i.test(key))throw new Error('Credential-bearing URLs cannot be sent to the public reader');
  url.hash='';return url.href;
}
export async function readPublicPage(input:string):Promise<{url:string;text:string;source:string}> {
  const url=publicPageURL(input);
  const response=await fetch(`https://r.jina.ai/${url}`,{headers:{Accept:'text/plain'},signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw new Error(`Public reader failed: HTTP ${response.status}`);
  const reader=response.body?.getReader();if(!reader)throw new Error('Public reader returned no body');
  const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>120000)throw new Error('Public page exceeds tool context budget');chunks.push(value);}}
  catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  const text=Buffer.concat(chunks).toString('utf8'),sample=text.slice(0,4096).toLowerCase();
  if(!text.trim()||(sample.includes('warning:')&&sample.includes('requiring captcha')&&/title: just a moment|performing security verification|attention required/.test(sample))||(sample.includes('title: attention required! | cloudflare')&&/ray id|cdn-cgi\/challenge-platform/.test(sample)))throw new Error('Target page unavailable or requires human verification');
  return {url,text,source:'jina_public_reader'};
}
