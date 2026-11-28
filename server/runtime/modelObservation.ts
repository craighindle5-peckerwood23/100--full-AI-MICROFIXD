import {liveCapabilityLedger} from './liveCapabilities';
import {organRegistry} from '../organs/organRegistry';

/** Read observations only. Never trigger model-backed probes from a model call. */
export function modelRuntimeObservation() {
 const snapshot=liveCapabilityLedger.getSnapshot();
 return {observed_at:new Date().toISOString(),production_revision:process.env.RENDER_GIT_COMMIT??null,
  system_health:organRegistry.systemHealth(),registered_organs:organRegistry.all().length,
  failed_core_organs:['brain','memory','constitution','governance'].filter(id=>organRegistry.get(id)?.status==='error'),
  capability_snapshot:{generated_at:snapshot.generatedAt,stale:snapshot.stale,
   counts:snapshot.counts,subsystems:snapshot.subsystems.map(s=>({id:s.id,status:s.status,tier:s.verificationTier,checked_at:s.checkedAt}))},
  limits:['Registration and routing do not prove execution.','Stale or missing probes cannot establish current capability.','Browser spike injection is simulation, not a server fault or repair.','Source healing excludes provider quotas, budgets, credentials and approvals.']};
}
