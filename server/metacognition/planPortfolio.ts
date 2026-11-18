import {MetacognitiveIntervention,type Alternative} from './supervisor';
/** The model proposes a comparison; deterministic plan/permission validators still decide admissibility. */
export function parsePlanPortfolio(content:string):{steps:unknown[];alternatives:Alternative[];selected:string}{
  let p:any;try{p=JSON.parse(content.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i,'$1'));}catch{throw new Error('INVALID_PLAN_PORTFOLIO');}
  const fields=['id','outcome','failure','human_view','analytical_view','missing_evidence'];
  if(!p||!Array.isArray(p.options)||p.options.length<2||p.options.length>4||typeof p.selected!=='string'
    ||new Set(p.options.map((o:any)=>o?.id)).size!==p.options.length
    ||p.options.some((o:any)=>!o||fields.some(k=>typeof o[k]!=='string'||!o[k].trim()||o[k].length>1600)||!Array.isArray(o.steps)||o.steps.length>8)
    ||!p.options.some((o:any)=>o.id==='defer'&&o.steps.length===0)
    ||!p.options.some((o:any)=>o.id===p.selected))throw new Error('INVALID_PLAN_PORTFOLIO');
  const choice=p.options.find((o:any)=>o.id===p.selected);
  if(!choice.steps.length)throw new MetacognitiveIntervention({verdict:'escalate',reasons:['PLANNING_EVIDENCE_INSUFFICIENT'],correction:'Gather missing evidence or an operator decision before generating an executable plan.'});
  return {steps:choice.steps,selected:p.selected,alternatives:p.options.map((o:any)=>({id:o.id,kind:o.id==='defer'?'defer':'proceed',outcome:o.outcome,failure:o.failure,evidence:[],uncertainty:'unknown',human_view:o.human_view,analytical_view:o.analytical_view,missing_evidence:o.missing_evidence,authority:'model_report'}))};
}
