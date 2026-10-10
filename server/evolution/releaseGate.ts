import {contentHash} from '../planner/executionSpine';
export interface ReleasePolicy {version:string;required_cases:string[];maximum_failures:number}
export interface EvaluationCase {id:string;passed:boolean}
export interface ReleaseReport {policy_version:string;policy_hash:string;cases:EvaluationCase[];approved:boolean;reasons:string[];hash:string}
export function evaluateRelease(policy:ReleasePolicy,cases:EvaluationCase[]):ReleaseReport {
 if(!policy||typeof policy.version!=='string'||!policy.version.trim()||!Array.isArray(policy.required_cases)||!policy.required_cases.length||policy.required_cases.some(id=>typeof id!=='string'||!id.trim())||new Set(policy.required_cases).size!==policy.required_cases.length||policy.maximum_failures!==0)throw new Error('INVALID_RELEASE_POLICY');
 if(!Array.isArray(cases)||cases.some(c=>!c||typeof c.id!=='string'||typeof c.passed!=='boolean'))throw new Error('INVALID_EVALUATION_RESULTS');
 const reasons:string[]=[];
 const ids=new Set<string>();
 for(const c of cases){if(ids.has(c.id))reasons.push('DUPLICATE_CASE:'+c.id);ids.add(c.id);if(!policy.required_cases.includes(c.id))reasons.push('UNEXPECTED_CASE:'+c.id);if(!c.passed)reasons.push('FAILED_CASE:'+c.id);}
 for(const id of policy.required_cases)if(!ids.has(id))reasons.push('MISSING_CASE:'+id);
 const body={policy_version:policy.version,policy_hash:contentHash(policy),cases:[...cases].sort((a,b)=>a.id.localeCompare(b.id)),approved:reasons.length===0,reasons:reasons.sort()};
 return {...body,hash:contentHash(body)};
}
