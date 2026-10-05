import { Octokit } from '@octokit/rest';
import { config, safePath, reviewBranch, type Config } from './config.js';
export class Repository {
 readonly api:Octokit;
 constructor(readonly cfg:Config=config(),api?:Octokit){this.api=api||new Octokit({auth:cfg.githubToken,request:{timeout:20000}});}
 get scope(){return {owner:this.cfg.owner,repo:this.cfg.repo};}
 get name(){return `${this.cfg.owner}/${this.cfg.repo}`;}
 async read(path:string,ref=this.cfg.ref){
  const {data}=await this.api.repos.getContent({...this.scope,path:safePath(path),ref});
  if(Array.isArray(data)||data.type!=='file'||!('content'in data)||data.encoding!=='base64')throw new Error('Path is not a retrievable text file');
  if(data.size>200000)throw new Error('File exceeds 200 KB limit');
  const content=Buffer.from(data.content,'base64').toString('utf8');if(content.includes('\0'))throw new Error('Binary file unsupported');
  return {path,sha:data.sha,ref,content};
 }
 async directory(path='',ref=this.cfg.ref){const {data}=await this.api.repos.getContent({...this.scope,path:safePath(path,true),ref});if(!Array.isArray(data))throw new Error('Path is not a directory');return data.map(x=>({path:x.path,type:x.type,sha:x.sha,size:x.size}));}
 async search(query:string,code=false,page=1){
  // GitHub query syntax must not escape the configured repository scope.
  if(/(?:repo|user|org):|\bOR\b/i.test(query))throw new Error('Repository qualifiers are server controlled');
  const q=`${query} repo:${this.name}`;return code?(await this.api.search.code({q,page,per_page:30})).data:(await this.api.search.issuesAndPullRequests({q,page,per_page:30})).data;
 }
 async history(path?:string,page=1){return (await this.api.repos.listCommits({...this.scope,sha:this.cfg.ref,path:path?safePath(path):undefined,page,per_page:30})).data;}
 async prs(state:'open'|'closed'|'all'='open',page=1){return (await this.api.pulls.list({...this.scope,state,page,per_page:30})).data;}
 async issues(state:'open'|'closed'|'all'='open',page=1){return (await this.api.issues.listForRepo({...this.scope,state,page,per_page:30})).data.filter(x=>!x.pull_request);}
 async analyzePr(number:number){const [pr,files,reviews]=await Promise.all([this.api.pulls.get({...this.scope,pull_number:number}),this.api.pulls.listFiles({...this.scope,pull_number:number,per_page:100}),this.api.pulls.listReviews({...this.scope,pull_number:number,per_page:100})]);return {pr:pr.data,files:files.data,reviews:reviews.data,limited:pr.data.changed_files>100};}
 async analyzeIssue(number:number){const [issue,comments]=await Promise.all([this.api.issues.get({...this.scope,issue_number:number}),this.api.issues.listComments({...this.scope,issue_number:number,per_page:100})]);return {issue:issue.data,comments:comments.data,limited:issue.data.comments>100};}
 async snapshot(){const {data:commit}=await this.api.repos.getCommit({...this.scope,ref:this.cfg.ref});const {data}=await this.api.git.getTree({...this.scope,tree_sha:commit.commit.tree.sha,recursive:'1'});if(data.truncated)throw new Error('Repository tree truncated; indexing aborted');return {commit:commit.sha,files:data.tree.filter(x=>x.type==='blob'&&x.path).map(x=>({path:x.path!,sha:x.sha!,size:x.size||0}))};}
 async branch(branch:string){reviewBranch(branch);const {data}=await this.api.repos.getCommit({...this.scope,ref:this.cfg.ref});return (await this.api.git.createRef({...this.scope,ref:`refs/heads/${branch}`,sha:data.sha})).data;}
 async write(path:string,content:string,branch:string,message:string,sha?:string){safePath(path);reviewBranch(branch);if(Buffer.byteLength(content)>200000)throw new Error('Content exceeds 200 KB');return (await this.api.repos.createOrUpdateFileContents({...this.scope,path,branch,message,content:Buffer.from(content).toString('base64'),...(sha?{sha}:{})})).data;}
 async createPr(branch:string,title:string,body:string){reviewBranch(branch);return (await this.api.pulls.create({...this.scope,head:branch,base:this.cfg.ref,title,body,draft:true})).data;}
}
