import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import serverlessChromium from '@sparticuz/chromium';
const directory=await mkdtemp(join(tmpdir(),'mx-healing-ui-'));
await build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import{SelfHealingPanel}from'./src/components/rooms/SelfHealingPanel';createRoot(document.getElementById('root')).render(<SelfHealingPanel/>);",resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',outfile:join(directory,'app.js')});
await writeFile(join(directory,'index.html'),'<html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
let available=false,submissions=0;const keys=[];
const app=express();app.use(express.json());
app.get('/api/learning/self-healing/status',(req,res)=>{
 assert.equal(req.headers.authorization,'Bearer browser-fixture');
 if(!available)return res.status(503).json({code:'HEALING_STORAGE_UNAVAILABLE'});
 res.json({configured:true,automatic_enabled:true,can_request_repair:true,source:'supabase_controller_ledger',architecture:{repository:'craighindle5-peckerwood23/100--full-AI-MICROFIXD',production_revision:'a'.repeat(40)},repairs:[]});
});
app.post('/api/learning/self-healing/repair',(req,res)=>{
 assert.equal(req.headers.authorization,'Bearer browser-fixture');keys.push(req.headers['idempotency-key']);submissions++;
 assert.deepEqual(req.body.paths,['server/automotive/example.ts']);
 if(submissions===1)return res.status(503).json({code:'PLANNER_STORAGE_UNAVAILABLE'});
 res.status(202).json({mission_id:'browser-repair-fixture'});
});
app.use(express.static(directory));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||await serverlessChromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();await page.addInitScript(()=>sessionStorage.setItem('microfixd_operator_token','browser-fixture'));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('alert').filter({hasText:'HEALING_STORAGE_UNAVAILABLE'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Submit governed repair'}).isDisabled(),true);
 assert.ok(!(await page.locator('body').innerText()).includes('Deployed & Verified'));
 available=true;await page.reload();await page.waitForFunction(()=>!document.querySelector('button[type="submit"]')?.disabled&&document.body.textContent.includes('configured'));
 await page.getByText('Self-healing runs under Microfixd AI.',{exact:false}).waitFor();
 assert.ok((await page.locator('body').innerText()).includes('Production revision: '+'a'.repeat(40)));
 await page.getByLabel('Repair objective').fill('Repair the observed fixture\nRegression case: tests/source-repair.test.ts#fixture');
 await page.getByLabel('Repair source paths').fill('server/automotive/example.ts');
 await page.getByRole('button',{name:'Submit governed repair'}).click();
 await page.getByRole('alert').filter({hasText:'PLANNER_STORAGE_UNAVAILABLE'}).waitFor();
 assert.ok(!(await page.locator('body').innerText()).includes('Recovery recorded and mission completed'));
 await page.getByRole('button',{name:'Submit governed repair'}).click();
 await page.getByRole('status').filter({hasText:'browser-repair-fixture'}).waitFor();
 assert.equal(submissions,2);assert.equal(keys[0],keys[1]);assert.ok(keys[0]);
 console.log('Self-healing browser verification passed: honest outage state, authenticated submission, idempotent retry, queued status.');
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
