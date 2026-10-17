import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {existsSync,readFileSync,writeFileSync,chmodSync,mkdirSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const app=express();app.use(express.static(resolve('dist')));app.get('/saas',(_req,res)=>res.sendFile(resolve('dist/index.html')));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
let executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if(!executablePath&&process.platform==='linux'&&process.arch==='x64'){
 const require=createRequire(import.meta.url);let directory=dirname(require.resolve('@sparticuz/chromium'));
 while(!existsSync(join(directory,'bin/chromium.br')))directory=dirname(directory);
 executablePath=join(tmpdir(),'microfixd-hio-chromium');
 writeFileSync(executablePath,brotliDecompressSync(readFileSync(join(directory,'bin/chromium.br'))));chmodSync(executablePath,0o755);
 const shaderTar=join(tmpdir(),'microfixd-hio-swiftshader.tar');writeFileSync(shaderTar,brotliDecompressSync(readFileSync(join(directory,'bin/swiftshader.tar.br'))));execFileSync('tar',['-xf',shaderTar,'-C',tmpdir()]);
}
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const evidence=process.env.HIO_EVIDENCE_DIR||join(tmpdir(),'microfixd-hio-evidence');mkdirSync(evidence,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1536,height:960}}),base=`http://127.0.0.1:${server.address().port}`,graphicsErrors=[];
 page.on('pageerror',e=>console.log('PAGE ERROR',String(e)));
 page.on('console',msg=>{if(/THREE.*(Error|VALIDATE_STATUS)|shader.*error/i.test(msg.text()))graphicsErrors.push(msg.text());});
 await page.addInitScript(()=>{localStorage.setItem('microfyxd_voice_enabled','false');localStorage.setItem('microfyxd_sound_muted','true');});
 let attempts=0, missionAttempts=0, approved=false;
 const mission={mission_id:'browser-fixture',objective:'Read authorized public page',status:'waiting',created_at:new Date().toISOString()};
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
  if(u.pathname==='/api/health')return route.fulfill({json:{status:'ok',services:['command','organs','security','execution','hitl']}});
  if(u.pathname==='/readyz')return route.fulfill({json:{status:'degraded',storage:{durable:false}}});
  if(u.pathname==='/api/planner/tools')return route.fulfill({json:{tools:[{name:'read_public_page',description:'Read public pages'}]}});
  if(u.pathname==='/api/planner/missions'){
   if(route.request().method()==='POST'){
    assert.equal(route.request().headers().authorization,'Bearer hio-ui-test-token');
    assert.ok(route.request().headers()['idempotency-key']);
    assert.deepEqual(route.request().postDataJSON().tool_permissions,['read_public_page']);
    missionAttempts++;return route.fulfill({status:202,json:mission});
   }
   return route.fulfill({json:{missions:[{...mission,status:approved?'succeeded':'waiting'}]}});
  }
  if(u.pathname.endsWith('/approvals/sub/decide')){assert.equal(route.request().postDataJSON().decision,'approved');approved=true;return route.fulfill({json:{success:true}});}
  if(u.pathname==='/api/planner/missions/browser-fixture')return route.fulfill({json:{mission:{...mission,status:approved?'succeeded':'waiting',result_artifact_id:approved?'result':null},tasks:[],artifacts:approved?[{artifact_id:'result',content:'Verified mission fixture result.'}]:[],approvals:approved?[]:[{status:'pending',subtask_id:'sub',request_hash:'hash',expires_at:new Date(Date.now()+60000).toISOString(),request:{name:'read_public_page',arguments:{url:'https://example.com'}}}],tool_runs:[],messages:[],errors:[],budget:null}});
  if(u.pathname==='/api/command/run'){
   assert.equal(route.request().headers().authorization,'Bearer hio-ui-test-token');assert.equal(route.request().postDataJSON().task,'Inspect HIO integration');attempts++;return route.fulfill({json:{success:true,output:'HIO fixture command completed.'}});
  }
  if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Backend not connected in this browser test'}});
  return route.continue();
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Fast Boot'}).click({timeout:10000}).catch(async()=>{console.log('INITIAL BODY',(await page.locator('body').innerText()).slice(0,600));});
 await page.waitForFunction(()=>document.querySelector('.hio-top')?.textContent?.includes('ONLINE'),{},{timeout:30000});
 assert.equal(await page.locator('canvas').count(),1);await page.screenshot({path:join(evidence,'Microfixd-HIO-Desktop.png')});
 await page.getByRole('button',{name:'minimal',exact:true}).click();assert.equal(await page.getByRole('button',{name:'minimal',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Pause avatar',exact:true}).click();assert.equal(await page.locator('canvas').count(),0);
 await page.locator('.hio-avatar-off').getByRole('button',{name:'Enable avatar'}).click();await page.waitForFunction(()=>document.querySelectorAll('canvas').length===1);
 await page.evaluate(()=>sessionStorage.setItem('microfixd_operator_token','hio-ui-test-token'));
 await page.getByLabel('Command mode').selectOption('chat');
 await page.getByRole('textbox',{name:'Microfixd command'}).fill('Inspect HIO integration');await page.getByRole('button',{name:'Send command'}).click();
 await page.getByText('HIO fixture command completed.',{exact:true}).waitFor();assert.equal(attempts,1);
 await page.getByLabel('Command mode').selectOption('mission');
 await page.getByText('Authorized tool scope (1 tools)',{exact:true}).click();
 await page.getByRole('checkbox',{name:'read_public_page'}).check();
 await page.getByRole('textbox',{name:'Microfixd command'}).fill('Read authorized public page');
 await page.getByRole('button',{name:'Send command'}).click();
 await page.getByText('Waiting for approval. Open this mission to review the exact action.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Open mission • waiting',exact:true}).click();
 await page.getByRole('button',{name:'Approve action',exact:true}).click();
 await page.getByRole('button',{name:'Hologram',exact:true}).click();
 await page.getByText('Verified mission fixture result.',{exact:true}).waitFor();
 assert.equal(missionAttempts,1);assert.equal(attempts,1);assert.equal(approved,true);
 await page.getByRole('button',{name:'Open Microfixd settings'}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(evidence,'Microfixd-HIO-Mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1536,height:960});await page.getByRole('button',{name:'Replay boot sequence'}).click();
 const titles=[];for(const title of ['BOOT SEQUENCE','EMERGENCE','AWARENESS','GREETING','INTERACTION','FULL INTERFACE']){
  await page.getByRole('heading',{name:title,exact:true}).waitFor({timeout:20000});titles.push(title);
  if(title==='AWARENESS')await page.screenshot({path:join(evidence,'Microfixd-HIO-Boot.png')});
 }
 await page.locator('.hio-cockpit').waitFor({timeout:20000});assert.equal(await page.locator('canvas').count(),1);assert.deepEqual(graphicsErrors,[]);
 await page.goto(base+'/saas');
 await page.getByRole('heading',{name:/Give your work/}).waitFor();
 await page.getByLabel('Preview brand name').fill('Craig AI');
 assert.ok((await page.locator('.saas-brand-preview').innerText()).includes('Craig AI'));
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log(JSON.stringify({landingPage:true,passed:true,bootStages:titles,commandAttempts:attempts,missionAttempts,approvalFlow:approved,graphicsErrors,evidence},null,2));
}finally{await browser.close();server.close();}
