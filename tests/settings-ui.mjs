import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {existsSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
const app=express();app.use(express.static(resolve('dist')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
let executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if(!executablePath&&process.platform==='linux'&&process.arch==='x64'){
 const require=createRequire(import.meta.url);let directory=dirname(require.resolve('@sparticuz/chromium'));
 while(!existsSync(join(directory,'bin/chromium.br'))){const parent=dirname(directory);if(parent===directory)throw Error('Chromium package missing');directory=parent;}
 executablePath=join(tmpdir(),'microfixd-test-chromium');writeFileSync(executablePath,brotliDecompressSync(readFileSync(join(directory,'bin/chromium.br'))));chmodSync(executablePath,0o755);
}
const browser=await chromium.launch({headless:true,executablePath,chromiumSandbox:process.getuid?.()!==0});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const base=`http://127.0.0.1:${server.address().port}`;let verified=false;
 await page.addInitScript(()=>{localStorage.setItem('microfyxd_voice_enabled','false');localStorage.setItem('microfyxd_sound_muted','true');});
 await page.route('**/*',route=>{
   const request=route.request();const url=new URL(request.url());
   if(url.origin!==base)return route.abort();
   if(url.pathname==='/api/classification/map'){
     verified=request.headers().authorization==='Bearer valid-test-token';return route.fulfill({status:verified?200:403,json:verified?{objects:[]}:{error:'Forbidden'}});
   }
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{success:true,organs:[],logs:[],events:[],entries:[],records:[]}});
   return route.continue();
 });
 await page.goto(base);await page.getByText('Fast Boot (Skip)').click();
 const settings=page.getByRole('button',{name:'Settings',exact:true});await settings.click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 assert.equal(await dialog.getByRole('tab').count(),8);
 await dialog.getByLabel('Admin or operator token').fill('wrong-token');await dialog.getByRole('button',{name:'Verify & connect'}).click();await dialog.getByText('Token not accepted.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('microfixd_operator_token')),null);
 await dialog.getByLabel('Admin or operator token').fill('valid-test-token');await dialog.getByRole('button',{name:'Verify & connect'}).click();await dialog.getByText('Connected. Protected controls',{exact:false}).waitFor();assert.equal(verified,true);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('microfixd_operator_token')),'valid-test-token');
 await dialog.getByRole('tab',{name:'Engines & Router'}).click();await dialog.getByLabel('Recent records').selectOption('50');await dialog.getByRole('button',{name:'Save retrieval preferences'}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('microfixd_command_preferences')).retrieval.limit),50);
 for(const name of ['Autonomy','Voice','Connections','Mission Control','Telemetry','Tools & Safety'])await dialog.getByRole('tab',{name,exact:true}).click();
 await dialog.getByRole('tab',{name:'General',exact:true}).click();await page.screenshot({path:'/tmp/microfixd-settings-desktop.png'});
 await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await settings.evaluate(e=>e===document.activeElement),true);
 await page.setViewportSize({width:390,height:844});await settings.click();await dialog.getByRole('tab',{name:'Voice',exact:true}).click();
 assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);await page.screenshot({path:'/tmp/microfixd-settings-mobile.png'});
 await dialog.getByRole('tab',{name:'Mission Control',exact:true}).click();await dialog.getByRole('button',{name:/Mission Control Review goals/}).click();assert.equal(await dialog.count(),0);
 console.log('Settings UI passed: desktop/mobile, tabs, token verification, persistence, focus, Escape, and management navigation.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
