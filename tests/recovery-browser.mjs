import assert from 'node:assert/strict';
import {once} from 'node:events';
import express from 'express';
import {chromium} from 'playwright';
import packaged from '@sparticuz/chromium';

const app = express();
let backendDown = false;
app.use((_req, res, next) => backendDown ? res.status(503).send('Backend unavailable') : next());
app.use(express.static('dist'));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || await packaged.executablePath(), args:packaged.args});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const retained = await page.evaluate(async () => (await (await caches.open('microfixd-recovery-v1')).keys()).map(req => new URL(req.url).pathname));
  assert.deepEqual(retained, ['/recovery.html']);
  backendDown = true;
  await page.reload();
  await page.getByRole('heading', {name:'Microfixd recovery'}).waitFor();
  assert.equal(await page.evaluate(async () => (await fetch('/api/planner/missions')).status), 503);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', {name:'Microfixd recovery'}).waitFor();
  await context.setOffline(false);
  backendDown = false;
  await page.getByRole('link', {name:'Reopen the cockpit'}).click();
  await page.getByRole('button', {name:'Fast Boot'}).click();
  const ring = page.locator('.hio-detection');
  await ring.waitFor();
  async function emit(age, durable) {
    await page.evaluate(([age,durable]) => window.dispatchEvent(new CustomEvent('microfixd:telemetry', {detail:{
      type:'system.readiness',timestamp:Date.now()-age,severity:'info',data:{status:'ok',storage:{durable}},
    }})), [age,durable]);
  }
  await emit(0, true); await ring.getByText('runtime ready').waitFor();
  await emit(0, false); await ring.getByText('readiness unconfirmed').waitFor();
  await emit(60000, true); await ring.getByText('readiness stale').waitFor();
  console.log('Passed: recovery installation, 503, offline reload, API error preservation, reconnect and detection ring.');
} finally { await browser.close(); server.close(); }
