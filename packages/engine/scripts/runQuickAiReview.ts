import { runBatch, type ArchetypeLoadoutId, type BotPolicy, type RunResult } from '../src/systems/evaluation/balance-harness';
import { buildUpaEntitySnapshot } from './lib/upaEntitySnapshot';
import { getActiveTrinityProfileId } from '../src/systems/combat/trinity-profiles';

if (!process.env.HOP_TRINITY_PROFILE) {
    process.env.HOP_TRINITY_PROFILE = 'live';
}

const count = Number(process.argv[2] || 8);
const maxTurns = Number(process.argv[3] || 24);
const loadoutId = (process.argv[4] || 'VANGUARD') as ArchetypeLoadoutId;
const policy = (process.argv[5] || 'heuristic') as BotPolicy;
const policyProfileId = process.argv[6] || 'sp-v1-default';
const seedPrefix = process.argv[7] || 'quick-ai-seed';
const verbose = process.env.HOP_AI_REVIEW_VERBOSE === '1';

const originalLog = console.log;
const originalWarn = console.warn;
if (!verbose) {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const seeds = Array.from({ length: count }, (_, i) => `${seedPrefix}-${i + 1}`);
const entitySnapshot = buildUpaEntitySnapshot(loadoutId);
const trinityProfile = getActiveTrinityProfileId();
const runs = runBatch(seeds, policy, maxTurns, loadoutId, policyProfileId);

if (!verbose) {
    console.log = originalLog;
    console.warn = originalWarn;
}

const topEntries = (hist: Record<string, number>, top = 4) =>
    Object.entries(hist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, top)
        .map(([key, value]) => ({ key, value }));

const compactRun = (run: RunResult) => ({
    seed: run.seed,
    result: run.result,
    floor: run.floor,
    turnsSpent: run.turnsSpent,
    score: run.score,
    topActions: topEntries(run.playerActionCounts),
    topSkills: topEntries(run.playerSkillUsage),
    autoAttackTriggersByActionType: run.autoAttackTriggersByActionType || {},
    strategicIntent: run.strategicIntentCounts,
    casts: run.totalPlayerSkillCasts
});

const aggregate = {
    games: runs.length,
    avgFloor: runs.reduce((sum, r) => sum + r.floor, 0) / Math.max(1, runs.length),
    avgTurnsSpent: runs.reduce((sum, r) => sum + r.turnsSpent, 0) / Math.max(1, runs.length),
    winRate: runs.filter(r => r.result === 'won').length / Math.max(1, runs.length),
    timeoutRate: runs.filter(r => r.result === 'timeout').length / Math.max(1, runs.length),
    topSkills: topEntries(
        runs.reduce<Record<string, number>>((acc, run) => {
            for (const [skillId, countUsed] of Object.entries(run.playerSkillUsage)) {
                acc[skillId] = (acc[skillId] || 0) + countUsed;
            }
            return acc;
        }, {}),
        8
    ),
    autoAttackTriggerTotals: runs.reduce<Record<string, number>>((acc, run) => {
        for (const [key, value] of Object.entries(run.autoAttackTriggersByActionType || {})) {
            acc[key] = (acc[key] || 0) + value;
        }
        return acc;
    }, {}),
    shieldBashTelemetry: (() => {
        const totals = runs.reduce(
            (acc, run) => {
                const t = run.playerSkillTelemetry?.SHIELD_BASH;
                if (!t) return acc;
                acc.casts += t.casts || 0;
                acc.enemyDamage += t.enemyDamage || 0;
                acc.killShots += t.killShots || 0;
                acc.lavaSinks += t.lavaSinks || 0;
                return acc;
            },
            { casts: 0, enemyDamage: 0, killShots: 0, lavaSinks: 0 }
        );
        return {
            ...totals,
            sinkRate: totals.casts > 0 ? Number((totals.lavaSinks / totals.casts).toFixed(4)) : 0
        };
    })(),
    intentTotals: runs.reduce(
        (acc, run) => ({
            offense: acc.offense + (run.strategicIntentCounts.offense || 0),
            defense: acc.defense + (run.strategicIntentCounts.defense || 0),
            positioning: acc.positioning + (run.strategicIntentCounts.positioning || 0),
            control: acc.control + (run.strategicIntentCounts.control || 0)
        }),
        { offense: 0, defense: 0, positioning: 0, control: 0 }
    )
};

console.log(
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            params: { count, maxTurns, loadoutId, policy, policyProfileId, seedPrefix },
            trinityProfile,
            entitySnapshot,
            aggregate,
            runs: runs.map(compactRun)
        },
        null,
        2
    )
);
