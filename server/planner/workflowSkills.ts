import type {SupabaseClient} from '@supabase/supabase-js';
import {contentHash,type JSONObject,type JSONValue,type PlannedTask} from './executionSpine';
import {validSchema,validateSchema} from './schema';
import {getTool} from '../tools/toolRegistry';
export interface WorkflowSkill {id:string;description:string;inputs:JSONObject;steps:{tool:string;arguments:JSONObject}[]}
const object=(v:unknown):v is JSONObject=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateSkill(value:unknown):WorkflowSkill {
 if(!object(value)||Object.keys(value).some(k=>!['id','description','inputs','steps'].includes(k))||typeof value.id!=='string'||!/^[-a-z0-9_]{1,60}$/.test(value.id)||typeof value.description!=='string'||!value.description.trim()||value.description.length>1000||!validSchema(value.inputs)||value.inputs.type!=='object'||value.inputs.additionalProperties!==false||!Array.isArray(value.steps)||value.steps.length<1||value.steps.length>8||JSON.stringify(value).length>24000)throw new Error('INVALID_WORKFLOW_SKILL');
 const check=(v:JSONValue,depth=0):void=>{
  if(depth>8)throw new Error('INVALID_SKILL_TEMPLATE');
  if(Array.isArray(v))v.forEach(x=>check(x,depth+1));
  else if(object(v)){if(Object.hasOwn(v,'$input')){if(Object.keys(v).length!==1||typeof v.$input!=='string'||!Object.hasOwn(((value.inputs as JSONObject).properties??{}) as object,v.$input))throw new Error('INVALID_SKILL_INPUT_REFERENCE');}else Object.values(v).forEach(x=>check(x,depth+1));}
 };
 for(const step of value.steps){if(!object(step)||Object.keys(step).some(k=>!['tool','arguments'].includes(k))||typeof step.tool!=='string'||!getTool(step.tool)||!object(step.arguments))throw new Error('INVALID_SKILL_STEP');check(step.arguments);}
 return JSON.parse(JSON.stringify(value)) as WorkflowSkill;
}
export function compileSkill(skill:WorkflowSkill,inputs:JSONObject,permissions:string[]):PlannedTask[]{
 skill=validateSkill(skill);
 if(!validateSchema(inputs,skill.inputs))throw new Error('INVALID_SKILL_INPUTS');
 const bind=(v:JSONValue):JSONValue=>Array.isArray(v)?v.map(bind):object(v)?Object.hasOwn(v,'$input')?structuredClone(inputs[String(v.$input)]??null):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,bind(x)])):v;
 return skill.steps.map(step=>{
  const tool=getTool(step.tool)!;if(!permissions.includes(step.tool))throw new Error('SKILL_TOOL_NOT_PERMITTED');
  const args=bind(step.arguments) as JSONObject;
  if(!validateSchema(args,{...tool.parameters,additionalProperties:false} as any))throw new Error('INVALID_SKILL_ARGUMENTS');
  return {agent_id:null,tool_permissions:[step.tool],input_context:{skill_id:skill.id},expected_output_schema:{type:'object',properties:{result:{type:'object'}},required:['result'],additionalProperties:false},subtasks:[{agent_id:null,tool_request:{name:step.tool,arguments:args},input:{skill_id:skill.id}}]};
 });
}
export async function saveWorkflowSkill(client:SupabaseClient,tenant:string,event:string,definition:unknown){
 if(!tenant||!event)throw new Error('INVALID_SKILL_SCOPE');
 const skill=validateSkill(definition),revision=contentHash(skill);
 const {error}=await client.from('microfixd_memory_records').upsert({id:`workflow:${contentHash({tenant,event,skill})}`,tenant_id:tenant,agent_id:'workflow_catalog',kind:'workflow_skill',content:JSON.stringify(skill),metadata:{skill_id:skill.id,revision,event},tags:['workflow_skill'],importance:0.5,created_at:new Date().toISOString()},{onConflict:'id',ignoreDuplicates:true});
 if(error)throw new Error('SKILL_STORAGE_UNAVAILABLE');return {skill_id:skill.id,revision,authority:'workflow_definition_not_authorization'};
}
export async function listWorkflowSkills(client:SupabaseClient,tenant:string){
 if(!tenant)throw new Error('INVALID_SKILL_SCOPE');
 const {data,error}=await client.from('microfixd_memory_records').select('content,metadata,id,created_at').eq('tenant_id',tenant).eq('kind','workflow_skill').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(101);
 if(error)throw new Error('SKILL_STORAGE_UNAVAILABLE');
 const selected=new Map<string,{skill:WorkflowSkill;revision:string}>();
 for(const row of (data??[]).slice(0,100)){
  const skill=validateSkill(JSON.parse(row.content));if(row.metadata?.revision!==contentHash(skill))throw new Error('INVALID_SKILL_REVISION');
  if(!selected.has(skill.id))selected.set(skill.id,{skill,revision:row.metadata.revision});
 }
 return {skills:[...selected.values()],window_full:(data??[]).length>100};
}
export async function readWorkflowSkill(client:SupabaseClient,tenant:string,id:string,revision:string){
 if(!tenant||!/^[-a-z0-9_]{1,60}$/.test(id)||!/^([a-f0-9]{64})$/.test(revision))throw new Error('INVALID_SKILL_REFERENCE');
 const {data,error}=await client.from('microfixd_memory_records').select('content,metadata').eq('tenant_id',tenant).eq('kind','workflow_skill').eq('metadata->>skill_id',id).eq('metadata->>revision',revision).limit(1).maybeSingle();
 if(error)throw new Error('SKILL_STORAGE_UNAVAILABLE');if(!data)throw new Error('SKILL_NOT_FOUND');
 const skill=validateSkill(JSON.parse(data.content));if(skill.id!==id||contentHash(skill)!==revision)throw new Error('INVALID_SKILL_REVISION');return {skill,revision};
}
