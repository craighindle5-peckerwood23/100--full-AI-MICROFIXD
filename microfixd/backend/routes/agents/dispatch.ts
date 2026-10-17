import {Router} from 'express';
import {submitMission} from '../../../../server/planner/plannerRouter';
import {governanceEngine} from '../../core/governance/engine';
import {agentRegistry} from '../../core/agents/registry';
const router=Router();
router.post('/dispatch',async(req,res,next)=>{
 const {action,prompt}=req.body??{};
 if(typeof action!=='string'||!agentRegistry[action])return res.status(400).json({code:'UNKNOWN_AGENT_ROLE'});
 const decision=await governanceEngine.evaluateAction(action,agentRegistry[action].name,{prompt});
 if(decision.decision!=='ALLOW')return res.status(403).json({code:'GOVERNANCE_APPROVAL_REQUIRED',decision});
 req.body={...req.body,objective:typeof prompt==='string'&&prompt.trim()?prompt:`Requested agent role: ${action}`};
 return submitMission(req,res,next);
});
router.post(['/dispatch-all','/pipeline-build'],(req,res,next)=>{
 if((req as any).microfixdRole!=='admin')return res.status(403).json({code:'ADMIN_REQUIRED'});
 if(!governanceEngine.isDualKeyAuthorized()&&!governanceEngine.isBypassMode())return res.status(403).json({code:'DUAL_KEY_APPROVAL_REQUIRED'});
 req.body={...req.body,objective:req.body?.task};return submitMission(req,res,next);
});
export default router;
