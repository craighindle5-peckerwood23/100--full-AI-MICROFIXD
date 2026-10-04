// Test-only Chromium extraction avoids the external Playwright CDN.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { brotliDecompressSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
const require=createRequire(import.meta.url);
let directory=dirname(require.resolve('@sparticuz/chromium'));
while(!existsSync(join(directory,'bin/chromium.br'))){const parent=dirname(directory);if(parent===directory)throw new Error('Packaged Chromium missing');directory=parent;}
const executable=join(tmpdir(),'microfixd-test-chromium');
writeFileSync(executable,brotliDecompressSync(readFileSync(join(directory,'bin/chromium.br'))));chmodSync(executable,0o755);
const result=spawnSync(process.execPath,['--import','tsx','--test','tests/playwright-functional.test.ts','tests/services-functional.test.ts'],{
  stdio:'inherit',env:{...process.env,PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:executable,
    // Root/restricted test environment only; production keeps Chromium's sandbox enabled.
    PLAYWRIGHT_CHROMIUM_SANDBOX:'false'},
});
process.exit(result.status??1);
