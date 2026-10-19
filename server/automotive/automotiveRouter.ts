import {createCaseFromOBD} from './obd/caseWorkflow';
import {OBDRepository} from './obd/repository';
import {createOBDRouter} from './obd/obdRouter';
import {Router,type Request,type RequestHandler} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {database} from './database/session';
import {AutomotiveRepository} from './database/repository';
import {vehicleSchema,knowledgeSchema,actionSchema,type Vehicle,type DiagnosticCase} from './schemas';
import {createCase,refreshEvidence} from './workflows/diagnosticWorkflow';
import {transition} from './torquelogic/stateMachine';
import {selectTest} from './torquelogic/testSelector';
import {decodeVIN} from './integrations/vinDecoder';
import {embed} from './driveiq/embedder';
type Context=Request&{microfixdTenantId?:string;microfixdUserId?:string;microfixdRole?:string};
const actor=(r:Context)=>r.microfixdUserId||`shared:${r.microfixdRole}`;
const view=(c:DiagnosticCase)=>({...c,nextTest:selectTest(c),repairCandidates:c.state==='testing'&&!c.alerts.length?c.hypotheses.filter(h=>h.status==='supported').map(h=>({hypothesisId:h.id,repair:h.evidence.repair,source:h.evidence.source})):[]});
export function createAutomotiveRouter(repository?:(tenant:string)=>AutomotiveRepository){
 const router=Router();
 router.use((req:Context,res,next)=>{if(!req.microfixdTenantId||!req.microfixdRole||req.microfixdRole==='anonymous'){res.status(403).json({error:'Authentication required',code:'AUTH_REQUIRED'});return;}next();});
 const handler=(work:(req:Context,repo:AutomotiveRepository)=>Promise<unknown>):RequestHandler=>(req:Context,res)=>{
   void Promise.resolve().then(()=>work(req,repository?repository(req.microfixdTenantId!):new AutomotiveRepository(database(),req.microfixdTenantId!))).then(data=>res.json(data)).catch(error=>{
     if(error instanceof z.ZodError){res.status(400).json({error:'Invalid automotive input',issues:error.issues});return;}
     const message=error instanceof Error?error.message:'';
     const code=/^[A-Z_]+(?:: specialist assessment required; this MVP cannot clear safety holds)?$/.test(message)?message:'AUTOMOTIVE_FAILED';
     const unavailable=/FAILED|UNCONFIGURED|UNAVAILABLE|KEY_REQUIRED|INVALID_DATABASE/.test(code);
     res.status(code==='ADMIN_REQUIRED'?403:code==='NOT_FOUND'?404:code==='REVISION_CONFLICT'?409:unavailable?503:422).json({error:unavailable?'Automotive dependency unavailable; no success was recorded':code,code:unavailable?'AUTOMOTIVE_DEPENDENCY_UNAVAILABLE':code});
   });
 };
 router.use('/obd',createOBDRouter());
 const id=(req:Request)=>z.string().uuid().parse(req.params.id);
 router.get('/vehicles',handler(async(_,repo)=>repo.list<Vehicle>('vehicle')));
 router.post('/vehicles',handler(async(req,repo)=>repo.insert('vehicle',{...vehicleSchema.parse(req.body),id:randomUUID()})));
 router.get('/vin/:vin',handler(async(req)=>decodeVIN(req.params.vin.toUpperCase())));
 router.get('/cases',handler(async(_,repo)=>(await repo.list<DiagnosticCase>('case')).map(view)));
 router.post('/cases/from-obd',handler(async(req,repo)=>view(await createCaseFromOBD(repo,new OBDRepository(database(),req.microfixdTenantId!),req.body,actor(req)))));
 router.post('/cases',handler(async(req,repo)=>view(await createCase(repo,req.body,actor(req)))));
 router.get('/cases/:id',handler(async(req,repo)=>view(await repo.get<DiagnosticCase>('case',id(req)))));
 router.post('/cases/:id/actions',handler(async(req,repo)=>{
   const action=actionSchema.parse(req.body),c=await repo.get<DiagnosticCase>('case',id(req));
   return view(await repo.save(transition(c,action,actor(req)),action.revision));
 }));
 router.post('/cases/:id/evidence',handler(async(req,repo)=>view(await refreshEvidence(repo,await repo.get<DiagnosticCase>('case',id(req)),actor(req)))));
 router.get('/cases/:id/report',handler(async(req,repo)=>({title:'Vector Automotive Diagnostic Report',...view(await repo.get<DiagnosticCase>('case',id(req))),confidence:'Evidence status is not a calibrated probability; observations and verification are technician-entered.'})));
 router.post('/knowledge',handler(async(req,repo)=>{
   if(req.microfixdRole!=='admin')throw new Error('ADMIN_REQUIRED');
   const data={...knowledgeSchema.parse(req.body),id:randomUUID()};
   return repo.insert('knowledge',data,await embed(`${data.title}\n${data.excerpt}\n${data.cause}\n${data.symptoms.join(' ')}`));
 }));
 return router;
}
export const automotiveRouter=createAutomotiveRouter();
