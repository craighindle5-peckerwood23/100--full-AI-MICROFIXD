import {getCommandPreferences} from './commandPreferences';
import {requestOperatorAccess} from './operatorAccess';
import { api, AuthenticationRequiredError } from './serverApi';
const SESSION_KEY='microfixd_chat_session';
export function commandSession():string {
  if(typeof window==='undefined')return 'default';
  let session=window.sessionStorage.getItem(SESSION_KEY);
  if(!session){session=crypto.randomUUID();window.sessionStorage.setItem(SESSION_KEY,session);}
  return session;
}
export async function runSystemCommand(task:string,context?:Record<string,unknown>,sessionId=commandSession(),source="chat"):Promise<any>{
  const send=()=>api<any>('POST','/command/run',{task,session_id:sessionId,source,context:{...getCommandPreferences(),...context}});
  let result;
  try {result=await send();}catch(error){
    if(!(error instanceof AuthenticationRequiredError))throw error;
    await requestOperatorAccess();result=await send();
  }
  if(!result.success)throw new Error(result.output || 'System command failed');
  return result;
}
