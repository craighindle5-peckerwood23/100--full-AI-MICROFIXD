import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {zipSync} from 'fflate';
/** Fixed allowlist only: no credentials, environment files, vendor DLLs, or session data. */
export const BRIDGE_PACKAGE_FILES=['bridge.py','discovery.py','elm327.py','j2534.py','requirements.txt','README.md','START-WINDOWS.cmd'] as const;
export function bridgePackage(){
 const root=new URL('../../../integrations/obd-bridge/',import.meta.url);
 const entries:Record<string,Uint8Array>={};
 for(const name of BRIDGE_PACKAGE_FILES)entries[`microfixd-obd-bridge/${name}`]=readFileSync(new URL(name,root));
 const archive=Buffer.from(zipSync(entries,{level:6,mtime:new Date('2026-01-01T00:00:00Z')}));
 return {filename:'microfixd-obd-bridge.zip',sha256:createHash('sha256').update(archive).digest('hex'),archiveBase64:archive.toString('base64'),bytes:archive.length};
}
