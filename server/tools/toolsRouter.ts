/** Tool execution always creates a durable mission; no direct local tool loop. */
import {Router} from 'express';
import {submitMission} from '../planner/plannerRouter';
import {ENABLED_TOOLS} from '../planner/governedTools';
import {TOOL_REGISTRY,getTool} from './toolRegistry';
export const toolsRouter=Router();
toolsRouter.get("/", (req, res) => {
  res.json({ tools: TOOL_REGISTRY, count: TOOL_REGISTRY.length });
});

toolsRouter.post('/run',(req,res,next)=>{
 req.body={...req.body,objective:req.body?.message};return submitMission(req,res,next);
});
toolsRouter.post('/execute',(req,res,next)=>{
 const name=req.body?.tool_name,tool=getTool(name);
 if(!tool)return res.status(404).json({code:'UNKNOWN_TOOL'});
 if(!ENABLED_TOOLS.includes(name))return res.status(422).json({code:'UNSUPPORTED_DURABLE_TOOL'});
 const args=req.body.arguments??{};
 req.body={...req.body,objective:`Execute authorized tool ${name}`,tool_permissions:[name],plan:[{agent_id:null,tool_permissions:[name],input_context:{objective:`Execute ${name}`},expected_output_schema:{type:'object',required:['result'],properties:{result:{type:'object'}},additionalProperties:false},subtasks:[{agent_id:null,tool_request:{name,arguments:args},input:{}}]}]};
 return submitMission(req,res,next);
});
