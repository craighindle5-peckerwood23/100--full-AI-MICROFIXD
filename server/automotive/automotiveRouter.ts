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
import {importVehicleReferences,searchVehicleReferences} from './sourceReferences';
import {searchCatalog,syncCatalog,CATALOG_SOURCE} from './vehicleCatalog';
import {createAutoDevRouter} from './integrations/autoDev';
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
 router.use('/oem',createAutoDevRouter());
 router.get('/catalog',handler(async req=>searchCatalog(database(),z.string().max(100).default('').parse(req.query.query),z.string().min(1).max(300).optional().parse(req.query.make),z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset))));
 router.post('/catalog/sync',handler(async req=>{
   if(req.microfixdRole!=='admin')throw new Error('ADMIN_REQUIRED');
   return syncCatalog(database());
 }));
 router.get('/catalog/status',handler(async()=>{
   const db=database();const states=await Promise.all(['queued','running','completed','failed'].map(async state=>{
     const {count,error}=await db.from('automotive_ingestion_jobs').select('id',{count:'exact',head:true}).eq('source_id',CATALOG_SOURCE).eq('state',state);
     if(error)throw new Error('CATALOG_STATUS_FAILED');return [state,count];
   }));
   return {jobs:Object.fromEntries(states),workerEnabled:process.env.AUTOMOTIVE_INGESTION_ENABLED!=='0',coverage:'model_names_only',continuousAvailability:'depends_on_host_uptime'};
 }));
 const id=(req:Request)=>z.string().uuid().parse(req.params.id);
 router.get('/references',handler(async req=>searchVehicleReferences(database(),z.string().min(1).max(4000).parse(req.query.query))));
 router.post('/references/import',handler(async req=>{
   if(req.microfixdRole!=='admin')throw new Error('ADMIN_REQUIRED');
   const input=z.object({kind:z.enum(['recalls','complaints']),make:z.string().min(1).max(70),model:z.string().min(1).max(70),modelYear:z.number().int().min(1981).max(2100)}).strict().parse(req.body);
   return importVehicleReferences(database(),input.kind,input);
 }));
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
