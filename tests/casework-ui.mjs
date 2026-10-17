import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:'3107'},stdio:'ignore'});
let browser;
try {
 for(let i=0;i<100;i++){try {const r=await fetch('http://127.0.0.1:3107/api/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({...(process.env.CASE_BROWSER?{executablePath:process.env.CASE_BROWSER}:{}),args:['--no-sandbox','--disable-gpu'],headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('http://127.0.0.1:3107/case-workspace');
 assert.match(response.headers()['cache-control'],/no-store/);
 await page.getByRole('heading',{name:'Correspondence → evidence'}).waitFor();
 await page.getByRole('button',{name:'Try fictional demo'}).click();
 assert.equal(await page.locator('article').count(),2);
 await page.getByRole('button',{name:'Select visible'}).click();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export selected evidence index'}).click();
 const exported=await download;const text=await readFile(await exported.path(),'utf8');assert.match(text,/EX-0001/);assert.match(text,/Fictional demonstration/);
 await page.getByRole('button',{name:'Clear & disconnect'}).click();assert.equal(await page.locator('article').count(),0);
 const original='From: client@example.invalid\r\nTo: firm@example.invalid\r\nDate: Thu, 1 Jan 2026 10:00:00 +0000\r\nSubject: File request\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPlease provide my client file. <script>alert(1)</script>';
 await page.getByLabel('Import email files').setInputFiles({name:'test.eml',mimeType:'message/rfc822',buffer:Buffer.from(original)});
 await page.locator('article').waitFor();assert.equal(await page.locator('article').count(),1);
 await page.getByLabel('Your note (unverified)').fill('Check original');
 const rawDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download original email'}).click();assert.equal(await readFile(await (await rawDownload).path(),'utf8'),original);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('Browser passed: mobile layout, demo, index download, EML import, notes, exact original download, no script execution or page errors.');
}finally{await browser?.close();child.kill();}
