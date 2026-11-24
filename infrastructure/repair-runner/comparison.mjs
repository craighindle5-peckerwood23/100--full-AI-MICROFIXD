// Both runs must execute the same named cases. Missing, skipped or ambiguous
// evidence cannot authorize promotion.
export function compareRuns(baseline,candidate,incident){
  const index=rows=>{
    const result=new Map();
    for(const row of rows){
      if(result.has(row.id)||!['pass','fail'].includes(row.status))throw Error('INVALID_EXPERIMENT_CASE');
      result.set(row.id,row);
    }
    return result;
  };
  const old=index(baseline),next=index(candidate);
  if(!old.size||old.size!==next.size||[...old.keys()].some(k=>!next.has(k)))throw Error('EXPERIMENT_CASES_CHANGED');
  const failed=[...old.values()].filter(r=>r.status==='fail');
  if(!failed.some(r=>r.id===incident || (incident?.kind && r.error?.includes(incident.kind) && incident.paths.some(p=>r.error.includes(p)))))throw Error('ORIGINAL_FAILURE_NOT_REPRODUCED');
  if([...next.values()].some(r=>r.status!=='pass'))throw Error('CANDIDATE_REGRESSION');
  return {cases:old.size,repaired:failed.map(r=>r.id),regressions:0};
}
