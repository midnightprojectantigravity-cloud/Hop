import type { Action, GameState } from '../../../types';
import type { TransitionMetrics } from './features';
import type { StrategicIntent } from '../strategic-policy';

export interface PlayerSkillTelemetry {
    casts: number;
    enemyDamage: number;
    killShots: number;
    healingReceived: number;
    hazardDamage: number;
    stairsProgress: number;
    shrineProgress: number;
    floorProgress: number;
    lavaSinks: number;
}

export interface TriangleSignalSummaryLike {
    samples: number;
    avgHitPressure: number;
    avgMitigationPressure: number;
    avgCritPressure: number;
    avgResistancePressure: number;
}

export interface TrinityContributionSummaryLike {
    samples: number;
    bodyContribution: number;
    mindContribution: number;
    instinctContribution: number;
}

export interface CombatProfileSignalSummaryLike {
    samples: number;
    avgOutgoingMultiplier: number;
    avgIncomingMultiplier: number;
    avgTotalMultiplier: number;
}

export interface PlayerCombatSignals {
    triangleSignal: TriangleSignalSummaryLike;
    trinityContribution: TrinityContributionSummaryLike;
    combatProfileSignal: CombatProfileSignalSummaryLike;
}

export interface PlayerTurnTelemetryAccumulator {
    playerActionCounts: Record<string, number>;
    playerSkillUsage: Record<string, number>;
    strategicIntentCounts: Record<StrategicIntent, number>;
    totalPlayerSkillCasts: number;
    playerSkillTelemetry: Record<string, PlayerSkillTelemetry>;
    autoAttackTriggersByActionType: Record<string, number>;
}

const incrementHistogram = (hist: Record<string, number>, key: string): void => {
    hist[key] = (hist[key] || 0) + 1;
};

const zeroSkillTelemetry = (): PlayerSkillTelemetry => ({
    casts: 0,
    enemyDamage: 0,
    killShots: 0,
    healingReceived: 0,
    hazardDamage: 0,
    stairsProgress: 0,
    shrineProgress: 0,
    floorProgress: 0,
    lavaSinks: 0
});

const zeroTriangleSignal = (): TriangleSignalSummaryLike => ({
    samples: 0,
    avgHitPressure: 0,
    avgMitigationPressure: 0,
    avgCritPressure: 0,
    avgResistancePressure: 0
});

const zeroTrinityContribution = (): TrinityContributionSummaryLike => ({
    samples: 0,
    bodyContribution: 0,
    mindContribution: 0,
    instinctContribution: 0
});

const zeroCombatProfileSignal = (): CombatProfileSignalSummaryLike => ({
    samples: 0,
    avgOutgoingMultiplier: 0,
    avgIncomingMultiplier: 0,
    avgTotalMultiplier: 0
});

export const createPlayerTurnTelemetryAccumulator = (): PlayerTurnTelemetryAccumulator => ({
    playerActionCounts: {},
    playerSkillUsage: {},
    strategicIntentCounts: {
        offense: 0,
        defense: 0,
        positioning: 0,
        control: 0
    },
    totalPlayerSkillCasts: 0,
    playerSkillTelemetry: {},
    autoAttackTriggersByActionType: {}
});

export const recordPlayerActionSelectionTelemetry = (
    accumulator: PlayerTurnTelemetryAccumulator,
    action: Action,
    strategicIntent: StrategicIntent
): void => {
    accumulator.strategicIntentCounts[strategicIntent] += 1;
    incrementHistogram(accumulator.playerActionCounts, action.type);
    if (action.type === 'USE_SKILL') {
        incrementHistogram(accumulator.playerSkillUsage, action.payload.skillId);
        accumulator.totalPlayerSkillCasts += 1;
    }
};

