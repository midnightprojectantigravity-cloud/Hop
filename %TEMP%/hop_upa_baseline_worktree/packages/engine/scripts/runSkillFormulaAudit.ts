import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const skillsDir = resolve(process.cwd(), 'packages/engine/src/skills');
const outFile = process.argv[2] || 'docs/UPA_SKILL_FORMULA_AUDIT.json';

const files = readdirSync(skillsDir).filter(f => f.endsWith('.ts'));
const findings: Array<{ file: string; line: number; issue: string; snippet: string }> = [];

for (const file of files) {
    const full = join(skillsDir, file);
    const text = readFileSync(full, 'utf8');
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hasDamageEffect = line.includes("type: 'Damage'");
        if (!hasDamageEffect) continue;

        let block = line;
        let j = i + 1;
        while (j < lines.length && !lines[j].includes('}') && (j - i) < 10) {
            block += `\n${lines[j]}`;
            j++;
        }
        if (j < lines.length) {
            block += `\n${lines[j]}`;
        }

        if (!block.includes('scoreEvent')) {
            findings.push({
                file,
                line: i + 1,
                issue: 'Damage effect missing scoreEvent (likely bypassing calculator telemetry)',
                snippet: line.trim()
            });
        }
    }
}

const payload = {
    generatedAt: new Date().toISOString(),
    filesScanned: files.length,
    findingCount: findings.length,
    findings
};

writeFileSync(resolve(process.cwd(), outFile), JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({ wrote: resolve(process.cwd(), outFile), findingCount: findings.length }, null, 2));

