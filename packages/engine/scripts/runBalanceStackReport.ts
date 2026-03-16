import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildBalanceStackReport } from '../src/systems/evaluation/balance-stack';
import type { BalanceViolationAllowlistEntry } from '../src/systems/evaluation/balance-schema';

const outFile = process.argv[2] || 'artifacts/balance/BALANCE_STACK_REPORT.json';
const runSeed = process.argv[3] || 'balance-stack';
const maxFloor = Number(process.argv[4] || 6);
const trinityProfileId = process.argv[5] || undefined;
const allowlistFile = process.argv[6] || 'artifacts/balance/BALANCE_STACK_ALLOWLIST.json';

const loadAllowlist = (file: string): BalanceViolationAllowlistEntry[] => {
    const fullPath = resolve(process.cwd(), file);
    if (!existsSync(fullPath)) return [];
    return JSON.parse(readFileSync(fullPath, 'utf8')) as BalanceViolationAllowlistEntry[];
};

const report = buildBalanceStackReport({
    runSeed,
    maxFloor,
    trinityProfileId,
    allowlistEntries: loadAllowlist(allowlistFile)
});

const outPath = resolve(process.cwd(), outFile);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    wrote: outPath,
    skills: report.summary.skillCount,
    loadouts: report.summary.loadoutCount,
    units: report.summary.unitCount,
    enemies: report.summary.enemyCount,
    floors: report.summary.floorCount,
    encounters: report.summary.encounterCount,
    hottestSkillId: report.summary.hottestSkillId,
    strongestLoadoutId: report.summary.strongestLoadoutId,
    strongestEnemySubtype: report.summary.strongestEnemySubtype,
    hardestFloor: report.summary.hardestFloor,
    hardestEncounterFloor: report.summary.hardestEncounterFloor,
    budgetViolationCount: report.summary.budgetViolationCount,
    errorBudgetViolationCount: report.summary.errorBudgetViolationCount,
    allowlistedBudgetViolationCount: report.summary.allowlistedBudgetViolationCount,
    unallowlistedBudgetViolationCount: report.summary.unallowlistedBudgetViolationCount
}, null, 2));
