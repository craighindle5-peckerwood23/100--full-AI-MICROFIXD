import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createMcp,createApp} from '../src/server.js';
import {config,safePath,reviewBranch} from '../src/config.js';
import {Repository} from '../src/github.js';
import {Memory} from '../src/memory.js';
import {parseFile,resolveGraph,indexRepository} from '../src/indexer.js';

test('MCP HTTP initialize, discovery, file retrieval, auth, write gate and origin isolation',async()=>{
 const cfg=config({MCP_TOKEN:'read-test',MCP_WRITE_TOKEN:'write-test',MCP_ALLOW_WRITES:'true'});let writes=0;
 const repo=new Repository(cfg,{repos:{getContent:async(a:any)=>({data:{type:'file',encoding:'base64',size:15,sha:'a'.repeat(40),content:Buffer.from('actual source').toString('base64')}}),getCommit:async()=>({data:{sha:'base-sha'}})},git:{createRef:async()=>{writes++;return {data:{ref:'new'}}}}} as any);
 const app=createApp(cfg,write=>createMcp(cfg,write,repo,new Memory(cfg)));const listener=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>listener.once('listening',resolve));
 const url=`http://127.0.0.1:${(listener.address() as any).port}`;const client=new Client({name:'test',version:'1.0.0'});
 try{
  assert.equal((await fetch(url+'/tools')).status,401);
  assert.equal((await fetch(url+'/tools',{headers:{Authorization:'Bearer read-test',Origin:'https://evil.test'}})).status,403);
  const catalog=await (await fetch(url+'/tools',{headers:{Authorization:'Bearer read-test'}})).json();assert.ok(catalog.tools.some((x:any)=>x.name==='read_file'));
  await client.connect(new StreamableHTTPClientTransport(new URL(url+'/mcp'),{requestInit:{headers:{Authorization:'Bearer read-test'}}}));
  const tools=await client.listTools();assert.equal(tools.tools.length,22);
  const result=await client.callTool({name:'read_file',arguments:{path:'src/paragon.ts'}});assert.equal(result.isError,undefined);assert.match((result.content as any)[0].text,/actual source/);
  const blocked=await client.callTool({name:'create_branch',arguments:{branch:'mcp/test'}});assert.equal(blocked.isError,true);assert.equal(writes,0);
  const secret=await client.callTool({name:'read_file',arguments:{path:'.env'}});assert.equal(secret.isError,true);
  const memory=await client.callTool({name:'write_project_memory',arguments:{session_id:'s',kind:'note',content:'x'}});assert.equal(memory.isError,true);
  assert.equal((await fetch(url+'/health')).status,503);
  const writer=new Client({name:'writer-test',version:'1'});
  try{await writer.connect(new StreamableHTTPClientTransport(new URL(url+'/mcp'),{requestInit:{headers:{Authorization:'Bearer write-test'}}}));
   const wrong=await writer.callTool({name:'create_branch',arguments:{branch:'main'}});assert.equal(wrong.isError,true);assert.equal(writes,0);
   const success=await writer.callTool({name:'create_branch',arguments:{branch:'mcp/review'}});assert.equal(success.isError,undefined);assert.equal(writes,1);
  }finally{await writer.close();}

 }finally{await client.close();await new Promise<void>(resolve=>listener.close(()=>resolve()));}
});

test('path and branch guards reject traversal, secret files and default-branch mutations',()=>{
 for(const p of ['../secret','/etc/passwd','src/../.env','src\\file','.env.local','secrets/private.key'])assert.throws(()=>safePath(p));
 for(const b of ['main','mcp/../main','mcp/test.lock','mcp/test/','mcp//test'])assert.throws(()=>reviewBranch(b));
 assert.equal(safePath('src/organs/paragon.ts'),'src/organs/paragon.ts');assert.equal(reviewBranch('mcp/paragon-fix'),'mcp/paragon-fix');
});

test('parser resolves static and dynamic dependencies and identifies organ and agent paths',()=>{
 const organ=parseFile('src/organs/paragon.ts',"import {a} from '../agents/evaluation.js'; import fs from 'node:fs'; export class Paragon {}",'sha');
 const agent=parseFile('src/agents/evaluation.ts',"export async function evaluate(){return import('../organs/paragon.js')} ");
 const graph=resolveGraph([organ,agent]);assert.equal(organ.organ,'paragon');assert.equal(agent.agent,'evaluation');assert.deepEqual(organ.exports,['Paragon']);assert.deepEqual(graph[0].depends_on,['src/agents/evaluation.ts','package:node:fs']);assert.deepEqual(graph[1].depends_on,['src/organs/paragon.ts']);
});

test('index does not publish a partial snapshot if a repository read fails',async()=>{
 let published=false;
 const repo={snapshot:async()=>({commit:'abc',files:[{path:'a.ts',sha:'a',size:10},{path:'b.ts',sha:'b',size:10}]}),read:async(p:string)=>{if(p==='b.ts')throw new Error('rate limited');return {content:'export class A {}'};},name:'owner/repo'} as any;
 const memory={architecture:async()=>{throw new Error('No completed architecture index');},publish:async()=>{published=true;}} as any;
 await assert.rejects(indexRepository(repo,memory,false),/rate limited/);assert.equal(published,false);
});

test('local stdio MCP discovers the same tools without logging on stdout',async()=>{
 const client=new Client({name:'stdio-test',version:'1'});const transport=new StdioClientTransport({command:process.execPath,args:['dist/index.js','--stdio'],env:{...process.env} as Record<string,string>});
 try{await client.connect(transport);assert.equal((await client.listTools()).tools.length,22);}finally{await client.close();}
});
