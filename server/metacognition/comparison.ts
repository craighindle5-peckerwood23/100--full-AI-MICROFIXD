export interface Criterion {id:string; perspective:'human'|'analytical'|'safety'|'reliability'|'development';weight:number}
export interface Check {criterion_id:string;status:'passed'|'failed'|'unknown';evidence_ids:string[]}
export interface Option {id:string;description:string;checks:Check[];risks:string[]}
export interface Evidence {id:string;option_id:string;criterion_id:string;status:'passed'|'failed';source:'test'|'measurement'|'policy_validator'}

/** Only server-provided evidence can substantiate a percentage. Claims remain unknown. */
export function compareOptions(criteria:Criterion[],options:Option[],trustedEvidence:Evidence[]=[]){
  if(!Array.isArray(criteria)||!Array.isArray(options)||!criteria.length||criteria.length>24||!options.length||options.length>8
    ||criteria.some(c=>!c)||options.some(o=>!o)
    ||new Set(criteria.map(c=>c.id)).size!==criteria.length||new Set(options.map(o=>o.id)).size!==options.length
    ||criteria.some(c=>!c.id||!Number.isFinite(c.weight)||c.weight<=0||!['human','analytical','safety','reliability','development'].includes(c.perspective)))throw new Error('INVALID_COMPARISON');
  const total=criteria.reduce((n,c)=>n+c.weight,0),evidence=new Map(trustedEvidence.map(e=>[e.id,e]));
  if (!Number.isFinite(total)) throw new Error('INVALID_COMPARISON');
  const assessed=options.map(option=>{
    if(!option.id||!option.description||!Array.isArray(option.checks)||!Array.isArray(option.risks)||option.checks.some(c=>!c || !['passed','failed','unknown'].includes(c.status) || !Array.isArray(c.evidence_ids) || c.evidence_ids.some(id=>typeof id !== 'string') || !criteria.some(v=>v.id===c.criterion_id))||new Set(option.checks.map(c=>c.criterion_id)).size!==option.checks.length)throw new Error('INVALID_OPTION');
    let passed=0,failed=0;
    const checks=criteria.map(c=>{
      const claim=option.checks.find(v=>v.criterion_id===c.id);
      const proof=claim?.evidence_ids.map(id=>evidence.get(id)).filter(e=>e&&e.criterion_id===c.id&&e.option_id===option.id)??[];
      const contradictory=proof.some(e=>e!.status==='passed')&&proof.some(e=>e!.status==='failed');
      const status=contradictory?'unknown':proof.some(e=>e!.status==='failed')?'failed':proof.some(e=>e!.status==='passed')?'passed':'unknown';
      if(status==='passed')passed+=c.weight;if(status==='failed')failed+=c.weight;
      return {criterion_id:c.id,perspective:c.perspective,status,contradictory,evidence_ids:proof.map(e=>e!.id)};
    });
    const pct=(v:number)=>Math.round(v/total*10000)/100;
    return {id:option.id,description:option.description,checks,risks:option.risks,
      measured_quality_percent:checks.every(check=>check.status!=='unknown')?pct(passed):null,
      quality_bounds_percent:{lower:pct(passed),upper:pct(total-failed)},
      evidence_coverage_percent:pct(passed+failed),
      blocking_failure:checks.some(c=>c.perspective==='safety'&&c.status==='failed')};
  });
  const eligible=assessed.filter(o=>!o.blocking_failure&&o.measured_quality_percent!==null).sort((a,b)=>b.quality_bounds_percent.lower-a.quality_bounds_percent.lower);
  const selected=eligible.length&&(eligible.length===1||eligible[0].quality_bounds_percent.lower>eligible[1].quality_bounds_percent.upper)?eligible[0].id:null;
  return {method:'evidence_weighted_criteria_v1',exhaustive:false,calibrated_probability:false,criteria,options:assessed,
    selected_option:selected,requires_more_evidence:selected===null,
    perspective_note:'Human and analytical perspectives both carry assumptions; neither is inherently unbiased.'};
}
