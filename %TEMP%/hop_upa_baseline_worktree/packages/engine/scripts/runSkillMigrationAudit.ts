import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

interface SkillAuditRow {
    file: string;
    hasDamageEffect: boolean;
    usesCalculateCombat: boolean;
    usesExtractTrinityStats: boolean;
    directTrinityMathPatternHits: string[];
    status: 'ok' | 'violation';
    violations: string[];
}

const skillsDir = resolve(process.cwd(), 'packages/engine/src/skills');
const outFile = process.argv[2] || 'docs/UPA_SKILL_MIGRATION_AUDIT.json';

const files = readdirSync(skillsDir)
    .filter(f => f.endsWith('.ts') && f !== 'targeting.ts')
    .sort();

const directTrinityMathPatterns: Array<{ key: string; regex: RegExp }> = [
    { key: 'body_divisor', regex: /body\s*\/\s*\d+/g },
    { key: 'mind_divisor', regex: /mind\s*\/\s*\d+/g },
    { key: 'instinct_divisor', regex: /instinct\s*\/\s*\d+/g },
    { key: 'strength_divisor', regex: /strength\s*\/\s*\d+/g },
    { key: 'defense_divisor', regex: /defense\s*\/\s*\d+/g },
    { key: 'evasion_divisor', regex: /evasion\s*\/\s*\d+/g },
];

const rows: SkillAuditRow[] = files.map(file => {
    const content = readFileSync(join(skillsDir, file), 'utf8');
    const hasDamageEffect = /type:\s*'Damage'/.test(content);
    const usesCalculateCombat = /\bcalculateCombat\s*\(/.test(content);
    const usesExtractTrinityStats = /\bextractTrinityStats\s*\(/.test(content);
    const directTrinityMathPatternHits = directTrinityMathPatterns
        .filter(p => p.regex.test(content))
        .map(p => p.key);
    const violations: string[] = [];

    if (hasDamageEffect && !usesCalculateCombat) {
        violations.push('Damage effect without calculateCombat');
    }
    if (hasDamageEffect && !usesExtractTrinityStats) {
        violations.push('Damage effect without extractTrinityStats');
    }
    if (directTrinityMathPatternHits.length > 0) {
        violations.push(`Direct trinity math patterns: ${directTrinityMathPatternHits.join(', ')}`);
    }

    return {
        file,
        hasDamageEffect,
        usesCalculateCombat,
        usesExtractTrinityStats,
        directTrinityMathPatternHits,
        status: violations.length > 0 ? 'violation' : 'ok',
        violations,
    };
});

const totals = {
    skills: rows.length,
    skillsWithDamageEffect: rows.filter(r => r.hasDamageEffect).length,
    damageSkillsUsingCalculator: rows.filter(r => r.hasDamageEffect && r.usesCalculateCombat).length,
    violations: rows.filter(r => r.status === 'violation').length,
};

const payload = {
    generatedAt: new Date().toISOString(),
    totals,
    rows,
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({ wrote: target, ...totals }, null, 2));

if (totals.violations > 0) {
    process.exitCode = 2;
}

