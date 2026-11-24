import type {RequestHandler} from 'express';
import {metacognitiveContext} from './context';
import {createSupervisor,metacognitiveClient} from './store';
import {MetacognitiveIntervention, type MetacognitiveSupervisor, type Subject} from './supervisor';

/** Mount after authentication, before every protected API router. No body/header can disable it. */
export function metacognitiveMiddleware(factory:(tenant:string)=>MetacognitiveSupervisor=tenant=>createSupervisor(metacognitiveClient(),tenant)):RequestHandler {
  return (req,res,next)=>{
    const path = req.path.toLowerCase().replace(/\/$/, '');
    if(!path.startsWith('/api/') || path === '/api/health' || path.startsWith('/api/health/') || path.startsWith('/api/metacognition/'))return next();
    const tenant=(req as any).microfixdTenantId;
    if(!tenant)return void res.status(403).json({code:'AUTH_REQUIRED'});
    // Emergency recovery and observation must remain accessible while execution is stopped.
    if(['GET','HEAD','OPTIONS'].includes(req.method)&&!['/api/playwright/links','/api/automotive/vin/','/api/automotive/oem/'].some(p=>path.startsWith(p)))return next();
    if(path==='/api/command/oversight/kill-switch'||path==='/api/playwright/stop')return next();
    let supervisor:MetacognitiveSupervisor;
    try{supervisor=factory(tenant);}catch{return void res.status(503).json({code:'METACOGNITIVE_STORAGE_UNAVAILABLE'});}
    const subject:Subject={tenant_id:tenant,agent_id:'api:'+String((req as any).microfixdRole),action:req.method+' '+req.path,
      // Never put credentials or request bodies into telemetry, including their hashes on login routes.
      input:{method:req.method,path:req.route?.path??req.path},permitted:(req as any).microfixdRole!=='anonymous'};
    void supervisor.before(subject).then(trace=>{
      const json=res.json.bind(res);let sending=false;
      res.setHeader('X-Metacognitive-Trace',trace);
      res.json=((body:unknown)=>{
        if(sending)return res;
        sending=true;
        // A response is held until its assessment is durable. Earlier side effects cannot be rolled back here.
        void supervisor.candidate(subject,trace,{status:res.statusCode},{valid:true}).then(()=>json(body)).catch(error=>{
          res.status(error instanceof MetacognitiveIntervention?423:503);
          json({code:error instanceof MetacognitiveIntervention?error.code:'METACOGNITIVE_TELEMETRY_UNAVAILABLE',trace_id:trace,reconciliation_required:!['GET','HEAD','OPTIONS'].includes(req.method)});
        });
        return res;
      }) as typeof res.json;
      metacognitiveContext.run({supervisor,subject},next);
    }).catch(error=>{
      res.status(error instanceof MetacognitiveIntervention?423:503).json({code:error instanceof MetacognitiveIntervention?error.code:'METACOGNITIVE_CONTROL_UNAVAILABLE'});
    });
  };
}
