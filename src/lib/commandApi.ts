import {getCommandPreferences} from './commandPreferences';
import { api } from './serverApi';
const SESSION_KEY='microfixd_chat_session';
export function commandSession():string {
  if(typeof window==='undefined')return 'default';
  let session=window.sessionStorage.getItem(SESSION_KEY);
  if(!session){session=crypto.randomUUID();window.sessionStorage.setItem(SESSION_KEY,session);}
  return session;
}
export async function runSystemCommand(task:string,context?:Record<string,unknown>,sessionId=commandSession()):Promise<any>{
  const result=await api<any>('POST','/command/run',{task,session_id:sessionId,source:'chat',context:{...getCommandPreferences(),...context}});
  if(!result.success)throw new Error(result.output || 'System command failed');
  return result;
}
