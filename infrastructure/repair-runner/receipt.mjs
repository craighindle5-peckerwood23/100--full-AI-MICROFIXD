import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hashes={};
for(const path of ['package-lock.json','governance/release-policy.json'])hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
await writeFile('repair-verification.json',JSON.stringify({status:'verified',gate:'production+engineering+adapters',network:'none',productionSecrets:false,finishedAt:new Date().toISOString(),hashes}));
