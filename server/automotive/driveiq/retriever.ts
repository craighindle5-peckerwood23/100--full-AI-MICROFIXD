import type { Vehicle, Knowledge } from '../schemas';
const same=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
/** Unknown applicability never becomes a match. Semantic rank cannot override fitment. */
export function applicable(k:Knowledge,v:Vehicle):boolean {
  return same(k.make,v.make)&&same(k.model,v.model)&&same(k.engine,v.engine)&&v.year>=k.yearFrom&&v.year<=k.yearTo;
}
export function retrieve(records:Knowledge[],v:Vehicle,dtcs:string[],complaint:string):Knowledge[] {
  return records.filter(k=>applicable(k,v)&&(k.dtcs.some(c=>dtcs.includes(c))||k.symptoms.some(s=>complaint.toLowerCase().includes(s.toLowerCase()))));
}
