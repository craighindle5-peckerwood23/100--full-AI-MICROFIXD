import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPageURL,readPublicPage} from '../server/tools/publicPageReader';
test('public reader rejects local addresses and credentials',()=>{
 for(const url of ['http://127.0.0.1','http://2130706433','http://[::1]','http://metadata.google.internal','https://user:pass@example.com','https://example.com?token=secret'])assert.throws(()=>publicPageURL(url));
 assert.equal(publicPageURL('example.com'),'https://example.com/');
});
test('public reader returns real text and rejects challenge/oversized responses',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('Title: Example\nReal page text');
  assert.match((await readPublicPage('https://example.com')).text,/Real page/);
  globalThis.fetch=async()=>new Response('Warning: requiring captcha\nTitle: Just a moment...');
  await assert.rejects(readPublicPage('https://example.com'),/human verification/);
  globalThis.fetch=async()=>new Response('x'.repeat(120001));
  await assert.rejects(readPublicPage('https://example.com'),/context budget/);
 }finally{globalThis.fetch=original;}
});
