import {obdConnectionSetup} from './connectionSetup';
import {bridgePackage} from './bridgePackage';
import {isDeepStrictEqual} from 'node:util';
import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database} from '../database/session';
import {OBDRepository} from './repository';
import {obdSessionSchema,obdSampleSchema,type OBDSession} from './schema';
import {interpretSample,sessionView} from './interpreter';
export function createOBDRouter(factory?:(tenant:string)=>OBDRepository){
 const router=Router();
 router.use((req:any,res,next)=>{if(!req.microfixdTenantId||!req.microfixdRole||req.microfixdRole==='anonymous')return res.status(403).json({error:'Authentication required',code:'AUTH_REQUIRED'});if(req.method!=='GET'&&!['operator','admin','system'].includes(req.microfixdRole))return res.status(403).json({error:'Execute permission required'});next();});
 const handler=(work:(req:any,repo:OBDRepository)=>Promise<unknown>)=>(req:any,res:any)=>{void Promise.resolve().then(()=>work(req,factory?factory(req.microfixdTenantId):new OBDRepository(database(),req.microfixdTenantId))).then(data=>res.json(data)).catch(e=>{
  const message=e instanceof Error?e.message:'';const code=/^[A-Z_]+$/.test(message)?message:'OBD_FAILED';res.status(e instanceof z.ZodError?400:code==='NOT_FOUND'?404:code==='OWNER_REQUIRED'?403:code==='REVISION_CONFLICT'?409:/FAILED|UNCONFIGURED/.test(code)?503:422).json({error:e instanceof z.ZodError?'Invalid OBD input':code});
 });};
 router.get('/capabilities',(_req,res)=>res.json(obdConnectionSetup()));
 router.get('/bridge-package',(_req,res)=>{try{res.setHeader('Cache-Control','no-store');res.json(bridgePackage());}catch{res.status(503).json({error:'CONNECTOR_PACKAGE_UNAVAILABLE'});}});
 router.get('/readiness',handler(async(_,repo)=>{const sessions=(await repo.list()).map(s=>sessionView(s));const connected=sessions.filter(s=>s.state==='connected'&&s.understanding.vehicleResponding);return {cloudStorageReachable:true,connectedVehicleSessions:connected.length,hardwareReady:connected.length>0,bridgeRequired:true,sessionStates:sessions.map(s=>({id:s.id,state:s.state})),nextAction:connected.length?'Select a responding session and confirm vehicle identity':'Run the local connector setup on the computer attached to your adapter'};}));
 const identity=(r:any)=>r.microfixdUserId||`shared:${r.microfixdRole}`;
 router.get('/sessions',handler(async(_,repo)=>(await repo.list()).map(s=>sessionView(s))));
 router.post('/sessions',handler(async(req,repo)=>{const p=obdSessionSchema.parse(req.body);return sessionView(await repo.create({id:randomUUID(),...p,owner:identity(req),createdAt:new Date().toISOString(),sequence:0,history:[]}));}));
 router.get('/sessions/:id',handler(async(req,repo)=>sessionView(await repo.get(z.string().uuid().parse(req.params.id)))));
 router.post('/sessions/:id/samples',handler(async(req,repo)=>{
  const p=obdSampleSchema.parse(req.body),s=await repo.get(z.string().uuid().parse(req.params.id));if(s.owner!==identity(req))throw new Error('OWNER_REQUIRED');
  if(p.sequence===s.sequence&&isDeepStrictEqual(p,s.latest))return sessionView(s);
  if(p.sequence!==s.sequence+1)throw new Error('REVISION_CONFLICT');
  if(Math.abs(Date.now()-Date.parse(p.observedAt))>60000)throw new Error('SAMPLE_CLOCK_OUT_OF_RANGE');
  const receivedAt=new Date().toISOString(),decoded=interpretSample(p);
  const queries=[...(s.queries??[])];
  for(const command of new Set(p.responses.map(r=>r.command))){
   const query={command,receivedAt,responses:p.responses.filter(r=>r.command===command)};
   const index=queries.findIndex(q=>q.command===command);if(index<0)queries.push(query);else queries[index]=query;
  }
  const next:OBDSession={...s,sequence:p.sequence,receivedAt,latest:p,queries,history:[...s.history,{at:receivedAt,sequence:p.sequence,status:p.status,dtcs:[...new Set(decoded.dtcs.map(d=>d.code))]}].slice(-120)};
  return sessionView(await repo.save(next,s.sequence));
 }));return router;
}
