import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const consumers = [
  path.join(root, 'apps', 'web', 'package.json'),
  path.join(root, 'apps', 'server', 'package.json')
];

const acceptedRanges = new Set(['*', 'workspace:*']);
const errors = [];
const details = [];

for (const file of consumers) {
  const raw = fs.readFileSync(file, 'utf8');
  const pkg = JSON.parse(raw);
  const dep =
    pkg.dependencies?.['@hop/engine']
    ?? pkg.devDependencies?.['@hop/engine']
    ?? pkg.peerDependencies?.['@hop/engine'];
  details.push({ file, version: dep || null });
  if (!dep) {
    errors.push(`${file}: missing @hop/engine dependency`);
    continue;
  }
  if (!acceptedRanges.has(dep)) {
    errors.push(`${file}: @hop/engine must be one of ${Array.from(acceptedRanges).join(', ')} (found "${dep}")`);
  }
}

console.log(JSON.stringify({ ok: errors.length === 0, details, errors }, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
