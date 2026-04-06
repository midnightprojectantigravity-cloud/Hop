import {
    runFloor10ButcherDuelBatch,
    type ArchetypeLoadoutId,
    type BotPolicy,
    type RunResult
} from '../src/systems/evaluation/balance-harness';
import { buildUpaEntitySnapshot } from './lib/upaEntitySnapshot';
import { TRINITY_PROFILE_SET_VERSION } from '../src/systems/combat/trinity-profiles';

const count = Number(process.argv[2] || 8);
const maxTurns = Number(process.argv[3] || 24);
const loadoutId = (process.argv[4] || 'VANGUARD') as ArchetypeLoadoutId;
const policy = (process.argv[5] || 'heuristic') as BotPolicy;
const policyProfileId = process.argv[6] || 'sp-v1-default';
const seedPrefix = process.argv[7] || 'floor10-butcher-duel';
const extraArgs = process.argv.slice(8);
const verbose = process.env.HOP_AI_REVIEW_VERBOSE === '1';

const parseMapOptions = (args: string[]) => {
    const parsed: { mapSize?: { width: number; height: number }; mapShape?: 'diamond' | 'rectangle' } = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const next = args[i + 1];
        if (arg === '--mapWidth' && Number.isInteger(Number(next)) && Number(next) > 0) {
            parsed.mapSize = {
                width: Number(next),
                height: parsed.mapSize?.height || 0
            };
            i += 1;
            continue;
        }
        if (arg === '--mapHeight' && Number.isInteger(Number(next)) && Number(next) > 0) {
            parsed.mapSize = {
                width: parsed.mapSize?.width || 0,
                height: Number(next)
            };
            i += 1;
            continue;
        }
        if (arg === '--mapShape' && (next === 'diamond' || next === 'rectangle')) {
            parsed.mapShape = next;
            i += 1;
        }
    }

    if (parsed.mapSize && (!parsed.mapSize.width || !parsed.mapSize.height)) {
        parsed.mapSize = undefined;
    }

    return parsed;
};

const mapOptions = parseMapOptions(extraArgs);

