import assert from 'node:assert/strict';
import express from 'express';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createOBDRouter} from '../server/automotive/obd/obdRouter.ts';
import {createGovernedTools} from '../server/planner/governedTools.ts';
const records=new Map();
const repo={create:async s=>{records.set(s.id,s);return s;},get:async id=>{const s=records.get(id);if(!s)throw Error('NOT_FOUND');return s;},list:async()=>[...records.values()],save:async(s,previous)=>{assert.equal(records.get(s.id).sequence,previous);records.set(s.id,s);return s;}};
const requests=[];
const replies={ATZ:'ELM327 test fixture',ATE0:'OK',ATL0:'OK',ATS0:'OK',ATH0:'OK',ATSP0:'OK',ATCAF1:'OK',ATDPN:'A6','0100':'410008100000','010C':'410C1AF8','0105':'41057B','03':'43010133','07':'4700','0A':'4A00','0902':'490201'+Buffer.from('WBAWB73519P047240').toString('hex').toUpperCase()};
const adapter=net.createServer(socket=>{let buffer='';socket.on('data',data=>{buffer+=data.toString();while(buffer.includes('\r')){const split=buffer.indexOf('\r'),command=buffer.slice(0,split);buffer=buffer.slice(split+1);requests.push(command);socket.write((replies[command]??'NO DATA')+'\r>');}});});adapter.listen(0,'127.0.0.1');await new Promise(r=>adapter.once('listening',r));
const app=express();app.use(express.json());app.use('/api/automotive/obd',(req,res,next)=>{if(req.header('authorization')!=='Bearer SYNTHETIC-TEST-TOKEN')return res.sendStatus(403);req.microfixdTenantId='test-tenant';req.microfixdRole='operator';next();},createOBDRouter(()=>repo));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{
 const child=spawn('python',[resolve('integrations/obd-bridge/bridge.py'),'--tcp',`127.0.0.1:${adapter.address().port}`,'--server',`http://127.0.0.1:${server.address().port}`,'--once'],{env:{...process.env,MICROFIXD_OBD_TOKEN:'SYNTHETIC-TEST-TOKEN'}});
 let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 const timer=setTimeout(()=>child.kill(),15000);const code=await new Promise((r,j)=>{child.on('error',j);child.on('exit',r);});clearTimeout(timer);
 assert.equal(code,0,output);assert.equal(records.size,1);const session=[...records.values()][0];assert.equal(session.latest.status,'disconnected');
 const receipts=[],finished=[];const client={from:table=>{
   const filters={};const builder={select:()=>builder,eq:(k,v)=>{filters[k]=v;return builder;},maybeSingle:async()=>({data:table==='spine_tool_runs'?null:{data:records.get(filters.id)},error:null}),upsert:async value=>{receipts.push(value);return {error:null};}};return builder;
 },rpc:async(name,args)=>{if(name==='spine_finish_tool')finished.push(args.p_result);return {data:true,error:null};}};
 const tools=createGovernedTools(client,'test-tenant','test-mission','test-worker');
 const context={tenant_id:'test-tenant',mission_id:'test-mission',subtask_id:'test-subtask',idempotency_key:'test-idempotency',tool_permissions:['read_obd_status'],constraints:{}};
 const result=await tools.executeTool({name:'read_obd_status',arguments:{obd_session_id:session.id}},context);
 assert.equal(result.raw.sessions[0].interpreted.vin,'WBAWB73519P047240');assert.equal(result.raw.sessions[0].interpreted.dtcs[0].code,'P0133');
 assert.equal(result.raw.sessions[0].interpreted.readings.find(r=>r.name==='rpm').value,1726);
 assert.equal(result.raw.sessions[0].understanding.engineRunning,null); // Bridge closed: cached RPM is not current running proof.
 assert.equal(receipts[0].status,'approved');assert.equal(receipts[0].decided_by,'read-only-policy');assert.equal(finished.length,1);
 assert.ok(requests.every(c=>Object.hasOwn(replies,c)));assert.ok(!requests.includes('04'));
 console.log('PASS: TCP adapter emulator → actual Python bridge → authenticated Express router → session repository → governed read_obd_status → decoded VIN/DTC/RPM and disconnected state. No physical hardware was used.');
}finally{await new Promise(r=>server.close(r));await new Promise(r=>adapter.close(r));}
