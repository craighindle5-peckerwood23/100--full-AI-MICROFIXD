import {obdConnectionSetup} from '../../automotive/obd/connectionSetup';
import {OBDRepository} from '../../automotive/obd/repository';
import {sessionView} from '../../automotive/obd/interpreter';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {database} from '../../automotive/database/session';
import {AutomotiveRepository} from '../../automotive/database/repository';
import type {DiagnosticCase} from '../../automotive/schemas';
import {selectTest} from '../../automotive/torquelogic/testSelector';
import {searchVehicleReferences} from '../../automotive/sourceReferences';
import {searchCatalog} from '../../automotive/vehicleCatalog';
export async function executeAutomotiveOrgan(action:string,payload:unknown,client?:SupabaseClient){
 const p=z.object({tenant_id:z.string().min(1),case_id:z.string().uuid().optional(),obd_session_id:z.string().uuid().optional()}).passthrough().parse(payload);
 if(action==='obd_setup')return obdConnectionSetup();
 if(action==='catalog')return searchCatalog(client??database(),z.string().max(100).default('').parse(p.query),z.string().min(1).max(300).optional().parse(p.make),z.number().int().min(0).max(100000).default(0).parse(p.offset));
 if(action==='references')return searchVehicleReferences(client??database(),z.string().min(1).max(4000).parse(p.query));
 if(['obd_sessions','obd_status'].includes(action)){
  const repo=new OBDRepository(client??database(),p.tenant_id);
  const sessions=action==='obd_sessions'?await repo.list():[await repo.get(z.string().uuid().parse(p.obd_session_id))];
  return {sessions:sessions.map(s=>sessionView(s))};
 }
 if(!['list','read'].includes(action))throw new Error('UNSUPPORTED_AUTOMOTIVE_ACTION');
 const id=action==='read'?z.string().uuid().parse(p.case_id):undefined;
 const repo=new AutomotiveRepository(client??database(),p.tenant_id);
 const cases=action==='list'?await repo.list<DiagnosticCase>('case'):[await repo.get<DiagnosticCase>('case',id!)];
 return {cases:cases.map(c=>({...c,nextTest:selectTest(c)})),verification:'Technician-entered; not independent hardware testing'};
}
