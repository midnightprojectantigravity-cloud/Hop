import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeSkillGradeDrift } from '../src/systems/evaluation/skill-grading';

const staticFile = process.argv[2] || 'docs/UPA_SKILL_GRADES_STATIC.json';
const dynamicFile = process.argv[3] || 'docs/UPA_SKILL_GRADES_DYNAMIC.json';
const outFile = process.argv[4] || 'docs/UPA_SKILL_GRADE_DRIFT.json';

const staticArtifact = JSON.parse(readFileSync(resolve(process.cwd(), staticFile), 'utf8'));
const dynamicArtifact = JSON.parse(readFileSync(resolve(process.cwd(), dynamicFile), 'utf8'));
const firstReport = dynamicArtifact.reports?.[0];
const dynamicMetrics = firstReport?.dynamicSkillGrades || {};

const drift = computeSkillGradeDrift(staticArtifact, dynamicMetrics);
const output = {
    generatedAt: new Date().toISOString(),
    staticFile,
    dynamicFile,
    rows: drift
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(output, null, 2), 'utf8');
console.log(JSON.stringify({ wrote: target, rows: drift.length }, null, 2));
