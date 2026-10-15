export type AssetDomain = "service"|"data"|"knowledge"|"compute"|"model"|"workflow"|"security"|"monitoring"|"simulation";
export type AssetRisk = "read"|"write"|"consequential";
export interface AssetDescriptor {
 id:string; domain:AssetDomain; provider:string; capabilities:string[];
 risk:AssetRisk; metadata?:Record<string,unknown>;
}
export interface AssetRequest { assetId:string; capability:string; input?:unknown; approvalId?:string; sessionId?:string; }
