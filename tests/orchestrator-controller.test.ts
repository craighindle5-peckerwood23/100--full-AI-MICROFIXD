import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Request,Response,NextFunction} from 'express';
import {OrchestratorController} from '../server/controllers/orchestratorController';
import type {OrchestratorApp} from '../server/core/orchestratorApp';

test('controller rejects empty and malformed batches and routes valid input',async()=>{
  let calls=0;
  const app={async processOrchestrationPipeline(tasks:unknown[]){calls++;return tasks.map(()=>({status:'SUCCESS'}));}} as unknown as OrchestratorApp;
  const controller=new OrchestratorController(app);
  const response:{code:number;payload:Record<string,unknown>;status:(code:number)=>unknown;json:(payload:Record<string,unknown>)=>unknown}={
    code:0,payload:{},status(code){this.code=code;return this;},json(payload){this.payload=payload;return this;}
  };
  const dispatch=async(body:unknown)=>controller.handleBatchDispatch({body} as Request,response as unknown as Response,(()=>{}) as NextFunction);
  await dispatch({tasks:[]});assert.equal(response.code,400);
  await dispatch({tasks:[{taskId:'t',missionId:'m',endpoint:'read',payload:[],maxRetries:0,timeoutMs:1000}]});assert.equal(response.code,400);
  await dispatch({tasks:[{taskId:'t',missionId:'m',endpoint:'read',payload:{},maxRetries:0,timeoutMs:1000}]});
  assert.equal(response.code,200);assert.equal(response.payload.success,true);assert.equal(calls,1);
});
test('controller fails closed when audit or orchestration rejects',async()=>{
  const app={async processOrchestrationPipeline(){throw new Error('offline');}} as unknown as OrchestratorApp;
  const controller=new OrchestratorController(app);
  const response={code:0,status(code:number){this.code=code;return this;},json(){return this;}};
  await controller.handleBatchDispatch({body:{tasks:[{taskId:'t',missionId:'m',endpoint:'read',payload:{},maxRetries:0,timeoutMs:1000}]}} as Request,response as unknown as Response,(()=>{}) as NextFunction);
  assert.equal(response.code,503);
});
