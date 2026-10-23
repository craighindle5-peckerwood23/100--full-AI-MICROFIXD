import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ExecutionContext} from '../planner/executionSpine';
import {repairPath} from './sourceRepair';

export function sourceIncident(error:unknown){
 if(!(error instanceof ReferenceError||error instanceof SyntaxError||error instanceof TypeError&&/Cannot (read|set) properties|is not a function|is not iterable/.test(error.message)))return null;
 const frames=[...new Set([...String(error.stack??'').matchAll(/(?:^|[/( ])((?:server|src|microfixd)\/[a-zA-Z0-9_./-]+\.(?:tsx?|m?js)):(\d+):(\d+)/gm)].map(m=>`${m[1].replace(/^(?:src\/)+(?=(?:server|src|microfixd)\/)/,'')}:${m[2]}:${m[3]}`))].slice(0,5);
 const paths=[...new Set(frames.map(frame=>frame.split(':')[0]).filter(path=>{try{repairPath(path);return true;}catch{return false;}}))].slice(0,3);
 if(!paths.length)return null;
 return {paths,objective:`Investigate and minimally repair the observed ${error.name} in ${frames.join(', ')}. Preserve existing behavior, authorization and validation. Return an exact source edit only when the code supports a fix.`,fingerprint:createHash('sha256').update(JSON.stringify([error.name,error.message.replace(/[a-f0-9]{16,}|\d+/gi,'#'),paths])).digest('hex')};
}
/** Trusted error observation only. Provider/permission waits and model-reported bugs never enqueue. */
export async function enqueueSourceIncident(db:SupabaseClient,context:ExecutionContext,error:unknown){
 if(process.env.MICROFIXD_AUTOMATIC_SOURCE_REPAIR!=='1'||!process.env.MICROFIXD_REPAIR_RUNNER_URL||context.tenant_id!==(process.env.MICROFIXD_REPAIR_OWNER_TENANT||'default')||context.constraints.tool_approval_mode!=='preauthorized'||!context.constraints.approval_actor)return;
 const incident=sourceIncident(error);if(!incident)return;
 const {error:failure}=await db.rpc('enqueue_source_repair',{p_tenant:context.tenant_id,p_fingerprint:incident.fingerprint,p_objective:incident.objective,p_paths:incident.paths});
 if(failure)throw new Error('REPAIR_INCIDENT_QUEUE_UNAVAILABLE');
}
