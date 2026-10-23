import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserManager} from '../server/playwright/browserManager';
import {getTool} from '../server/tools/toolRegistry';
import {BROWSER_TOOLS,READ_TOOLS,systemCapabilities} from '../server/planner/governedTools';

test('browser observation is discoverable and retains browser approval policy',()=>{
 const tool=getTool('inspect_browser_page')!;
 assert.deepEqual(tool.parameters.required,['url']);
 assert.equal(BROWSER_TOOLS.has(tool.name),true);
 assert.equal(READ_TOOLS.has(tool.name),false);
 assert.equal(systemCapabilities().tools.some(t=>t.name===tool.name&&t.durable),true);
});
test('real Chromium observes accessible controls and explicitly bounds Unicode output',async()=>{
 const previousEnvironment=process.env.NODE_ENV;
 if(!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)process.env.NODE_ENV='production';
 const browser=new BrowserManager();
 try {
  const page=await browser.getPage();
  await page.setContent('<title>Observation fixture</title><h1>Repair dashboard</h1><label>Case number<input /></label><button>Open case</button>');
  const result=await browser.inspect();
  assert.equal(result.title,'Observation fixture');
  assert.match(result.snapshot,/heading "Repair dashboard"/);
  assert.match(result.snapshot,/textbox "Case number"/);
  assert.match(result.snapshot,/button "Open case"/);
  assert.equal(result.truncated,false);
  assert.equal(result.authority,'untrusted_page_content');
  assert.equal(result.session,'fresh_context_per_tool_call');
  await page.setContent(`<p>${'🔧'.repeat(17000)}</p>`);
  const large=await browser.inspect();
  assert.equal(large.truncated,true);
  assert.equal(Array.from(large.snapshot).length,16000);
  assert.ok(large.total_characters>17000);
  assert.equal(large.snapshot.includes('\ufffd'),false);
 } finally {await browser.stop();if(previousEnvironment===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousEnvironment;}
 assert.equal(browser.isStarted(),false);
});
