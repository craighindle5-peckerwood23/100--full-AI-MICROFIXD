import type {BrowserManager} from './browserManager';
import type {JSONObject,JSONValue} from '../planner/executionSpine';
export type BrowserAction={action:'click'|'fill'|'press'|'select'|'scroll'|'wait';selector?:string;value?:string;direction?:'up'|'down'};
export function parseBrowserWorkflow(text:unknown,mode:unknown='dom'):BrowserAction[]{
 if(mode!=='dom')throw new Error('UNSUPPORTED_BROWSER_STRATEGY');
 if(typeof text!=='string'||text.length>12000)throw new Error('INVALID_BROWSER_WORKFLOW');
 let steps:unknown;try{steps=JSON.parse(text);}catch{throw new Error('INVALID_BROWSER_WORKFLOW');}
 if(!Array.isArray(steps)||steps.length<1||steps.length>8)throw new Error('INVALID_BROWSER_WORKFLOW');
 for(const step of steps){
  if(!step||typeof step!=='object'||Array.isArray(step)||Object.keys(step).some(k=>!['action','selector','value','direction'].includes(k))||!['click','fill','press','select','scroll','wait'].includes(step.action))throw new Error('INVALID_BROWSER_ACTION');
  if(step.action==='scroll'){if(!['up','down'].includes(step.direction)||step.selector!==undefined||step.value!==undefined)throw new Error('INVALID_BROWSER_ACTION');}
  else {if(typeof step.selector!=='string'||!step.selector.trim()||step.selector.length>500||step.direction!==undefined)throw new Error('INVALID_BROWSER_SELECTOR');
   if(['fill','press','select'].includes(step.action)){if(typeof step.value!=='string'||step.value.length>2000)throw new Error('INVALID_BROWSER_VALUE');}
   else if(step.value!==undefined)throw new Error('INVALID_BROWSER_VALUE');
   if(step.action==='press'&&!['Enter','Tab','Escape','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Space','Backspace','Delete','Home','End'].includes(step.value))throw new Error('UNSUPPORTED_BROWSER_KEY');
  }
 }
 return steps as BrowserAction[];
}
/** Runs only a prevalidated, exactly approved action list; never page-provided instructions. */
export async function runBrowserWorkflow(browser:BrowserManager,steps:BrowserAction[]):Promise<JSONObject>{
 const page=await browser.getPage();const completed:JSONValue[]=[];
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;void browser.stop();},60000);
 try{
  for(const [index,step] of steps.entries()){
   if(timedOut)throw new Error('BROWSER_WORKFLOW_TIMEOUT');
   const target=step.selector?page.locator(step.selector):null;
   if(step.action==='click')await target!.click({timeout:5000});
   else if(step.action==='fill')await target!.fill(step.value!,{timeout:5000});
   else if(step.action==='press')await target!.press(step.value!,{timeout:5000});
   else if(step.action==='select')await target!.selectOption(step.value!,{timeout:5000});
   else if(step.action==='wait')await target!.waitFor({state:'visible',timeout:5000});
   else await page.mouse.wheel(0,step.direction==='down'?640:-640);
   completed.push({index,action:step.action,url:page.url(),completed:true});
  }
  const observation=await browser.inspect();if(timedOut)throw new Error('BROWSER_WORKFLOW_TIMEOUT');
  return {steps:completed,observation,control_mode:'dom',session:'same_context_for_this_workflow_only'};
 }finally{clearTimeout(timer);}
}
