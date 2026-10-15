import type { AssetDescriptor, AssetRequest } from "./assetTypes";
import { executeConnectorTool } from "./connectorExecutor";
import { getConnector } from "./pluginRegistry";
import { trigger } from "../hitl/hitlManager";

const assets=new Map<string,AssetDescriptor>();
export function registerAsset(asset:AssetDescriptor){assets.set(asset.id,asset);return asset}
export function listAssets(domain?:string){return [...assets.values()].filter(a=>!domain||a.domain===domain)}
export function unregisterAsset(id:string){return assets.delete(id)}

export async function routeAsset(req:AssetRequest){
 const asset=assets.get(req.assetId); if(!asset) throw new Error("Asset not found");
 if(!asset.capabilities.includes(req.capability)) throw new Error("Capability not allowed");
 if(asset.risk!=="read"&&!req.approvalId){
  const review=trigger(req.sessionId||"asset-router",{name:`Asset action: ${asset.id}/${req.capability}`,type:"asset_action",domain:asset.domain,risk:asset.risk},"asset_approval");
  return {pendingApproval:true,approvalId:review.hitl_id};
 }
 if(asset.domain==="service"){
  const connector=getConnector(asset.provider); if(!connector) throw new Error("Service connector not installed");
  return executeConnectorTool(asset.provider,req.capability,req.input);
 }
 throw new Error(`Asset domain '${asset.domain}' has no executor installed yet`);
}
