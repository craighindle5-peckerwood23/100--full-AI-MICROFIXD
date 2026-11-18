import {Router} from 'express';
import {METACOGNITIVE_POLICY} from './supervisor';
import {metacognitiveClient} from './store';
export const metacognitiveRouter=Router();
metacognitiveRouter.get('/status',async(req,res)=>{
  try{
    const tenant=(req as any).microfixdTenantId;if(!tenant)return res.status(403).json({code:'AUTH_REQUIRED'});
    const client=metacognitiveClient();
    const [control,events]=await Promise.all([
      client.from('metacognitive_controls').select('halted,updated_at').eq('tenant_id',tenant).maybeSingle(),
      client.from('metacognitive_events').select('event_id,timestamp,agent_id,action,phase,assessment,confidence').eq('tenant_id',tenant).order('sequence',{ascending:false}).limit(30),
    ]);
    if(control.error||events.error)throw new Error('STORAGE_UNAVAILABLE');
    res.json({policy:METACOGNITIVE_POLICY,halted:control.data?.halted??false,recent:events.data,
      limits:['Alternative analysis is bounded, not exhaustive.','Confidence is uncalibrated unless separately validated.','A stop prevents subsequent dispatch; it does not reverse external effects.']});
  }catch{res.status(503).json({code:'METACOGNITIVE_STORAGE_UNAVAILABLE'});}
});
metacognitiveRouter.get('/events',async(req,res)=>{
  const tenant=(req as any).microfixdTenantId;if(!tenant)return res.status(403).json({code:'AUTH_REQUIRED'});
  const after=Number(req.query.after??0);if(!Number.isSafeInteger(after)||after<0)return res.status(400).json({code:'INVALID_CURSOR'});
  try{
    let query=metacognitiveClient().from('metacognitive_events').select('*').eq('tenant_id',tenant).gt('sequence',after).order('sequence').limit(100);
    if(req.query.mission_id!==undefined){if(typeof req.query.mission_id!=='string')return res.status(400).json({code:'INVALID_MISSION'});query=query.eq('mission_id',req.query.mission_id);}
    const {data,error}=await query;if(error)throw error;
    res.json({events:data,next_cursor:data.at(-1)?.sequence??after});
  }catch{res.status(503).json({code:'METACOGNITIVE_STORAGE_UNAVAILABLE'});}
});
metacognitiveRouter.post('/control',async(req,res)=>{
  if((req as any).microfixdRole!=='admin')return res.status(403).json({code:'ADMIN_REQUIRED'});
  if(typeof req.body?.halted!=='boolean')return res.status(400).json({code:'INVALID_CONTROL'});
  try{
    const {error}=await metacognitiveClient().rpc('metacognitive_set_control',{p_tenant:(req as any).microfixdTenantId,p_halted:req.body.halted,p_actor:(req as any).microfixdUserId??'admin'});
    if(error)throw error;res.json({halted:req.body.halted});
  }catch{res.status(503).json({code:'METACOGNITIVE_CONTROL_UNAVAILABLE'});}
});
