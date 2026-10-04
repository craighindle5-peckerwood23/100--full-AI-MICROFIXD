import {api} from './serverApi';
export interface SpokenResponse {speech:string;responseId?:string;sessionId?:string}
/** The server trusts authenticated client playback acknowledgment, not elapsed time. */
export async function deliverSpokenResponse(response:SpokenResponse,play:(text:string)=>Promise<void>):Promise<void>{
  const ack=async(status:string,error?:string)=>{
    if(!response.responseId || !response.sessionId)throw new Error('Response delivery identity missing');
    return api('POST','/command/output/ack',{response_id:response.responseId,session_id:response.sessionId,status,error});
  };
  try {await play(response.speech);}
  catch(err){
    await ack(err instanceof Error && /cancelled/i.test(err.message)?'cancelled':'failed',String(err));
    throw err;
  }
  await ack('played');
}
