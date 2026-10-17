/** Parse provider formatting without weakening plan or tool authorization checks. */
export function parsePlanOutput(content:string):unknown[] {
 let text=content.trim();
 const fence=/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(text);
 if(fence)text=fence[1].trim();
 let value:unknown;
 try{value=JSON.parse(text);}catch{throw Object.assign(new Error('INVALID_PLAN_JSON'),{code:'INVALID_PLAN_JSON'});}
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&'steps' in value)value=(value as {steps:unknown}).steps;
 if(!Array.isArray(value)||!value.length||value.length>8)throw Object.assign(new Error('INVALID_PLAN'),{code:'INVALID_PLAN'});
 return value;
}
export function planningErrorCode(error:unknown):string {
 if(error instanceof SyntaxError)return 'INVALID_PLAN_JSON';
 const candidate=String((error as {code?:unknown})?.code??(error instanceof Error?error.message:''));
 return /^[A-Z][A-Z0-9_]{1,79}$/.test(candidate)?candidate:'PLANNING_FAILED';
}
