import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {contentHash, executionIdentity, type Artifact} from '../server/planner/executionSpine';
import {artifactPreview,readMissionArtifact,searchMissionHistory,saveMissionNote,loadMissionNotes} from '../server/planner/taskContinuity';

function fixture() {
  const rows:any[]=[];let fail=false,lease=true;
  const includes=(left:any,right:any):boolean=>right&&typeof right==='object'
    ? Object.entries(right).every(([key,value])=>includes(left?.[key],value)) : left===right;
  const fetcher=async(input:any,init:any)=>{
    const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url);
    if(fail)return Response.json({code:'42501'}, {status:403});
    if(url.pathname.endsWith('/rpc/spine_commit')){
      const p=await request.json();
      assert.equal(p.p_tenant,'tenant');assert.equal(p.p_mission,'mission');assert.equal(p.p_owner,'owner');
      if(!lease)return Response.json({code:'P0001',message:'LEASE_LOST'},{status:400});
      for(const op of p.p_operations)if(!rows.some(row=>row.id===op.id))rows.push({id:op.id,tenant_id:p.p_tenant,mission_id:p.p_mission,kind:op.kind,data:op.data,sequence:rows.length});
      return Response.json(null);
    }
    assert.ok(url.pathname.endsWith('/spine_rows'));
    let selected=rows.filter(row=>[...url.searchParams].every(([key,value])=>
      value.startsWith('eq.')?String(row[key])===value.slice(3):value.startsWith('cs.')?includes(row[key],JSON.parse(value.slice(3))):true));
    if(url.searchParams.get('order')?.includes('desc'))selected=selected.slice().reverse();
    selected=selected.slice(0,Number(url.searchParams.get('limit'))||selected.length);
    return Response.json(request.headers.get('accept')?.includes('vnd.pgrst.object')?selected[0]??null:selected);
  };
  const db=createClient('https://continuity-test.supabase.co','server-only-test',{global:{fetch:fetcher},auth:{persistSession:false}});
  function artifact(id:string,content:any,tenant='tenant',mission='mission'){
    const a:Artifact={artifact_id:id,tenant_id:tenant,mission_id:mission,task_id:'task',subtask_id:'sub',type:'json',content,evidence:{},hash:contentHash(content)};
    rows.push({id,tenant_id:tenant,mission_id:mission,kind:'artifacts',data:a,sequence:rows.length});return a;
  }
  const context:any={tenant_id:'tenant',mission_id:'mission',subtask_id:'note-sub'};
  return {db,rows,artifact,context,setFail(v:boolean){fail=v;},loseLease(){lease=false;}};
}

