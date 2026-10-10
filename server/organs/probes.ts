import {CanaryRouter} from '../runtime/canary';
import {organRegistry} from './organRegistry';
import {EXECUTORS} from './executors';
const configured=Number(process.env.MICROFIXD_PROBE_CANARY_PERCENT??0);
export const probeCanary=new CanaryRouter({percentage:configured,minimum_samples:5,maximum_error_rate:0.1,timeout_ms:1000});
export async function probeOrgan(id:string,request_id:string,tenant:string){
 const organ=organRegistry.get(id);if(!organ)throw Error('UNKNOWN_ORGAN');if(organ.isolated)throw Error('ORGAN_ISOLATED');
 const stable=async()=>({organ:id,request_id,tenant_id:tenant,probe_version:'v1',native_executor:Object.hasOwn(EXECUTORS,id),capability_verified:false});
 const candidate=async()=>({...await stable(),probe_version:'v2',registered:true,layer:organ.layer});
 return probeCanary.execute(tenant+':'+request_id+':'+id,stable,candidate,value=>value.organ===id&&value.request_id===request_id&&value.tenant_id===tenant&&value.native_executor===Object.hasOwn(EXECUTORS,id));
}
