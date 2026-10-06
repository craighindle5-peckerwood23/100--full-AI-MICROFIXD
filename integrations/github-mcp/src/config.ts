import { timingSafeEqual } from 'node:crypto';
export interface Config { owner:string; repo:string; ref:string; githubToken?:string; token?:string; writeToken?:string; writes:boolean; supabaseUrl?:string; supabaseKey?:string; openaiKey?:string; tenant:string; agent:string; sandboxUrl?:string; sandboxToken?:string; origins:string[] }
export function config(env:NodeJS.ProcessEnv=process.env):Config {
 return {owner:env.GITHUB_OWNER||'craighindle5-peckerwood23',repo:env.GITHUB_REPO||'100--full-AI-MICROFIXD',ref:env.GITHUB_REF||'main',githubToken:env.GITHUB_TOKEN,token:env.MCP_TOKEN,writeToken:env.MCP_WRITE_TOKEN,writes:env.MCP_ALLOW_WRITES==='true',supabaseUrl:env.SUPABASE_URL,supabaseKey:env.SUPABASE_SERVICE_ROLE_KEY,openaiKey:env.OPENAI_API_KEY,tenant:env.MCP_TENANT||'microfixd',agent:env.MCP_AGENT_ID||'shared-agent',sandboxUrl:env.MICROFIXD_BACKEND_URL,sandboxToken:env.MICROFIXD_BACKEND_TOKEN,origins:(env.MCP_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)};
}
export function sameToken(value:string|undefined,expected:string|undefined):boolean {
 if(!value||!expected)return false;const a=Buffer.from(value),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);
}
export function safePath(path:string,allowEmpty=false):string {
 if((!path&&!allowEmpty)||path.startsWith('/')||path.includes('\\')||path.split('/').some(p=>p==='..'||p==='.')||/[\x00-\x1f]/.test(path))throw new Error('Invalid repository path');
 if(path.split('/').some(p=>/^(\.env(?:\..*)?|id_rsa|id_ed25519|.*\.(pem|key))$/i.test(p)))throw new Error('Secret file access is blocked');return path;
}
export function reviewBranch(branch:string):string {
 if(!/^mcp\/[a-zA-Z0-9][a-zA-Z0-9._/-]{0,100}$/.test(branch)||branch.includes('..')||branch.includes('//')||branch.endsWith('/')||branch.endsWith('.lock'))throw new Error('Writes require an mcp/ review branch');return branch;
}