test('paged evidence reconstructs an entire large Unicode result without lost or split characters',async()=>{
  const f=fixture(),a=f.artifact('large',{text:'🚗漢字'.repeat(2400)+'FINAL_CONFIRMED_VALUE'});
  let offset=0,reconstructed='',pages=0;
  while(true){const page=await readMissionArtifact(f.db,'tenant','mission',{artifact_id:a.artifact_id,offset,limit:997});
    assert.equal(page.hash,a.hash);assert.ok(Array.from(page.text).length<=997);assert.equal(page.source_complete,true);
    reconstructed+=page.text;pages++;if(page.next_offset===null)break;offset=page.next_offset;
  }
  assert.ok(pages>4);assert.equal(reconstructed,JSON.stringify(a.content));
  const preview=artifactPreview(a,1800);assert.equal(preview.truncated,true);assert.equal(preview.next_offset,1800);assert.equal(preview.read_tool,'read_mission_artifact');
});
test('history search links matching excerpts to exact readable offsets and excludes other scopes',async()=>{
  const f=fixture();f.artifact('owned',{text:'🚗'.repeat(250)+'TARGET diagnostic evidence'+'z'.repeat(800)});
  f.artifact('other-tenant',{text:'TARGET secret'},'other');f.artifact('other-mission',{text:'TARGET other'},'tenant','other');
  const result=await searchMissionHistory(f.db,'tenant','mission',{query:'TARGET'});
  assert.equal(result.results.length,1);const hit=result.results[0];assert.equal(hit.artifact_id,'owned');
  const original=await readMissionArtifact(f.db,'tenant','mission',{artifact_id:hit.artifact_id,offset:hit.excerpt_start,limit:hit.excerpt_end-hit.excerpt_start});
  assert.equal(original.text,hit.excerpt);assert.ok(hit.excerpt.includes('TARGET'));
  await assert.rejects(()=>readMissionArtifact(f.db,'other','mission',{artifact_id:'owned'}),/ARTIFACT_NOT_FOUND/);
});
test('tampered evidence and invalid page requests fail closed',async()=>{
  const f=fixture(),a=f.artifact('a',{text:'verified'});a.content={text:'tampered'};
  await assert.rejects(()=>readMissionArtifact(f.db,'tenant','mission',{artifact_id:'a'}),/INVALID_ARTIFACT_EVIDENCE/);
  for(const args of [{offset:-1},{offset:0.5},{limit:4001},{limit:0}])await assert.rejects(()=>readMissionArtifact(f.db,'tenant','mission',{artifact_id:'a',...args}),/INVALID_ARTIFACT_PAGE/);
  await assert.rejects(()=>searchMissionHistory(f.db,'tenant','mission',{query:''}),/INVALID_HISTORY_QUERY/);
});
test('notes survive a fresh reader, remain model reports, validate sources and retry idempotently',async()=>{
  const f=fixture();f.artifact('source',{text:'Original evidence'});
  const args={key:'next_step',content:'Inspect the full source before deciding.',source_artifact_ids:'source'};
  await saveMissionNote(f.db,'tenant','mission','owner',args,f.context);
  await saveMissionNote(f.db,'tenant','mission','owner',args,f.context);
  assert.equal(f.rows.filter(row=>row.kind==='messages').length,1);
  const notes=await loadMissionNotes(f.db,'tenant','mission');assert.equal(notes.length,1);assert.equal(notes[0].authority,'model_report');assert.deepEqual(notes[0].source_artifact_ids,['source']);
  assert.deepEqual(await loadMissionNotes(f.db,'other','mission'),[]);
  await assert.rejects(()=>saveMissionNote(f.db,'tenant','mission','owner',{...args,source_artifact_ids:'missing'},{...f.context,subtask_id:'missing'}),/ARTIFACT_NOT_FOUND/);
  await saveMissionNote(f.db,'tenant','mission','owner',{key:'next_step',content:''},{...f.context,subtask_id:'delete'});
  assert.deepEqual(await loadMissionNotes(f.db,'tenant','mission'),[]);
});
test('note capacity, tenant identity, lease loss and database failures cannot produce success',async()=>{
  const f=fixture();
  for(let i=0;i<8;i++)await saveMissionNote(f.db,'tenant','mission','owner',{key:`note_${i}`,content:'State'},{...f.context,subtask_id:`n${i}`});
  await assert.rejects(()=>saveMissionNote(f.db,'tenant','mission','owner',{key:'ninth',content:'State'},f.context),/NOTE_CAPACITY/);
  await assert.rejects(()=>saveMissionNote(f.db,'tenant','mission','owner',{key:'note_0',content:'Changed'},{...f.context,tenant_id:'other'}),/TENANT_MISMATCH/);
  f.loseLease();await assert.rejects(()=>saveMissionNote(f.db,'tenant','mission','owner',{key:'note_0',content:'Changed'},f.context),/CONTINUITY_STORAGE_ERROR/);
  f.setFail(true);await assert.rejects(()=>loadMissionNotes(f.db,'tenant','mission'),/42501/);
});
test('action identities ignore changed narration and argument order while preserving distinct page offsets',()=>{
  const first={tool_request:{name:'read_mission_artifact',arguments:{artifact_id:'source',offset:0}},input:{step:'First narration'}};
  const disguised={tool_request:{arguments:{offset:0,artifact_id:'source'},name:'read_mission_artifact'},input:{step:'Another narration'}};
  assert.equal(executionIdentity(first),executionIdentity(disguised));
  assert.notEqual(executionIdentity(first),executionIdentity({...first,tool_request:{...first.tool_request,arguments:{artifact_id:'source',offset:4000}}}));
});
