import {readFile,writeFile,mkdir,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const LIMITS=Object.freeze({iterations:5,files:8,bytesPerFile:60000,totalPatchBytes:150000,contextBytes:40000,logBytes:14000});
export const ALLOWED_TESTS=Object.freeze(['npm test','npm run lint','npm run build','npm run test:spine','npm run test:system-probes']);
export const PROTECTED_PREFIXES=Object.freeze(['.git/','.github/','infrastructure/','scripts/','tests/','governance/','package.json','cognitive-shell/package','render.yaml','.dockerignore','.github/workflows/','supabase/','server/security/','server/hitl/','server/planner/','server/engineering/','.env','package-lock.json']);
export function digest(input){return createHash('sha256').update(input).digest('hex');}
export function safePath(root,relative){
 if(typeof relative!=='string'||!relative||relative.includes('\\')||path.isAbsolute(relative)||relative.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('UNSAFE_PATH');
 const normalized=relative.replaceAll('\\','/');
 if(PROTECTED_PREFIXES.some(p=>normalized===p||normalized.startsWith(p)))throw Error('PROTECTED_PATH');
 if(!/\.(?:ts|tsx|js|jsx|mjs|json|css|md)$/.test(relative))throw Error('UNSUPPORTED_FILE_TYPE');
 const target=path.resolve(root,relative);
 if(!target.startsWith(path.resolve(root)+path.sep))throw Error('PATH_ESCAPE');
 return target;
}
export async function stagePatch(root,changes){
 if(!Array.isArray(changes)||changes.length===0||changes.length>LIMITS.files)throw Error('INVALID_PATCH_COUNT');
 let total=0;const staged=[],paths=new Set();
 for(const entry of changes){
  const target=safePath(root,entry.path);
  if(paths.has(target))throw Error('DUPLICATE_PATH');paths.add(target);
  if(typeof entry.content!=='string')throw Error('INVALID_CONTENT');
  const bytes=Buffer.byteLength(entry.content);total+=bytes;
  if(bytes>LIMITS.bytesPerFile||total>LIMITS.totalPatchBytes)throw Error('PATCH_BUDGET_EXCEEDED');
  try{
   const info=await stat(target);
   if(!info.isFile())throw Error('NOT_FILE');
   const resolved=await realpath(target);
   if(!resolved.startsWith(path.resolve(root)+path.sep))throw Error('SYMLINK_ESCAPE');
  }catch(error){if(error.code==='ENOENT')throw Error('FILE_NOT_FOUND');throw error;}
  const before=await readFile(target,'utf8');
  if(before===entry.content)throw Error('NO_CHANGE');
  staged.push({path:entry.path,target,before,after:entry.content,shaBefore:digest(before)});
 }
 return staged;
}
export async function applyPatch(staged){
 const applied=[];
 try{for(const f of staged){const current=await readFile(f.target,'utf8');if(digest(current)!==f.shaBefore)throw Error('STALE_PATCH');await writeFile(f.target,f.after,'utf8');applied.push(f);}}
 catch(error){for(const f of applied.reverse())await writeFile(f.target,f.before,'utf8');throw error;}
}
export function diagnoseLog(output){
 const lines=String(output).split('\n').filter(l=>/error|fail|exception|not found|timeout|typescript|ts\d{4}|ERR_/i.test(l));
 return lines.slice(-35).join('\n').slice(-LIMITS.logBytes);
}
export function normalizeModelPatch(data){
 const body=typeof data==='string'?JSON.parse(data):data;
 if(!body||typeof body!=='object'||!Array.isArray(body.files))throw Error('INVALID_MODEL_PATCH');
 return body.files.map(f=>({path:f.path,content:f.content}));
}
export function normalizeTask(input){
 if(typeof input!=='string'||!input.trim()||input.length>6000)throw Error('INVALID_TASK');
 return input.trim();
}