export const recordPlayerSkillTransitionTelemetry = (
    accumulator: PlayerTurnTelemetryAccumulator,
    prev: GameState,
    next: GameState,
    action: Action,
    metrics: TransitionMetrics
): void => {
    if (action.type !== 'USE_SKILL') return;
    const skillId = action.payload.skillId;
    const prevTimelineCount = (prev.timelineEvents || []).length;
    const newTimelineEvents = (next.timelineEvents || []).slice(prevTimelineCount) as any[];
    const lavaSinks = newTimelineEvents.filter(e =>
        e && e.type === 'LavaSink' && e.actorId === prev.player.id && e.payload?.target && e.payload.target !== prev.player.id
    ).length;

    if (!accumulator.playerSkillTelemetry[skillId]) {
        accumulator.playerSkillTelemetry[skillId] = zeroSkillTelemetry();
    }
    const t = accumulator.playerSkillTelemetry[skillId];
    t.casts += 1;
    t.enemyDamage += metrics.enemyDamage;
    t.killShots += metrics.killShot;
    t.healingReceived += metrics.healingReceived;
    t.hazardDamage += metrics.hazardDamage;
    t.stairsProgress += metrics.stairsProgress;
    t.shrineProgress += metrics.shrineProgress;
    t.floorProgress += metrics.floorProgress;
    t.lavaSinks += lavaSinks;
};

export const recordPlayerAutoAttackTransitionTelemetry = (
    accumulator: PlayerTurnTelemetryAccumulator,
    prev: GameState,
    next: GameState,
    action: Action
): void => {
    const prevCombatCount = (prev.combatScoreEvents || []).length;
    const newCombatEvents = ((next.combatScoreEvents || []).slice(prevCombatCount) as any[]);
    const autoAttackEvents = newCombatEvents.filter(e =>
        e && e.attackerId === prev.player.id && e.skillId === 'AUTO_ATTACK'
    );
    if (autoAttackEvents.length === 0) return;

    const triggerKey = action.type === 'USE_SKILL'
        ? `USE_SKILL:${action.payload.skillId}`
        : action.type;
    incrementHistogram(accumulator.autoAttackTriggersByActionType, triggerKey);
    incrementHistogram(accumulator.playerSkillUsage, 'AUTO_ATTACK');

    if (!accumulator.playerSkillTelemetry.AUTO_ATTACK) {
        accumulator.playerSkillTelemetry.AUTO_ATTACK = zeroSkillTelemetry();
    }
    const t = accumulator.playerSkillTelemetry.AUTO_ATTACK;
    t.casts += 1;
    t.enemyDamage += autoAttackEvents.reduce((sum, e) => sum + Number(e.finalPower || 0), 0);
};

export const summarizePlayerCombatSignals = (
    state: GameState,
    playerId: string
): PlayerCombatSignals => {
    const combatEvents = ((state.combatScoreEvents || []) as any[])
        .filter(e => e && e.attackerId === playerId);

    const triangleSignal = combatEvents.length > 0
        ? {
            samples: combatEvents.length,
            avgHitPressure: combatEvents.reduce((acc, e) => acc + (e.hitPressure || 0), 0) / combatEvents.length,
            avgMitigationPressure: combatEvents.reduce((acc, e) => acc + (e.mitigationPressure || 0), 0) / combatEvents.length,
            avgCritPressure: combatEvents.reduce((acc, e) => acc + (e.critPressure || 0), 0) / combatEvents.length,
            avgResistancePressure: combatEvents.reduce((acc, e) => acc + (e.resistancePressure || 0), 0) / combatEvents.length,
        }
        : zeroTriangleSignal();

    const trinityContribution = combatEvents.length > 0
        ? {
            samples: combatEvents.length,
            bodyContribution: combatEvents.reduce((acc, e) => acc + (e.bodyContribution || 0), 0) / combatEvents.length,
            mindContribution: combatEvents.reduce((acc, e) => acc + (e.mindContribution || 0), 0) / combatEvents.length,
            instinctContribution: combatEvents.reduce((acc, e) => acc + (e.instinctContribution || 0), 0) / combatEvents.length,
        }
        : zeroTrinityContribution();

    const combatProfileSignal = combatEvents.length > 0
        ? {
            samples: combatEvents.length,
            avgOutgoingMultiplier: combatEvents.reduce((acc, e) => acc + Number(e.traitOutgoingMultiplier || 1), 0) / combatEvents.length,
            avgIncomingMultiplier: combatEvents.reduce((acc, e) => acc + Number(e.traitIncomingMultiplier || 1), 0) / combatEvents.length,
            avgTotalMultiplier: combatEvents.reduce((acc, e) => acc + Number(e.traitTotalMultiplier || 1), 0) / combatEvents.length,
        }
        : zeroCombatProfileSignal();

    return {
        triangleSignal,
        trinityContribution,
        combatProfileSignal
    };
};
