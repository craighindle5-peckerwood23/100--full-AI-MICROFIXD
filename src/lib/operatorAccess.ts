let pending:Promise<void>|undefined;
/** Open the existing access dialog and resume a command only after a verified login. */
export function requestOperatorAccess():Promise<void>{
  if(pending)return pending;
  if(typeof window==='undefined'||!window.dispatchEvent)return Promise.reject(new Error('Operator authentication required'));
  pending=new Promise<void>((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('microfixd:auth-changed',changed);window.removeEventListener('microfixd:auth-cancelled',cancelled);};
    const changed=()=>{if(window.sessionStorage.getItem('microfixd_operator_token')){cleanup();resolve();}};
    const cancelled=()=>{cleanup();reject(new Error('Command paused: operator authentication is required. Your request has not executed.'));};
    const timer=setTimeout(cancelled,120000);
    window.addEventListener('microfixd:auth-changed',changed);window.addEventListener('microfixd:auth-cancelled',cancelled);
    window.dispatchEvent(new Event('microfixd:auth-required'));
  }).finally(()=>{pending=undefined;});
  return pending;
}
