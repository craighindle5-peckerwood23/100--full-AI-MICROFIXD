import {z} from 'zod';
import {createCaseSchema,type Vehicle} from '../schemas';
import type {AutomotiveRepository} from '../database/repository';
import type {OBDRepository} from './repository';
import {sessionView} from './interpreter';
import {createCase} from '../workflows/diagnosticWorkflow';
const inputSchema=createCaseSchema.omit({dtcs:true}).extend({obdSessionId:z.string().uuid(),identityConfirmed:z.literal(true)});
export async function createCaseFromOBD(repo:AutomotiveRepository,obd:OBDRepository,input:unknown,actor:string){
 const p=inputSchema.parse(input),session=await obd.get(p.obdSessionId),view=sessionView(session);
 if(view.state!=='connected'||!view.understanding.vehicleResponding)throw new Error('LIVE_OBD_SESSION_REQUIRED');
 if(view.interpreted?.vinConflict)throw new Error('OBD_VIN_CONFLICT');
 const vehicle=await repo.get<Vehicle>('vehicle',p.vehicleId);
 if(vehicle.vin&&view.interpreted?.vin&&vehicle.vin!==view.interpreted.vin)throw new Error('VEHICLE_VIN_MISMATCH');
 const dtcs=[...new Set(view.interpreted?.dtcs.map(d=>d.code)??[])];
 return createCase(repo,{vehicleId:p.vehicleId,complaint:p.complaint,dtcs,hazards:p.hazards},actor,
  {type:'obd_session',id:session.id,sequence:session.sequence,receivedAt:session.receivedAt!});
}
