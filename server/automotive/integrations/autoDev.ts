import {Router} from 'express';

/** Mounted inside the authenticated automotive router. Credentials never reach the client. */
export function createAutoDevRouter(fetcher:typeof fetch=fetch,key:()=>string|undefined=()=>process.env.AUTO_DEV_API_KEY){
  const router=Router();
  router.get('/build/:vin',async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const vin=req.params.vin.trim().toUpperCase();
    if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)){res.status(400).json({error:'INVALID_VIN'});return;}
    const apiKey=key()?.trim();
    if(!apiKey){res.status(503).json({error:'OEM_BUILD_UNCONFIGURED'});return;}
    try{
      const upstream=await fetcher(`https://api.auto.dev/build/${encodeURIComponent(vin)}`,{
        redirect:'error',headers:{Authorization:`Bearer ${apiKey}`,Accept:'application/json'},signal:AbortSignal.timeout(15000),
      });
      if([401,403].includes(upstream.status)){res.status(503).json({error:'OEM_PROVIDER_ACCESS_UNAVAILABLE'});return;}
      const reader=upstream.body?.getReader();if(!reader)throw new Error('INVALID_RESPONSE');
      const chunks:Uint8Array[]=[];let size=0;
      try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000)throw new Error('OVERSIZE_RESPONSE');chunks.push(value);}}
      finally{await reader.cancel();}
      const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('INVALID_RESPONSE');
      if(upstream.ok&&(!('build' in data)||(upstream.status===207&&data.build!==null)))throw new Error('INVALID_BUILD_RESPONSE');
      if(upstream.status===429){const retry=upstream.headers.get('retry-after');if(retry&&retry.length<128)res.setHeader('Retry-After',retry);}
      // Preserve build:null, catalog.vinSpecific:false, reason, retryable and missing.
      res.status(upstream.status).json(data);
    }catch(error){
      const timeout=error instanceof Error&&['TimeoutError','AbortError'].includes(error.name);
      res.status(timeout?504:502).json({error:timeout?'OEM_PROVIDER_TIMEOUT':'OEM_PROVIDER_UNAVAILABLE'});
    }
  });
  return router;
}
