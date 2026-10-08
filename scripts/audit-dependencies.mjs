import {spawnSync} from 'node:child_process';

const result = spawnSync('npm',['audit','--json'],{encoding:'utf8',maxBuffer:10*1024*1024});
try {
  const audit = JSON.parse(result.stdout);
  for (const [name,item] of Object.entries(audit.vulnerabilities || {})) {
    if (!['critical','high'].includes(item.severity)) continue;
    const via = item.via.map(v => typeof v === 'string' ? v : `${v.name} ${v.range} ${v.url || ''}`);
    console.log(`[dependency-audit] ${item.severity} ${name} direct=${item.isDirect} range=${item.range} via=${via.join(', ')} fix=${JSON.stringify(item.fixAvailable)}`);
  }
  console.log(`[dependency-audit] totals ${JSON.stringify(audit.metadata?.vulnerabilities || {})}`);
} catch {
  console.log(`[dependency-audit] unavailable: ${result.error?.message || result.stderr?.slice(0,200) || 'audit endpoint failed'}`);
}
