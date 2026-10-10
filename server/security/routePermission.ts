export function routePermission(path:string,method:string,fallback:string):string {
 if(path.startsWith('/api/hitl/decide')&&method!=='GET')return 'approve';
 if((path==='/api/execution'||path.startsWith('/api/execution/'))&&!['GET','HEAD','OPTIONS'].includes(method))return 'execute';
 return fallback;
}
