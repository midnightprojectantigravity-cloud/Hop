import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBatch, summarizeBatch, type ArchetypeLoadoutId } from '../src/systems/evaluation/balance-harness';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const count = Number(process.argv[2] || 300);
const maxTurns = Number(process.argv[3] || 80);
const policy = (process.argv[4] || 'heuristic') as 'heuristic' | 'random';
const loadoutArg = process.argv[5] || 'ALL';
const outFile = process.argv[6] || 'docs/UPA_SKILL_GRADES_DYNAMIC.json';

const loadouts: ArchetypeLoadoutId[] = ['VANGUARD', 'SKIRMISHER', 'FIREMAGE', 'NECROMANCER', 'HUNTER', 'ASSASSIN'];
const selected = loadoutArg === 'ALL'
    ? loadouts
    : [loadoutArg as ArchetypeLoadoutId];

const payload = selected.map(loadoutId => {
    const seeds = Array.from({ length: count }, (_, i) => `dynamic-grade-${loadoutId}-${i + 1}`);
    const summary = summarizeBatch(runBatch(seeds, policy, maxTurns, loadoutId), policy, loadoutId);
    return {
        loadoutId,
        games: summary.games,
        winRate: summary.winRate,
        dynamicSkillGrades: summary.dynamicSkillGrades
    };
});

const artifact = {
    generatedAt: new Date().toISOString(),
    modelVersion: 'p6-dynamic-v1',
    count,
    maxTurns,
    policy,
    loadouts: selected,
    reports: payload
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(artifact, null, 2), 'utf8');
originalLog(JSON.stringify({ wrote: target, reports: payload.length, policy, count, maxTurns }, null, 2));
