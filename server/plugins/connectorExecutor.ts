import { getConnector } from "./pluginRegistry";

const BLOCKED_HOSTS = new Set(["localhost","127.0.0.1","0.0.0.0","::1","169.254.169.254"]);

function safeUrl(baseUrl: string, toolPath: string): URL {
  const base = new URL(baseUrl);
  if (BLOCKED_HOSTS.has(base.hostname) || base.hostname.endsWith(".local")) throw new Error("Private/local connector hosts are blocked");
  const url = new URL(toolPath, base);
  if (url.origin !== base.origin) throw new Error("Connector tool path cannot change origin");
  if (url.protocol !== "https:") throw new Error("HTTPS required");
  return url;
}

export async function executeConnectorTool(connectorId: string, toolName: string, args: unknown) {
  const connector=getConnector(connectorId);
  if(!connector || !connector.enabled) throw new Error("Connector not installed or disabled");
  const tool=connector.manifest.tools.find(t=>t.name===toolName);
  if(!tool) throw new Error("Tool not found");
  const url=safeUrl(connector.manifest.baseUrl, tool.path);
  const headers: Record<string,string>={"content-type":"application/json","accept":"application/json"};
  const auth=connector.manifest.auth;
  if(auth.type!=="none"){
    const secret=auth.env ? process.env[auth.env] : undefined;
    if(!secret) throw new Error(`Credential ${auth.env} is not configured`);
    if(auth.type==="bearer") headers.authorization=`Bearer ${secret}`;
    else headers[auth.header || "x-api-key"]=secret;
  }
  const method=tool.method || "POST";
  const init: RequestInit={method,headers,signal:AbortSignal.timeout(30_000)};
  if(method!=="GET") init.body=JSON.stringify(args ?? {});
  const response=await fetch(url,init);
  const text=await response.text();
  let data: unknown=text; try{data=JSON.parse(text)}catch{}
  if(!response.ok) throw new Error(`Connector HTTP ${response.status}: ${typeof data==="string"?data.slice(0,300):"request failed"}`);
  return {connector:connectorId,tool:toolName,status:response.status,data};
}
