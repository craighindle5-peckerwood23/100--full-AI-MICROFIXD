import http from 'node:http';
import {readFile} from 'node:fs/promises';
const receipt=JSON.parse(await readFile(new URL('./repair-verification.json',import.meta.url),'utf8'));
if(receipt.status!=='verified'||receipt.network!=='none')throw new Error('INVALID_REPAIR_RECEIPT');
const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 if(req.method!=='GET'||!['/','/health','/verification'].includes(req.url)){res.writeHead(404);res.end('{}');return;}
 res.end(JSON.stringify({...receipt,commit:process.env.RENDER_GIT_COMMIT??null,role:'verification_receipt_only'}));
});
server.listen(Number(process.env.PORT||10000),'0.0.0.0');
process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
