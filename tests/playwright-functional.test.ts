import test from 'node:test';
import assert from 'node:assert/strict';
import { browserManager } from '../server/playwright/browserManager';
test('real Chromium fill, click, text, evaluate, links and screenshot',async()=>{
  try {
    await browserManager.start();
    assert.equal(browserManager.isPlaywrightNative(),true);
    const page=await browserManager.getPage();
    await page.setContent('<title>Microfixd smoke</title><input id="input"><button id="button" onclick="document.querySelector(\'#result\').textContent=document.querySelector(\'#input\').value">Submit</button><p id="result"></p><a href="https://example.com">Link</a>');
    await browserManager.fill('#input','functional');
    await browserManager.click('#button');
    assert.equal(await browserManager.getText('#result'),'functional');
    assert.equal(await browserManager.evaluate('typeof process'),'undefined');
    assert.deepEqual(await browserManager.findLinks(),['https://example.com/']);
    assert.ok((await browserManager.screenshot()).length>1000);
    assert.equal((await browserManager.getCurrentState()).engine,'playwright_chromium_native');
    await assert.rejects(browserManager.click('#missing'));
    await assert.rejects(browserManager.navigate('file:///etc/passwd'),/HTTP/);
  } finally {await browserManager.stop();}
  assert.equal(browserManager.isStarted(),false);
});
test('Chromium startup failure never evaluates on host or reports success',async()=>{
  const path=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/nonexistent/browser';
  try {
    await assert.rejects(browserManager.evaluate('process.env'),/executable|launch/);
    await assert.rejects(browserManager.click('body'));
    assert.equal(browserManager.isStarted(),false);
  } finally {process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=path;}
});
