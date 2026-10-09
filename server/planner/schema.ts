import type {JSONValue, JSONObject} from './executionSpine';
const keys=new Set(['type','properties','required','additionalProperties','items','description','enum','minimum','maximum','minLength','maxLength','minItems','maxItems']);
export function validSchema(schema:unknown,depth=0):schema is JSONObject {
 if(depth>20||!schema||typeof schema!=='object'||Array.isArray(schema))return false;
 const s=schema as JSONObject;
 if(Object.keys(s).some(k=>!keys.has(k))||!['object','array','string','boolean','number','integer','null'].includes(String(s.type)))return false;
 if(s.enum!==undefined&&(!Array.isArray(s.enum)||!s.enum.length))return false;
 for(const k of ['minimum','maximum','minLength','maxLength','minItems','maxItems'])if(s[k]!==undefined&&(typeof s[k]!=='number'||!Number.isFinite(s[k])))return false;
 if(s.type==='object'){
  if(s.properties!==undefined&&(!s.properties||typeof s.properties!=='object'||Array.isArray(s.properties)||Object.values(s.properties).some(p=>!validSchema(p,depth+1))))return false;
  if(s.required!==undefined&&(!Array.isArray(s.required)||s.required.some(k=>typeof k!=='string'||!s.properties||!(k in (s.properties as object)))))return false;
  if(s.additionalProperties!==undefined&&typeof s.additionalProperties!=='boolean')return false;
 }
 if(s.type==='array'&&!validSchema(s.items,depth+1))return false;
 return true;
}
export function validateSchema(value:JSONValue,s:JSONObject):boolean {
 if(!validSchema(s))return false;
 if(Array.isArray(s.enum)&&!s.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))return false;
 if(s.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if((s.required as string[]|undefined)?.some(k=>!Object.hasOwn(value,k)))return false;
  const props=(s.properties??{}) as Record<string,JSONObject>;
  if(Object.entries(props).some(([k,p])=>Object.hasOwn(value,k)&&!validateSchema(value[k],p)))return false;
  return s.additionalProperties!==false||Object.keys(value).every(k=>Object.hasOwn(props,k));
 }
 if(s.type==='array')return Array.isArray(value)&&value.every(v=>validateSchema(v,s.items as JSONObject))&&(s.minItems===undefined||value.length>=Number(s.minItems))&&(s.maxItems===undefined||value.length<=Number(s.maxItems));
 if(s.type==='string')return typeof value==='string'&&(s.minLength===undefined||value.length>=Number(s.minLength))&&(s.maxLength===undefined||value.length<=Number(s.maxLength));
 if(s.type==='number'||s.type==='integer')return typeof value==='number'&&Number.isFinite(value)&&(s.type!=='integer'||Number.isInteger(value))&&(s.minimum===undefined||value>=Number(s.minimum))&&(s.maximum===undefined||value<=Number(s.maximum));
 if(s.type==='boolean')return typeof value==='boolean';
 return s.type==='null'&&value===null;
}
