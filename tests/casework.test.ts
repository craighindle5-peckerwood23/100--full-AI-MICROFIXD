import {test} from 'node:test';
import assert from 'node:assert/strict';
import PostalMime from 'postal-mime';
import {demo,report,topic} from '../src/casework/evidence.ts';
import {normalize,searchGmail} from '../src/casework/gmail.ts';
test('index preserves source, draft status and notes in chronological order',()=>{
 const output=report([{...demo[1],labels:['DRAFT'],note:'Needs review'},demo[0]]);
 assert.ok(output.indexOf('demo-1')<output.indexOf('demo-2'));
 assert.match(output,/DRAFT/);assert.match(output,/Needs review/);assert.match(output,/not findings of malpractice/);
 assert.equal(topic(demo[0]),'File requests');
});
test('Gmail checks account before accessing messages',async()=>{
 const calls:string[]=[];
 const request=async(url:any)=>{calls.push(String(url));return new Response(JSON.stringify({emailAddress:'other@example.com'}));};
 await assert.rejects(()=>searchGmail('secret','x','',request as typeof fetch),/No messages were loaded/);
 assert.equal(calls.length,1);
});
test('Gmail handles pagination, plain text MIME, attachment index and drafts',async()=>{
 const request=async(url:any)=>new Response(JSON.stringify(String(url).endsWith('/profile')?{emailAddress:'craighindle5@gmail.com'}:String(url).includes('/messages?')?{messages:[{id:'123'}],nextPageToken:'next'}:{id:'123',labelIds:['DRAFT'],payload:{headers:[{name:'Subject',value:'File request'}],parts:[{mimeType:'text/plain',body:{data:Buffer.from('Original body').toString('base64url')}},{filename:'record.pdf',mimeType:'application/pdf'}]}}));
 const result=await searchGmail('secret','x','',request as typeof fetch);
 assert.equal(result.nextPageToken,'next');assert.equal(result.rows[0].text,'Original body');assert.deepEqual(result.rows[0].attachments,['record.pdf']);assert.deepEqual(result.rows[0].labels,['DRAFT']);
 assert.match(normalize({id:'html',payload:{mimeType:'text/html'}}).text,/No inline plain-text/);
});
test('Gmail does not return a partial successful page when an API read fails',async()=>{
 const request=async(url:any)=>String(url).endsWith('/profile')?new Response(JSON.stringify({emailAddress:'craighindle5@gmail.com'})):new Response('',{status:401});
 await assert.rejects(()=>searchGmail('expired','x','',request as typeof fetch),/expired/);
});
test('EML parser decodes quoted-printable and preserves MIME attachment names',async()=>{
 const email=await PostalMime.parse('From: a@example.com\r\nSubject: Test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nOriginal=20message');
 assert.equal(email.text?.trim(),'Original message');
});
