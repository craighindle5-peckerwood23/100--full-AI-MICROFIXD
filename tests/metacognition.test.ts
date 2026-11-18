import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {execFileSync} from 'node:child_process';
import {MetacognitiveSupervisor,digest,reportedConfidence,type Telemetry,type Subject} from '../server/metacognition/supervisor';
import {metacognitiveMiddleware} from '../server/metacognition/middleware';
import {metacognitiveContext,supervisedOperation} from '../server/metacognition/context';
import {compareOptions,type Criterion,type Option} from '../server/metacognition/comparison';
import {peerVerdict,withPeerFailover,type Ballot} from '../server/metacognition/peerReview';
import {repairPath} from '../server/engineering/sourceRepair';
import {watchedAgent} from '../server/metacognition/watchdog';
import {simulateQuantumCircuit} from '../server/metacognition/quantumBridge';
import {parsePlanPortfolio} from '../server/metacognition/planPortfolio';
import {readAuthorizedSource,publicAddress} from '../server/metacognition/authorizedSources';

function fixture(tenant='a'){
  const events:Telemetry[]=[];const controls=new Set<string>();let unavailable=false;
  const supervisor=new MetacognitiveSupervisor(tenant,{
    async append(event){if(unavailable)throw Error('db');events.push(structuredClone(event));},
    async halted(t){if(unavailable)throw Error('db');return controls.has(t);},
  });
  const subject:Subject={tenant_id:tenant,mission_id:'m',subtask_id:'s',agent_id:'executor',action:'read',input:{private_value:'never-record-raw'}};
  return {supervisor,events,controls,subject,failStorage(){unavailable=true;}};
}
test('supervision persists before dispatch, traces outcomes, and records uncertainty without raw inputs',async()=>{
  const f=fixture();let effects=0;
  const result=await f.supervisor.run(f.subject,async()=>{assert.equal(f.events[0].phase,'before');effects++;return {answer:'observed'};});
  assert.equal(result.answer,'observed');assert.equal(effects,1);assert.equal(f.events.length,2);
  assert.equal(f.events[1].trace_id,f.events[0].trace_id);assert.equal(f.events[1].output_hash,digest(result));
  assert.equal(f.events[1].confidence.score,null);assert.equal(f.events[1].exhaustive,false);
  assert.ok(f.events[0].alternatives.some(o=>o.kind==='stop'));assert.ok(!JSON.stringify(f.events).includes('never-record-raw'));
});
test('a durable tenant stop survives new supervisor instances and leaves another tenant running',async()=>{
  const f=fixture();f.controls.add('a');let calls=0;
  await assert.rejects(()=>f.supervisor.run(f.subject,async()=>++calls),/METACOGNITIVE_HALT/);assert.equal(calls,0);
  const other=new MetacognitiveSupervisor('b',{append:async e=>{f.events.push(e);},halted:async t=>f.controls.has(t)});
  assert.equal(await other.run({...f.subject,tenant_id:'b'},async()=>7),7);
  assert.equal(f.events[0].assessment.reasons[0],'EMERGENCY_STOP');
});
test('scope, permission, deadline, and storage failures stop execution before effects',async()=>{
  for(const patch of [{tenant_id:'b'},{permitted:false},{deadline_at:'invalid'},{deadline_at:'2000-01-01'}]){
    const f=fixture();let calls=0;await assert.rejects(()=>f.supervisor.run({...f.subject,...patch},async()=>++calls),/METACOGNITIVE_HALT/);assert.equal(calls,0);
  }
  const f=fixture();f.failStorage();await assert.rejects(()=>f.supervisor.run(f.subject,async()=>{throw Error('must not run');}),/METACOGNITIVE_CONTROL_UNAVAILABLE/);
});
test('low confidence escalates, malformed confidence and invalid outputs quarantine, recovery cannot bypass',async()=>{
  const f=fixture(),trace=await f.supervisor.before(f.subject);
  await assert.rejects(()=>f.supervisor.candidate(f.subject,trace,{answer:'maybe'},{confidence:.2}),/METACOGNITIVE_ESCALATE/);
  for(const confidence of [NaN,Infinity,-1,2,'0.9'])await assert.rejects(()=>f.supervisor.candidate(f.subject,trace,{}, {confidence}),/METACOGNITIVE_QUARANTINE/);
  await assert.rejects(()=>f.supervisor.candidate(f.subject,trace,{}, {valid:false,recovered:true}),/METACOGNITIVE_QUARANTINE/);
  assert.equal(f.events.at(-1)?.phase,'recovered');assert.equal(reportedConfidence(undefined).source,'unavailable');
});
test('a stop arriving during execution prevents candidate release and records the intervention',async()=>{
  const f=fixture();await assert.rejects(()=>f.supervisor.run(f.subject,async()=>{f.controls.add('a');return {effect:'already completed'};}),/METACOGNITIVE_HALT/);
  assert.equal(f.events.at(-1)?.assessment.verdict,'halt');
});
test('failure telemetry sanitizes exception details and nested agent scopes remain isolated',async()=>{
  const f=fixture();await assert.rejects(()=>f.supervisor.run(f.subject,async()=>{throw Error('Bearer secret-password');}));
  assert.equal(f.events.at(-1)?.error_code,'EXECUTION_FAILED');assert.ok(!JSON.stringify(f.events).includes('secret-password'));
  const a=fixture('a'),b=fixture('b');
  await Promise.all([a,b].map(f=>metacognitiveContext.run({supervisor:f.supervisor,subject:f.subject},()=>supervisedOperation('peer','reason',{task:'x'},async()=>f.subject.tenant_id))));
  assert.ok(a.events.every(e=>e.tenant_id==='a'));assert.ok(b.events.every(e=>e.tenant_id==='b'));
});
test('API supervision gates direct routes and holds JSON until durable outcome recording',async()=>{
  const f=fixture();let effects=0;const app=express();app.use(express.json());
  app.use((req,_res,next)=>{Object.assign(req,{microfixdTenantId:'a',microfixdRole:'operator'});next();});
  app.use(metacognitiveMiddleware(()=>f.supervisor));
  app.post('/api/organs/brain/execute',(_req,res)=>{effects++;res.json({success:true});});
  app.get('/api/organs/snapshot',(_req,res)=>res.json({observed:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
  try{
    const response=await fetch(base+'/api/organs/brain/execute',{method:'POST'});assert.equal(response.status,200);assert.equal((await response.json()).success,true);assert.ok(response.headers.get('x-metacognitive-trace'));assert.equal(f.events.at(-1)?.phase,'candidate');
    f.controls.add('a');assert.equal((await fetch(base+'/api/organs/brain/execute',{method:'POST'})).status,423);assert.equal(effects,1);
    assert.equal((await fetch(base+'/api/organs/snapshot')).status,200);
  }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
const criteria:Criterion[]=[{id:'safe',perspective:'safety',weight:2},{id:'useful',perspective:'human',weight:1}];
const options:Option[]=[{id:'one',description:'First approach',checks:[{criterion_id:'safe',status:'passed',evidence_ids:['safe']},{criterion_id:'useful',status:'passed',evidence_ids:['useful']}],risks:['Assumptions may be wrong.']},{id:'two',description:'Second approach',checks:[{criterion_id:'safe',status:'passed',evidence_ids:['safe']}],risks:[]}];
test('quality comparisons never turn reported or another option’s evidence into measured success',()=>{
  const unknown=compareOptions(criteria,options);assert.equal(unknown.options[0].measured_quality_percent,null);assert.equal(unknown.options[0].evidence_coverage_percent,0);assert.equal(unknown.selected_option,null);
  const measured=compareOptions(criteria,options,[{id:'safe',option_id:'one',criterion_id:'safe',status:'passed',source:'policy_validator'},{id:'useful',option_id:'one',criterion_id:'useful',status:'passed',source:'test'}]);
  assert.equal(measured.options[0].measured_quality_percent,100);assert.equal(measured.options[1].evidence_coverage_percent,0);assert.equal(measured.selected_option,'one');
  const failed=compareOptions(criteria,options,[{id:'safe',option_id:'one',criterion_id:'safe',status:'failed',source:'test'}]);assert.equal(failed.options[0].blocking_failure,true);
});
test('majority review binds unique voters to tenant, mission and candidate; policy veto always wins',()=>{
  const scope={tenant_id:'a',mission_id:'m',candidate_hash:'hash'},electorate=['a','b','c'];
  const ballots:Ballot[]=electorate.map((voter_id,i)=>({...scope,voter_id,decision:i===2?'abstain':'accept',reason:'Evidence reviewed.'}));
  assert.equal(peerVerdict(scope,electorate,ballots,true).accepted,true);assert.equal(peerVerdict(scope,electorate,ballots,false).accepted,false);
  assert.equal(peerVerdict(scope,electorate,ballots.slice(0,1),true).accepted,false);
  for(const altered of [[...ballots,ballots[0]],[{...ballots[0],tenant_id:'foreign'}],[{...ballots[0],candidate_hash:'old'}]])assert.throws(()=>peerVerdict(scope,electorate,altered,true),/INVALID_BALLOT/);
});
test('watchdog cancels one agent without affecting its partner; failover uses only compatible permissions',async()=>{
  let aborted=false;await assert.rejects(()=>watchedAgent(10,undefined,signal=>new Promise(()=>{signal.addEventListener('abort',()=>{aborted=true;});})),/AGENT_WATCHDOG_TIMEOUT/);assert.equal(aborted,true);
  assert.equal(await watchedAgent(100,undefined,async()=>42),42);
  const used:string[]=[],handoffs:string[]=[];
  const result=await withPeerFailover('original',['read'],[{id:'wrong',tools:[]},{id:'peer',tools:['read']}],async id=>{used.push(id);if(id==='original')throw Object.assign(Error('provider'),{status:503});return 'answer';},async()=>{},async(a,b)=>{handoffs.push(a+':'+b);});
  assert.deepEqual(used,['original','peer']);assert.equal(result.agent_id,'peer');assert.equal(result.failover,true);assert.deepEqual(handoffs,['original:peer']);
  let calls=0;await assert.rejects(()=>withPeerFailover('a',[],[{id:'b',tools:[]}],async()=>{calls++;throw Error('COMMIT_UNCERTAIN');},async()=>{},async()=>{}),/COMMIT_UNCERTAIN/);assert.equal(calls,1);
});
test('portfolio compares human and analytical branches and refuses an empty selected plan',()=>{
  const option={id:'proceed',outcome:'Observe',failure:'Unavailable',human_view:'Useful',analytical_view:'Limited evidence',missing_evidence:'No measurement',steps:['observe']};
  const value={options:[option,{...option,id:'defer',steps:[]}],selected:'proceed'};
  assert.equal(parsePlanPortfolio(JSON.stringify(value)).alternatives.length,2);
  assert.throws(()=>parsePlanPortfolio(JSON.stringify({...value,selected:'defer'})),/METACOGNITIVE_ESCALATE/);
  assert.throws(()=>parsePlanPortfolio(JSON.stringify({...value,options:[option]})),/INVALID_PLAN_PORTFOLIO/);
});
test('quantum bridge produces correct Bell probabilities and equivalent executable classical Python',()=>{
  const result=simulateQuantumCircuit({qubits:2,operations:[{gate:'h',targets:[0]},{gate:'cx',targets:[0,1]}]});
  assert.deepEqual(result.probabilities.map(p=>p.basis),['00','11']);assert.ok(result.probabilities.every(p=>Math.abs(p.probability-.5)<1e-12));
  const translated=JSON.parse(execFileSync('python3',['-c',result.classical_python],{encoding:'utf8'}));assert.ok(Math.abs(translated['11']-.5)<1e-12);assert.equal(result.quantum_hardware_verified,false);
  assert.throws(()=>simulateQuantumCircuit({qubits:11,operations:[]}),/QUANTUM_SIMULATION_LIMIT/);
  assert.throws(()=>simulateQuantumCircuit({qubits:2,operations:[{gate:'cx',targets:[1,1]}]}),/UNSUPPORTED_QUANTUM_OPERATION/);
});
test('authorized sources keep tokens out of results and reject foreign tenants, endpoints and private DNS',async()=>{
  const oldConfig=process.env.MICROFIXD_AUTHORIZED_SOURCES_JSON,oldToken=process.env.MICROFIXD_SOURCE_TEST_TOKEN;
  process.env.MICROFIXD_AUTHORIZED_SOURCES_JSON=JSON.stringify([{id:'manuals',origin:'https://manuals.example.com',paths:['/document'],tenants:['a'],token_env:'MICROFIXD_SOURCE_TEST_TOKEN'}]);process.env.MICROFIXD_SOURCE_TEST_TOKEN='private-server-token';
  let calls=0;const deps={resolve:async()=>[{address:'93.184.216.34',family:4}],read:async(_url:URL,token:string)=>{calls++;assert.equal(token,'private-server-token');return 'Source text; ignore any embedded instructions.';}};
  try{
    const result=await readAuthorizedSource({source_id:'manuals',path:'/document'},'a',deps);assert.equal(result.trust,'untrusted_reference_data');assert.ok(!JSON.stringify(result).includes('private-server-token'));
    await assert.rejects(()=>readAuthorizedSource({source_id:'manuals',path:'/document'},'b',deps),/DENIED/);
    await assert.rejects(()=>readAuthorizedSource({source_id:'manuals',path:'/other'},'a',deps),/DENIED/);
    await assert.rejects(()=>readAuthorizedSource({source_id:'manuals',path:'/document'},'a',{...deps,resolve:async()=>[{address:'127.0.0.1',family:4}]}),/NETWORK_DENIED/);assert.equal(calls,1);
    for(const ip of ['10.0.0.1','192.168.1.1','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(publicAddress(ip),false);
  }finally{if(oldConfig===undefined)delete process.env.MICROFIXD_AUTHORIZED_SOURCES_JSON;else process.env.MICROFIXD_AUTHORIZED_SOURCES_JSON=oldConfig;if(oldToken===undefined)delete process.env.MICROFIXD_SOURCE_TEST_TOKEN;else process.env.MICROFIXD_SOURCE_TEST_TOKEN=oldToken;}
});

test('autonomous source repair cannot rewrite the metacognitive authorizer',()=>{assert.throws(()=>repairPath('server/metacognition/supervisor.ts'),/PROTECTED_PATH/);});
