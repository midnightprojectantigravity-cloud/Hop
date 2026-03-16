import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runIresMetabolicSearch } from '../src/systems/ires/metabolic-search';

const outFile = process.argv[2] || 'artifacts/ires/IRES_METABOLIC_SEARCH.json';
const payload = runIresMetabolicSearch();
const outPath = resolve(process.cwd(), outFile);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    wrote: outPath,
    baselineScore: payload.baselineScore,
    bestCandidate: payload.bestCandidate.id,
    bestScore: payload.bestCandidate.totalScore
}, null, 2));