const originalLog = console.log;
const originalWarn = console.warn;
if (!verbose) {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const seeds = Array.from({ length: count }, (_, i) => `${seedPrefix}-${i + 1}`);
const entitySnapshot = buildUpaEntitySnapshot(loadoutId);
const trinityProfile = TRINITY_PROFILE_SET_VERSION;
const runs = runFloor10ButcherDuelBatch(seeds, policy, maxTurns, loadoutId, policyProfileId, mapOptions.mapSize, mapOptions.mapShape);

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
    goals: run.goalCounts,
    casts: run.totalPlayerSkillCasts,
    playerTactical: {
        attackOpportunityCount: run.pacingSignal.attackOpportunityCount,
        attackConversionCount: run.pacingSignal.attackConversionCount,
        threatenNextTurnOpportunityCount: run.pacingSignal.threatenNextTurnOpportunityCount,
        threatenNextTurnConversionCount: run.pacingSignal.threatenNextTurnConversionCount,
        idleWithVisibleHostile: run.pacingSignal.idleWithVisibleHostile,
        lowValueMobilitySelections: run.pacingSignal.lowValueMobilitySelections,
        avgTurnEndSparkRatio: run.pacingSignal.avgTurnEndSparkRatio,
        preservedRestedTurns: run.pacingSignal.preservedRestedTurns,
        restedBatterySpendSelections: run.pacingSignal.restedBatterySpendSelections,
        trueRestRestedBonusArmedTurns: run.pacingSignal.trueRestRestedBonusArmedTurns,
        voluntaryExhaustionAllowed: run.pacingSignal.voluntaryExhaustionAllowed,
        voluntaryExhaustionBlocked: run.pacingSignal.voluntaryExhaustionBlocked,
        turnsEndedRested: run.pacingSignal.turnsEndedRested,
        turnsEndedStableOrBetter: run.pacingSignal.turnsEndedStableOrBetter,
        turnsEndedCriticalOrExhausted: run.pacingSignal.turnsEndedCriticalOrExhausted,
        waitForBandPreservationSelections: run.pacingSignal.waitForBandPreservationSelections,
        firstContactTurn: run.pacingSignal.firstContactTurn,
        firstDamageTurn: run.pacingSignal.firstDamageTurn
    },
    enemyTactical: {
        damageToPlayer: run.enemyAiTelemetry.damageToPlayer,
        offensiveSkillCasts: run.enemyAiTelemetry.offensiveSkillCasts,
        idleWithVisiblePlayer: run.enemyAiTelemetry.idleWithVisiblePlayer,
        attackOpportunityTurns: run.enemyAiTelemetry.attackOpportunityTurns,
        attackConversionTurns: run.enemyAiTelemetry.attackConversionTurns,
        preservedRestedTurns: run.enemyAiTelemetry.preservedRestedTurns,
        restedBatterySpendSelections: run.enemyAiTelemetry.restedBatterySpendSelections,
        trueRestRestedBonusArmedTurns: run.enemyAiTelemetry.trueRestRestedBonusArmedTurns,
        voluntaryExhaustionAllowed: run.enemyAiTelemetry.voluntaryExhaustionAllowed,
        voluntaryExhaustionBlocked: run.enemyAiTelemetry.voluntaryExhaustionBlocked,
        turnsEndedRested: run.enemyAiTelemetry.turnsEndedRested,
        turnsEndedStableOrBetter: run.enemyAiTelemetry.turnsEndedStableOrBetter,
        turnsEndedCriticalOrExhausted: run.enemyAiTelemetry.turnsEndedCriticalOrExhausted,
        waitForBandPreservationSelections: run.enemyAiTelemetry.waitForBandPreservationSelections
    }
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
    goalTotals: runs.reduce(
        (acc, run) => ({
            engage: acc.engage + (run.goalCounts.engage || 0),
            explore: acc.explore + (run.goalCounts.explore || 0),
            recover: acc.recover + (run.goalCounts.recover || 0)
        }),
        { engage: 0, explore: 0, recover: 0 }
    ),
    playerDashboard: {
        attackConversionRate: runs.reduce((sum, run) => sum + run.pacingSignal.attackConversionCount, 0)
            / Math.max(1, runs.reduce((sum, run) => sum + run.pacingSignal.attackOpportunityCount, 0)),
        threatenNextTurnConversionRate: runs.reduce((sum, run) => sum + run.pacingSignal.threatenNextTurnConversionCount, 0)
            / Math.max(1, runs.reduce((sum, run) => sum + run.pacingSignal.threatenNextTurnOpportunityCount, 0)),
        avgIdleWithVisibleHostile: runs.reduce((sum, run) => sum + run.pacingSignal.idleWithVisibleHostile, 0) / Math.max(1, runs.length),
        avgLowValueMobilitySelections: runs.reduce((sum, run) => sum + run.pacingSignal.lowValueMobilitySelections, 0) / Math.max(1, runs.length),
        avgTurnEndSparkRatio: runs.reduce((sum, run) => sum + run.pacingSignal.avgTurnEndSparkRatio, 0) / Math.max(1, runs.length),
        avgPreservedRestedTurns: runs.reduce((sum, run) => sum + run.pacingSignal.preservedRestedTurns, 0) / Math.max(1, runs.length),
        avgRestedBatterySpendSelections: runs.reduce((sum, run) => sum + run.pacingSignal.restedBatterySpendSelections, 0) / Math.max(1, runs.length),
        avgTrueRestRestedBonusArmedTurns: runs.reduce((sum, run) => sum + run.pacingSignal.trueRestRestedBonusArmedTurns, 0) / Math.max(1, runs.length),
        avgVoluntaryExhaustionAllowed: runs.reduce((sum, run) => sum + run.pacingSignal.voluntaryExhaustionAllowed, 0) / Math.max(1, runs.length),
        avgVoluntaryExhaustionBlocked: runs.reduce((sum, run) => sum + run.pacingSignal.voluntaryExhaustionBlocked, 0) / Math.max(1, runs.length),
        avgTurnsEndedRested: runs.reduce((sum, run) => sum + run.pacingSignal.turnsEndedRested, 0) / Math.max(1, runs.length),
        avgTurnsEndedStableOrBetter: runs.reduce((sum, run) => sum + run.pacingSignal.turnsEndedStableOrBetter, 0) / Math.max(1, runs.length),
        avgTurnsEndedCriticalOrExhausted: runs.reduce((sum, run) => sum + run.pacingSignal.turnsEndedCriticalOrExhausted, 0) / Math.max(1, runs.length),
        avgWaitForBandPreservationSelections: runs.reduce((sum, run) => sum + run.pacingSignal.waitForBandPreservationSelections, 0) / Math.max(1, runs.length),
        avgFirstContactTurn: runs.reduce((sum, run) => sum + (run.pacingSignal.firstContactTurn || 0), 0) / Math.max(1, runs.filter(run => run.pacingSignal.firstContactTurn > 0).length),
        avgFirstDamageTurn: runs.reduce((sum, run) => sum + (run.pacingSignal.firstDamageTurn || 0), 0) / Math.max(1, runs.filter(run => run.pacingSignal.firstDamageTurn > 0).length)
    },
    enemyDashboard: {
        avgEnemyDamageToPlayerPerRun: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.damageToPlayer, 0) / Math.max(1, runs.length),
        avgEnemyOffensiveSkillCastsPerRun: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.offensiveSkillCasts, 0) / Math.max(1, runs.length),
        enemyAttackOpportunityConversionRate: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.attackConversionTurns, 0)
            / Math.max(1, runs.reduce((sum, run) => sum + run.enemyAiTelemetry.attackOpportunityTurns, 0)),
        enemyThreatOpportunityConversionRate: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.threatConversionTurns, 0)
            / Math.max(1, runs.reduce((sum, run) => sum + run.enemyAiTelemetry.threatOpportunityTurns, 0)),
        avgEnemyIdleWithVisiblePlayer: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.idleWithVisiblePlayer, 0) / Math.max(1, runs.length),
        avgEnemyBacktrackMoves: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.backtrackMoves, 0) / Math.max(1, runs.length),
        avgEnemyLoopMoves: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.loopMoves, 0) / Math.max(1, runs.length),
        avgEnemyPreservedRestedTurns: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.preservedRestedTurns, 0) / Math.max(1, runs.length),
        avgEnemyRestedBatterySpendSelections: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.restedBatterySpendSelections, 0) / Math.max(1, runs.length),
        avgEnemyTrueRestRestedBonusArmedTurns: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.trueRestRestedBonusArmedTurns, 0) / Math.max(1, runs.length),
        avgEnemyVoluntaryExhaustionAllowed: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.voluntaryExhaustionAllowed, 0) / Math.max(1, runs.length),
        avgEnemyVoluntaryExhaustionBlocked: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.voluntaryExhaustionBlocked, 0) / Math.max(1, runs.length),
        avgEnemyTurnsEndedRested: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.turnsEndedRested, 0) / Math.max(1, runs.length),
        avgEnemyTurnsEndedStableOrBetter: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.turnsEndedStableOrBetter, 0) / Math.max(1, runs.length),
        avgEnemyTurnsEndedCriticalOrExhausted: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.turnsEndedCriticalOrExhausted, 0) / Math.max(1, runs.length),
        avgEnemyWaitForBandPreservationSelections: runs.reduce((sum, run) => sum + run.enemyAiTelemetry.waitForBandPreservationSelections, 0) / Math.max(1, runs.length)
    }
};

console.log(
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            params: { count, maxTurns, loadoutId, policy, policyProfileId, seedPrefix, benchmark: 'floor10-butcher-duel', ...mapOptions },
            trinityProfile,
            entitySnapshot,
            aggregate,
            runs: runs.map(compactRun)
        },
        null,
        2
    )
);
