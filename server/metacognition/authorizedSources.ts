import {lookup} from 'node:dns/promises';
import {get} from 'node:https';
import {isIP} from 'node:net';
import {digest} from './supervisor';
interface Address {address:string;family:number}
export function publicAddress(address:string):boolean {
  if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224||a===198&&(b===18||b===19));}
  if(isIP(address)===6)return /^2[0-9a-f]{3}:/i.test(address)&&!/^2001:db8:/i.test(address);
  return false;
}
async function readPinned(url:URL,token:string,address:Address):Promise<string>{
  return new Promise((resolve,reject)=>{
    const request=get(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json, text/plain, text/html'},
      // Pin the validated address for this connection; no second DNS lookup or automatic redirects.
      lookup:(_host,options,callback)=>{const done=callback as (...args:any[])=>void;if((options as any).all)done(null,[address]);else done(null,address.address,address.family);},
    },response=>{
      if(!response.statusCode||response.statusCode<200||response.statusCode>=300){response.resume();reject(new Error('AUTHORIZED_SOURCE_HTTP_ERROR'));return;}
      const chunks:Buffer[]=[];let length=0;
      response.on('data',chunk=>{length+=chunk.length;if(length>256000){response.destroy();reject(new Error('AUTHORIZED_SOURCE_TOO_LARGE'));}else chunks.push(Buffer.from(chunk));});
      response.on('error',()=>reject(new Error('AUTHORIZED_SOURCE_READ_FAILED')));
      response.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
    });
    const timer=setTimeout(()=>request.destroy(new Error('AUTHORIZED_SOURCE_TIMEOUT')),15000);
    request.on('close',()=>clearTimeout(timer));request.on('error',()=>reject(new Error('AUTHORIZED_SOURCE_UNAVAILABLE')));
  });
}
/** Tenant-bound server-configured connector. Credentials never enter planner arguments or returned evidence. */
export async function readAuthorizedSource(input:{source_id:string;path:string},tenant:string,
  dependencies:{resolve:(host:string)=>Promise<Address[]>;read:typeof readPinned}={resolve:host=>lookup(host,{all:true}),read:readPinned}){
  if(!tenant||typeof input.source_id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(input.source_id)||typeof input.path!=='string')throw new Error('INVALID_AUTHORIZED_SOURCE');
  let sources:any;try{sources=JSON.parse(process.env.MICROFIXD_AUTHORIZED_SOURCES_JSON??'[]');}catch{throw new Error('AUTHORIZED_SOURCES_UNCONFIGURED');}
  if(!Array.isArray(sources)||sources.length>32)throw new Error('AUTHORIZED_SOURCES_UNCONFIGURED');
  const source=sources.find(s=>s?.id===input.source_id);
  if(!source||!Array.isArray(source.tenants)||!source.tenants.includes(tenant)||!Array.isArray(source.paths)||!source.paths.includes(input.path))throw new Error('AUTHORIZED_SOURCE_DENIED');
  const base=new URL(source.origin),url=new URL(input.path,base);
  const hasCredentials=base.username.length>0||base.password.length>0;
  const validPath=/^\/[a-zA-Z0-9/_-]*$/.test(input.path);
  if(base.origin!==source.origin||base.protocol!=='https:'||base.port||hasCredentials||url.origin!==base.origin||!validPath)throw new Error('INVALID_AUTHORIZED_SOURCE_URL');
  if(typeof source.token_env!=='string'||!/^MICROFIXD_SOURCE_[A-Z0-9_]+_TOKEN$/.test(source.token_env))throw new Error('INVALID_SOURCE_CREDENTIAL_REFERENCE');
  const token=process.env[source.token_env];if(!token||/[\r\n]/.test(token))throw new Error('AUTHORIZED_SOURCE_CREDENTIALS_MISSING');
  const addresses=await dependencies.resolve(url.hostname);
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('AUTHORIZED_SOURCE_NETWORK_DENIED');
  const content=await dependencies.read(url,token,addresses[0]);
  return {source_id:source.id,url:url.href,retrieved_at:new Date().toISOString(),content,evidence_hash:digest(content),
    access:'authorized_server_connector',trust:'untrusted_reference_data'};
}
