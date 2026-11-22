import {MetacognitiveIntervention} from './supervisor';
export interface Ballot {tenant_id:string;mission_id:string;candidate_hash:string;voter_id:string;decision:'accept'|'reject'|'abstain';reason:string}
export function peerVerdict(scope:{tenant_id:string;mission_id:string;candidate_hash:string},electorate:string[],ballots:Ballot[],policyAllowed:boolean){
  if(electorate.length<3||electorate.length>7||new Set(electorate).size!==electorate.length)throw new Error('INVALID_ELECTORATE');
  if(ballots.some(b=>b.tenant_id!==scope.tenant_id||b.mission_id!==scope.mission_id||b.candidate_hash!==scope.candidate_hash||!electorate.includes(b.voter_id)||!['accept','reject','abstain'].includes(b.decision)||!b.reason.trim())||new Set(ballots.map(b=>b.voter_id)).size!==ballots.length)throw new Error('INVALID_BALLOT');
  const required=Math.floor(electorate.length/2)+1,accepted=ballots.filter(b=>b.decision==='accept').length;
  return {accepted:policyAllowed&&accepted>=required,required,accept_votes:accepted,reject_votes:ballots.filter(b=>b.decision==='reject').length,missing_or_abstained:electorate.length-ballots.filter(b=>b.decision!=='abstain').length,policy_veto:!policyAllowed,scope};
}
export interface Peer {id:string;tools:readonly string[]}
export function compatiblePeers(assigned:string,requiredTools:readonly string[],peers:readonly Peer[]):Peer[]{
  return peers.filter(peer=>peer.id!==assigned&&requiredTools.every(tool=>peer.tools.includes(tool))).sort((a,b)=>a.tools.length-b.tools.length||a.id.localeCompare(b.id));
}
export async function withPeerFailover<T>(assigned:string,requiredTools:readonly string[],peers:readonly Peer[],
  execute:(id:string)=>Promise<T>,authorize:()=>Promise<void>,record:(from:string,to:string)=>Promise<void>):Promise<{value:T;agent_id:string;failover:boolean}>{
  try{return {value:await execute(assigned),agent_id:assigned,failover:false};}catch(error){
    // Only a provider failure known to precede effect/commit is eligible. Never retry a tool or a persistence failure here.
    const code=(error as {code?:string})?.code,status=Number((error as {status?:number})?.status);
    if(error instanceof MetacognitiveIntervention||!(code==='PROVIDERS_EXHAUSTED'||code==='AGENT_WATCHDOG_TIMEOUT'||[429,500,502,503,504].includes(status)))throw error;
    const peer=compatiblePeers(assigned,requiredTools,peers)[0];if(!peer)throw error;
    await authorize();await record(assigned,peer.id);
    return {value:await execute(peer.id),agent_id:peer.id,failover:true};
  }
}
