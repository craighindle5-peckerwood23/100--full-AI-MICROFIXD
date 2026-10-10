export function routePermission(path:string,method:string,fallback:string):string {
 if(path.startsWith('/api/hitl/decide')&&method!=='GET')return 'approve';
 if(['/api/execution','/api/planner'].some(base=>path===base||path.startsWith(base+'/'))&&!['GET','HEAD','OPTIONS'].includes(method))return 'execute';
 return fallback;
}
