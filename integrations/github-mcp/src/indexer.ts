import ts from 'typescript';
import path from 'node:path';
import {Repository} from './github.js';
import {Memory,embed} from './memory.js';
export interface FileNode {path:string;imports:string[];depends_on:string[];exports:string[];organ?:string;agent?:string;sha:string}
export function parseFile(file:string,content:string,sha=''):FileNode {
 const source=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const imports:string[]=[],exports:string[]=[];
 function visit(node:ts.Node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(source)==='require'))imports.push(node.arguments[0].text);
  if((ts.isClassDeclaration(node)||ts.isFunctionDeclaration(node)||ts.isInterfaceDeclaration(node))&&node.name&&node.modifiers?.some(x=>x.kind===ts.SyntaxKind.ExportKeyword))exports.push(node.name.text);
  ts.forEachChild(node,visit);
 }visit(source);
 const name=path.posix.basename(file).replace(/\.[^.]+$/,'');return {path:file,sha,imports:[...new Set(imports)],depends_on:[],exports, ...(/organ|paragon|watchdog/i.test(file)?{organ:name}:{}),...(/agent/i.test(file)?{agent:name}:{})};
}
export function resolveGraph(nodes:FileNode[]):FileNode[]{const files=new Set(nodes.map(n=>n.path));for(const n of nodes)n.depends_on=n.imports.map(i=>{if(!i.startsWith('.')&&!i.startsWith('@/'))return `package:${i}`;const base=i.startsWith('@/')?i.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(n.path),i));const stem=base.replace(/\.js$/,'');return [base,`${stem}.ts`,`${stem}.tsx`,`${stem}.js`,`${stem}/index.ts`,`${stem}/index.tsx`].find(x=>files.has(x))||`unresolved:${i}`;});return nodes;}
export async function indexRepository(repo:Repository,memory:Memory,vectors=true){
 const snapshot=await repo.snapshot();
 try{const previous=await memory.architecture(repo.name,snapshot.commit);if(!vectors||(previous.graph as any).vectors)return {commit:snapshot.commit,unchanged:true};}catch(error){if(!/No completed architecture index/.test(String(error)))throw error;}
const candidates=snapshot.files.filter(f=>/\.(tsx?|jsx?|json|md|ya?ml)$/.test(f.path)&&!/(^|\/)(node_modules|dist|vendor|\.git)(\/|$)|package-lock\.json$/.test(f.path));
 if(candidates.length>2000)throw new Error('Index exceeds 2000 file budget');
 const nodes:FileNode[]=[],skipped:string[]=[];let chunks=0;
 for(const f of candidates){if(f.size>200000){skipped.push(f.path);continue;}let data;try{data=await repo.read(f.path,snapshot.commit);}catch(error){if(/Secret file|Binary file/.test(String(error))){skipped.push(f.path);continue;}throw error;}
  nodes.push(parseFile(f.path,data.content,f.sha));
  if(vectors){const rows=[];for(let offset=0,i=0;offset<data.content.length;offset+=5000,i++){if(chunks>=10000)throw new Error('Index exceeds 10000 chunk budget; nothing published');const content=data.content.slice(offset,offset+6000);rows.push({...memory.scope(repo.name),commit_sha:snapshot.commit,path:f.path,chunk_index:i,content,embedding:await embed(`${f.path}\n${content}`,repo.cfg.openaiKey)});chunks++;}if(rows.length)await memory.chunks(repo.name,snapshot.commit,rows);}
 }
 const graph={commit:snapshot.commit,files:resolveGraph(nodes),skipped,vectors,chunks,created_at:new Date().toISOString()};await memory.publish(repo.name,snapshot.commit,graph);return {commit:snapshot.commit,files:nodes.length,skipped,chunks,vectors};
}
