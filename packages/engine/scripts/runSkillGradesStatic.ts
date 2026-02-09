import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPOSITIONAL_SKILLS } from '../src/skillRegistry';
import { computeStaticSkillGrades } from '../src/systems/skill-grading';

const gradeModelVersion = process.argv[2] || 'p6-static-v1';
const outFile = process.argv[3] || 'docs/UPA_SKILL_GRADES_STATIC.json';

const artifact = computeStaticSkillGrades(COMPOSITIONAL_SKILLS as any, gradeModelVersion);
const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(artifact, null, 2), 'utf8');
console.log(JSON.stringify({ wrote: target, skills: Object.keys(artifact.skills).length, gradeModelVersion }, null, 2));

