import { Router } from "express";
import { executeConnectorTool } from "./connectorExecutor";
import { getConnector, installConnector, listConnectors, setConnectorEnabled } from "./pluginRegistry";
import { trigger } from "../hitl/hitlManager";

export const pluginRouter=Router();

pluginRouter.get("/", (_req,res)=>res.json({connectors:listConnectors().map(c=>({
  id:c.manifest.id,name:c.manifest.name,version:c.manifest.version,enabled:c.enabled,
  credentialConfigured:c.manifest.auth.type==="none" || Boolean(c.manifest.auth.env && process.env[c.manifest.auth.env]),
  tools:c.manifest.tools.map(t=>({name:t.name,description:t.description,risk:t.risk}))
}))}));

pluginRouter.post("/install",(req,res)=>{
  try { res.status(201).json(installConnector(req.body)); }
  catch(error){ res.status(400).json({code:"INVALID_CONNECTOR_MANIFEST",error:String(error)}); }
});

pluginRouter.post("/:id/enable",(req,res)=>{
  const item=setConnectorEnabled(req.params.id,Boolean(req.body?.enabled));
  if(!item) return res.status(404).json({code:"CONNECTOR_NOT_FOUND"});
  res.json({id:item.manifest.id,enabled:item.enabled});
});

pluginRouter.post("/:id/call/:tool",async(req,res)=>{
  const connector=getConnector(req.params.id);
  const tool=connector?.manifest.tools.find(t=>t.name===req.params.tool);
  if(!connector || !tool) return res.status(404).json({code:"CONNECTOR_TOOL_NOT_FOUND"});
  if(tool.risk && tool.risk!=="read" && !req.body?.approval_id){
    const review=trigger(req.body?.session_id || "plugin-gateway",{
      name:`Connector action: ${connector.manifest.name}/${tool.name}`,
      type:"connector_action",
      connector_id:connector.manifest.id,
      tool:tool.name,
      risk:tool.risk
    },"connector_approval");
    return res.status(202).json({code:"HITL_REQUIRED",approval_id:review.hitl_id});
  }
  try { res.json({success:true,result:await executeConnectorTool(req.params.id,req.params.tool,req.body?.arguments)}); }
  catch(error){ res.status(502).json({success:false,code:"CONNECTOR_EXECUTION_FAILED",error:String(error)}); }
});
