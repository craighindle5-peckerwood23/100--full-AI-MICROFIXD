/** Recognize an explicit operator instruction before showing the Run as task control. */
export function isToolRequest(input:string,tools:{name:string}[]){
  const text=input.trim().toLowerCase().replace(/^(?:please |can you |could you )/,'');
  const named=/^(?:use|call|run) (?:the )?([a-z][a-z0-9_]+)\b/.exec(text);
  if(named && tools.some(tool=>tool.name===named[1]))return true;
  return /^(?:fix|repair|diagnose and repair|check and fix) (?:the |my |our |this |your )?(?:(?:broken|stalled|failing|failed|paused) )?(?:microfixd|mission|worker|integration|organ|tool|runtime|build)\b/.test(text);
}
