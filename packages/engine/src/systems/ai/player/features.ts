import type { Action, GameState } from '../../../types';
import {
    adjacentHostileCount,
    distanceToShrine,
    distanceToStairs,
    isHazardTile,
    nearestHostileDistance
} from './candidates';

export type TransitionMetrics = {
    hazardDamage: number;
    healingReceived: number;
    enemyDamage: number;
    killShot: number;
    stairsProgress: number;
    shrineProgress: number;
    floorProgress: number;
    enemyApproachProgress: number;
    safetyDelta: number;
    waitPenalty: number;
    noProgressPenalty: number;
};

const sumEnemyHp = (state: GameState): number =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy').reduce((acc, e) => acc + e.hp, 0);

export const transitionMetrics = (prev: GameState, next: GameState, action: Action): TransitionMetrics => {
    const hpDiff = (next.player.hp || 0) - (prev.player.hp || 0);
    const hazardDamage = Math.max(0, -hpDiff);
    const healingReceived = Math.max(0, hpDiff);
    const enemyDamage = Math.max(0, sumEnemyHp(prev) - sumEnemyHp(next));
    const killShot = Math.max(0, (next.kills || 0) - (prev.kills || 0));
    const stairsProgress = Math.max(0, distanceToStairs(prev) - distanceToStairs(next));
    const shrineProgress = Math.max(0, distanceToShrine(prev) - distanceToShrine(next));
    const floorProgress = Math.max(0, (next.floor || 0) - (prev.floor || 0));
    const enemyApproachProgress = Math.max(0, nearestHostileDistance(prev) - nearestHostileDistance(next));

    const prevSafety = adjacentHostileCount(prev, prev.player.position) + (isHazardTile(prev, prev.player.position) ? 1 : 0);
    const nextSafety = adjacentHostileCount(next, next.player.position) + (isHazardTile(next, next.player.position) ? 1 : 0);
    const safetyDelta = prevSafety - nextSafety;

    const waitPenalty = action.type === 'WAIT' ? 1 : 0;
    const noProgress = enemyDamage === 0
        && killShot === 0
        && stairsProgress === 0
        && shrineProgress === 0
        && floorProgress === 0
        && enemyApproachProgress === 0
        && safetyDelta <= 0;
    const noProgressPenalty = noProgress ? 1 : 0;

    return {
        hazardDamage,
        healingReceived,
        enemyDamage,
        killShot,
        stairsProgress,
        shrineProgress,
        floorProgress,
        enemyApproachProgress,
        safetyDelta,
        waitPenalty,
        noProgressPenalty
    };
};
