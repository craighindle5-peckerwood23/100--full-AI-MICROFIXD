import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('governance/boundaries.json', root), 'utf8'));
if (manifest.version !== 1 || !Object.keys(manifest.files).length) throw new Error('Invalid boundary manifest');
for (const [path, digest] of Object.entries(manifest.files)) {
  const actual = createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
  if (actual !== digest) throw new Error('Protected boundary changed: ' + path);
}
console.log('Protected boundaries verified.');
