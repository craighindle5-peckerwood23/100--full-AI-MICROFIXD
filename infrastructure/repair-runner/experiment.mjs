import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {compareRuns} from './comparison.mjs';
const [repository='/experiment',baseRoot='/baseline',candidateRoot='/work']=process.argv.slice(2);
const git=(...args)=>execFileSync('git',['-C',repository,...args],{encoding:'utf8'}).trim();
const baseline=git('rev-parse','HEAD^1'),candidate=git('rev-parse','HEAD');
const metadata=JSON.parse(git('log','-1','--format=%B').split('\n').at(-1));
const related=metadata.file?[metadata.file]:readdirSync(resolve(baseRoot,'tests')).filter(f=>f.endsWith('.test.ts')).filter(f=>{
 const text=readFileSync(resolve(baseRoot,'tests',f),'utf8');
 return metadata.incident.paths.some(p=>text.includes('../'+p.replace(/\.[^.]+$/,'')));
}).slice(0,6).map(f=>'tests/'+f);
const files=[...new Set(['tests/execution-spine.test.ts','tests/mission-diagnosis.test.ts',...related])];
if(!files.every(f=>typeof f==='string'&&/^tests\/[a-z0-9_-]+\.test\.ts$/.test(f)))throw Error('INVALID_REGRESSION_FIXTURE');
const run=root=>files.flatMap(file=>{
 if(!existsSync(resolve(root,file))||!readFileSync(resolve(baseRoot,file)).equals(readFileSync(resolve(candidateRoot,file))))throw Error('FIXTURE_CHANGED');
 const result=spawnSync(process.execPath,['--import','tsx','--test','--test-reporter',resolve(candidateRoot,'infrastructure/repair-runner/case-reporter.mjs'),file],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:8000000});
 if(result.error||result.signal||![0,1].includes(result.status))throw Error('EXPERIMENT_INCOMPLETE');
 return result.stdout.trim().split('\n').map(line=>{const r=JSON.parse(line);return {...r,id:file+'#'+r.id};});
});
const result=compareRuns(run(baseRoot),run(candidateRoot),metadata.incident);
writeFileSync(resolve(candidateRoot,'repair-experiment.json'),JSON.stringify({baseline,candidate,...result}));
