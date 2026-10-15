import { Router } from "express";
import { listAssets, registerAsset, routeAsset, unregisterAsset } from "./assetRouter";
export const assetApiRouter=Router();
assetApiRouter.get("/",(req,res)=>res.json({assets:listAssets(typeof req.query.domain==="string"?req.query.domain:undefined)}));
assetApiRouter.post("/",(req,res)=>{try{res.status(201).json(registerAsset(req.body))}catch(e){res.status(400).json({error:String(e)})}});
assetApiRouter.delete("/:id",(req,res)=>res.json({removed:unregisterAsset(req.params.id)}));
assetApiRouter.post("/route",async(req,res)=>{try{const out=await routeAsset(req.body);res.status((out as any)?.pendingApproval?202:200).json(out)}catch(e){res.status(400).json({error:String(e)})}});
