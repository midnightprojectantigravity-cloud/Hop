import { gameReducer, generateInitialState } from '../logic';
import type { Action, GameState, Point, SkillIntentProfile } from '../types';
import { DEFAULT_LOADOUTS } from './loadout';
import { isPlayerTurn } from './initiative';
import { getNeighbors, hexDistance, hexEquals, pointToKey } from '../hex';
import { UnifiedTileService } from './unified-tile-service';
import { randomFromSeed } from './rng';
import { computeScore } from './score';
import { SkillRegistry } from '../skillRegistry';
import { computeDynamicSkillGrades, type DynamicSkillMetric, type SkillTelemetryTotals } from './skill-grading';
import {
    getStrategicPolicyProfile,
    type StrategicIntent,
    type StrategicPolicyProfile
} from './strategic-policy';

export type BotPolicy = 'random' | 'heuristic';
export type ArchetypeLoadoutId = keyof typeof DEFAULT_LOADOUTS;

export interface SkillTelemetry {
    casts: number;
    enemyDamage: number;
    killShots: number;
    healingReceived: number;
    hazardDamage: number;
    stairsProgress: number;
    shrineProgress: number;
    floorProgress: number;
}

export interface TriangleSignalSummary {
    samples: number;
    avgHitPressure: number;
    avgMitigationPressure: number;
    avgCritPressure: number;
    avgResistancePressure: number;
}

export interface TrinityContributionSummary {
    samples: number;
    bodyContribution: number;
    mindContribution: number;
    instinctContribution: number;
}

export interface RunResult {
    seed: string;
    policy: BotPolicy;
    policyProfileId: string;
    loadoutId: ArchetypeLoadoutId;
    result: 'won' | 'lost' | 'timeout';
    turnsSpent: number;
    floor: number;
    kills: number;
    hazardBreaches: number;
    score: number;
    playerActionCounts: Record<string, number>;
    playerSkillUsage: Record<string, number>;
    strategicIntentCounts: Record<StrategicIntent, number>;
    totalPlayerSkillCasts: number;
    playerSkillTelemetry: Record<string, SkillTelemetry>;
    triangleSignal: TriangleSignalSummary;
    trinityContribution: TrinityContributionSummary;
}

export interface BatchSummary {
    policy: BotPolicy;
    policyProfileId: string;
    loadoutId: ArchetypeLoadoutId;
    games: number;
    winRate: number;
    timeoutRate: number;
    avgTurnsToWin: number;
    avgTurnsToLoss: number;
    avgFloor: number;
    avgHazardBreaches: number;
    hazardDeaths: number;
    actionTypeTotals: Record<string, number>;
    skillUsageTotals: Record<string, number>;
    avgSkillUsagePerRun: Record<string, number>;
    strategicIntentTotals: Record<StrategicIntent, number>;
    avgStrategicIntentPerRun: Record<StrategicIntent, number>;
    avgPlayerSkillCastsPerRun: number;
    skillTelemetryTotals: SkillTelemetryTotals;
    triangleSignal: TriangleSignalSummary;
    trinityContribution: TrinityContributionSummary;
    dynamicSkillGrades: Record<string, DynamicSkillMetric>;
}

export interface MatchupSide {
    policy: BotPolicy;
    loadoutId: ArchetypeLoadoutId;
}

export interface MatchupRun {
    seed: string;
    left: RunResult;
    right: RunResult;
    winner: 'left' | 'right' | 'tie';
}

export interface MatchupSummary {
    games: number;
    leftWins: number;
    rightWins: number;
    ties: number;
    leftWinRate: number;
    rightWinRate: number;
    tieRate: number;
}

type TransitionMetrics = {
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

type ActionCandidate = {
    action: Action;
    profile?: SkillIntentProfile;
    preScore: number;
};

const resolvePending = (state: GameState): GameState => {
    let cur = state;
    let safety = 0;
    while (cur.pendingStatus && safety < 20) {
        cur = gameReducer(cur, { type: 'RESOLVE_PENDING' });
        safety++;
    }
    return cur;
};

const chooseFrom = <T>(items: T[], seed: string, counter: number): T => {
    const idx = Math.floor(randomFromSeed(seed, counter) * items.length) % items.length;
    return items[idx];
};

const incrementHistogram = (hist: Record<string, number>, key: string) => {
    hist[key] = (hist[key] || 0) + 1;
};

const mergeHistogram = (target: Record<string, number>, source: Record<string, number>) => {
    for (const [key, value] of Object.entries(source)) {
        target[key] = (target[key] || 0) + value;
    }
};

const mergeSkillTelemetry = (target: SkillTelemetryTotals, source: Record<string, SkillTelemetry>) => {
    for (const [skillId, stats] of Object.entries(source)) {
        if (!target[skillId]) {
            target[skillId] = { ...stats };
            continue;
        }
        const dst = target[skillId];
        dst.casts += stats.casts;
        dst.enemyDamage += stats.enemyDamage;
        dst.killShots += stats.killShots;
        dst.healingReceived += stats.healingReceived;
        dst.hazardDamage += stats.hazardDamage;
        dst.stairsProgress += stats.stairsProgress;
        dst.shrineProgress += stats.shrineProgress;
        dst.floorProgress += stats.floorProgress;
    }
};

const enemyAt = (state: GameState, p: Point) =>
    state.enemies.find(e => e.hp > 0 && e.factionId === 'enemy' && hexEquals(e.position, p));

const isHazardTile = (state: GameState, p: Point): boolean => {
    const tile = UnifiedTileService.getTileAt(state, p);
    if (!tile) return false;
    return tile.traits.has('HAZARDOUS')
        || tile.baseId === 'LAVA'
        || !!tile.effects?.some(e => e.id === 'FIRE' || e.id === 'SNARE');
};

const adjacentHostileCount = (state: GameState, p: Point): number => {
    return state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && hexDistance(e.position, p) === 1).length;
};

const aliveHostilesList = (state: GameState) =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && e.subtype !== 'bomb');

const aliveHostiles = (state: GameState): number => aliveHostilesList(state).length;

const sumEnemyHp = (state: GameState): number =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy').reduce((acc, e) => acc + e.hp, 0);

const nearestHostileDistance = (state: GameState, from = state.player.position): number => {
    const hostiles = aliveHostilesList(state);
    if (hostiles.length === 0) return 0;
    return hostiles
        .map(e => hexDistance(from, e.position))
        .sort((a, b) => a - b)[0];
};

const distanceToStairs = (state: GameState, from = state.player.position): number => {
    if (!state.stairsPosition) return 0;
    return hexDistance(from, state.stairsPosition);
};

const distanceToShrine = (state: GameState, from = state.player.position): number => {
    if (!state.shrinePosition) return 0;
    return hexDistance(from, state.shrinePosition);
};

const targetEnemyDensity = (state: GameState, target: Point): number =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && hexDistance(e.position, target) <= 1).length;

const hasReadyTagSkill = (state: GameState, tag: string): boolean => {
    for (const skill of (state.player.activeSkills || [])) {
        if ((skill.currentCooldown || 0) > 0) continue;
        const profile = SkillRegistry.get(skill.id)?.intentProfile;
        if (!profile) continue;
        if (profile.intentTags.includes(tag as any)) return true;
    }
    return false;
};

const chooseStrategicIntent = (state: GameState, profile: StrategicPolicyProfile): StrategicIntent => {
    const hpRatio = (state.player.hp || 0) / Math.max(1, state.player.maxHp || 1);
    const hostiles = aliveHostiles(state);

    if (hpRatio < profile.thresholds.defenseHpRatio) return 'defense';
    if (hostiles <= 0) return 'positioning';

    const adjacentThreat = adjacentHostileCount(state, state.player.position);
    if (adjacentThreat >= profile.thresholds.defensePressureAdjacentHostiles && hpRatio < profile.thresholds.defensePressureHpRatio) return 'defense';
    if (hasReadyTagSkill(state, 'control') && hostiles >= profile.thresholds.controlMinHostiles) return 'control';
    return 'offense';
};

const legalMoves = (state: GameState): Point[] => {
    const origin = state.player.position;
    const moveDef = SkillRegistry.get('BASIC_MOVE');
    if (moveDef?.getValidTargets) {
        return moveDef.getValidTargets(state, origin);
    }
    return getNeighbors(origin)
        .filter(p => p.q >= 0 && p.q < state.gridWidth && p.r >= 0 && p.r < state.gridHeight)
        .filter(p => UnifiedTileService.isWalkable(state, p));
};

const stateHash = (state: GameState): string => {
    const enemyBits = state.enemies
        .filter(e => e.hp > 0)
        .map(e => `${e.id}:${e.hp}:${pointToKey(e.position)}`)
        .sort()
        .join('|');
    return [
        state.turnsSpent,
        state.floor,
        state.rngCounter,
        state.player.hp,
        pointToKey(state.player.position),
        enemyBits
    ].join('::');
};

const actionKey = (action: Action): string => {
    if (action.type === 'USE_SKILL') {
        const targetKey = action.payload.target ? pointToKey(action.payload.target) : 'none';
        return `${action.type}:${action.payload.skillId}:${targetKey}`;
    }
    if (action.type === 'MOVE') {
        return `${action.type}:${pointToKey(action.payload)}`;
    }
    return action.type;
};

const tagWeight = (profile: SkillIntentProfile | undefined, tag: string): number => {
    if (!profile) return 0;
    return profile.intentTags.includes(tag as any) ? 1 : 0;
};

const preRankAction = (state: GameState, action: Action, profile?: SkillIntentProfile): number => {
    if (action.type === 'WAIT') {
        return -4;
    }

    const hpRatio = (state.player.hp || 0) / Math.max(1, state.player.maxHp || 1);
    const hostileCount = aliveHostiles(state);
    const inCombat = hostileCount > 0;

    if (action.type === 'MOVE') {
        const hazardPenalty = isHazardTile(state, action.payload) ? 8 : 0;
        const pressurePenalty = adjacentHostileCount(state, action.payload) * 2;
        const approach = nearestHostileDistance(state) - nearestHostileDistance(state, action.payload);
        const shrineGain = distanceToShrine(state) - distanceToShrine(state, action.payload);
        const stairGain = distanceToStairs(state) - distanceToStairs(state, action.payload);
        const objectiveGain = inCombat ? 0 : (stairGain + (hpRatio < 0.6 ? shrineGain : 0));
        return (approach * 1.2) + (objectiveGain * 1.4) - hazardPenalty - pressurePenalty;
    }

    if (action.type !== 'USE_SKILL') {
        return -1;
    }

    const target = action.payload.target || state.player.position;
    const directHit = enemyAt(state, target) ? 1 : 0;
    const density = targetEnemyDensity(state, target);
    const summonCount = state.enemies.filter(e => e.hp > 0 && e.factionId === 'player' && e.companionOf === state.player.id).length;

    let score = 0;
    score += directHit * (4 + (profile?.estimates.damage || 0));
    score += density * (profile?.target.aoeRadius ? 1.7 : 1.0);
    score += tagWeight(profile, 'damage') * 2.2;
    score += tagWeight(profile, 'control') * 1.3;
    score += tagWeight(profile, 'heal') * (hpRatio < 0.6 ? 3 : 0.6);
    score += tagWeight(profile, 'protect') * (hpRatio < 0.5 ? 2.5 : 1);
    score += tagWeight(profile, 'summon') * Math.max(0, 7 - summonCount) * 0.8;
    score += tagWeight(profile, 'move') * (inCombat ? 0.8 : 1.1);
    score += tagWeight(profile, 'objective') * (inCombat ? 0 : 1.3);
    score -= tagWeight(profile, 'hazard') * (hpRatio < 0.5 ? 0.6 : -0.2);
    if (action.payload.skillId === 'FIREWALK' && inCombat && directHit === 0 && density <= 1) {
        score -= 6;
    }
    if (action.payload.skillId === 'JUMP' && inCombat && directHit === 0 && density === 0) {
        score -= 4;
    }

    return score;
};

const buildSkillActions = (state: GameState): ActionCandidate[] => {
    const actions: ActionCandidate[] = [];
    const origin = state.player.position;

    for (const skill of (state.player.activeSkills || [])) {
        if ((skill.currentCooldown || 0) > 0) continue;
        if (skill.id === 'AUTO_ATTACK') continue;
        if (skill.id === 'BASIC_MOVE') continue;

        const def = SkillRegistry.get(skill.id);
        if (!def?.getValidTargets) continue;
        let targets = def.getValidTargets(state, origin);
        if ((!targets || targets.length === 0) && def.intentProfile?.target.pattern === 'self') {
            targets = [origin];
        }
        if (!targets?.length) continue;

        const profile = def.intentProfile;
        const rankedTargets = targets
            .map(target => {
                const direct = enemyAt(state, target) ? 2 : 0;
                const density = targetEnemyDensity(state, target);
                if (profile?.intentTags.includes('damage') && direct === 0 && density === 0) {
                    return null;
                }
                const objectiveBias = (profile?.intentTags.includes('objective') && !aliveHostiles(state))
                    ? ((distanceToStairs(state) - distanceToStairs(state, target)) + (distanceToShrine(state) - distanceToShrine(state, target)))
                    : 0;
                return { target, score: direct + density + objectiveBias };
            })
            .filter((x): x is { target: Point; score: number } => !!x)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(t => t.target);

        for (const target of rankedTargets) {
            const action: Action = { type: 'USE_SKILL', payload: { skillId: skill.id, target } };
            actions.push({
                action,
                profile,
                preScore: preRankAction(state, action, profile)
            });
        }
    }

    return actions;
};

const transitionMetrics = (prev: GameState, next: GameState, action: Action): TransitionMetrics => {
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

const utilityWeights = (_state: GameState, strategicIntent: StrategicIntent, profile: StrategicPolicyProfile) => {
    return profile.weightsByIntent[strategicIntent];
};

const evaluateAction = (
    state: GameState,
    candidate: ActionCandidate,
    strategicIntent: StrategicIntent,
    profile: StrategicPolicyProfile,
    memo: Map<string, { value: number; metrics: TransitionMetrics; next: GameState }>
): { value: number; metrics: TransitionMetrics; next: GameState } => {
    const key = `${stateHash(state)}|${state.player.id}|${actionKey(candidate.action)}`;
    const cached = memo.get(key);
    if (cached) return cached;

    const next = resolvePending(gameReducer(state, candidate.action));
    const metrics = transitionMetrics(state, next, candidate.action);
    const w = utilityWeights(state, strategicIntent, profile);

    let value = 0;
    value += (metrics.healingReceived - metrics.hazardDamage) * w.survival;
    value += (metrics.enemyDamage * 2.5 + metrics.killShot * 18) * w.lethality;
    value += (metrics.enemyApproachProgress + metrics.safetyDelta) * w.position;
    value += (metrics.stairsProgress + metrics.shrineProgress + metrics.floorProgress * 6) * w.objective;
    value += (-metrics.waitPenalty - (metrics.noProgressPenalty * 2.5)) * w.tempo;

    const p = candidate.profile;
    if (p) {
        value += (p.estimates.damage || 0) * tagWeight(p, 'damage') * 0.8;
        value += (p.estimates.healing || 0) * tagWeight(p, 'heal') * (w.survival * 0.3);
        value += (p.estimates.movement || 0) * tagWeight(p, 'move') * 0.4;
        value += (p.estimates.control || 0) * tagWeight(p, 'control') * (0.3 + (w.status * 0.2));
        value += (p.estimates.summon || 0) * tagWeight(p, 'summon') * 0.9;
        value -= (p.economy.cooldown || 0) * 0.12;
        value -= (p.economy.cost || 0) * 0.08 * w.resource;
    }
    if (candidate.action.type === 'USE_SKILL' && candidate.action.payload.skillId === 'FIREWALK') {
        if (metrics.enemyDamage === 0 && metrics.killShot === 0 && metrics.floorProgress === 0) {
            value -= 8;
            if ((metrics.stairsProgress + metrics.shrineProgress) > 0) {
                value += 3;
            }
        }
    }
    if (candidate.action.type === 'USE_SKILL' && candidate.action.payload.skillId === 'JUMP') {
        if (metrics.enemyDamage === 0 && metrics.killShot === 0 && metrics.floorProgress === 0) {
            value -= 6;
            if ((metrics.stairsProgress + metrics.shrineProgress) > 0) {
                value += 2;
            }
        }
    }

    const evaluated = { value, metrics, next };
    memo.set(key, evaluated);
    return evaluated;
};

export const selectByOnePlySimulation = (
    state: GameState,
    strategicIntent: StrategicIntent,
    profile: StrategicPolicyProfile,
    simSeed: string,
    decisionCounter: number,
    topK = 6
): Action => {
    const moveCandidates: ActionCandidate[] = legalMoves(state).map(move => {
        const action: Action = { type: 'MOVE', payload: move };
        return { action, preScore: preRankAction(state, action) };
    });
    const skillCandidates = buildSkillActions(state);
    const waitCandidate: ActionCandidate = { action: { type: 'WAIT' }, preScore: preRankAction(state, { type: 'WAIT' }) };

    const allCandidates = [waitCandidate, ...moveCandidates, ...skillCandidates];
    if (allCandidates.length === 0) return { type: 'WAIT' };

    const inCombat = aliveHostiles(state) > 0;
    const filteredRaw = inCombat ? allCandidates.filter(c => c.action.type !== 'WAIT') : allCandidates;
    const filtered = filteredRaw.length > 0 ? filteredRaw : allCandidates;
    const ranked = [...filtered].sort((a, b) => b.preScore - a.preScore);
    const shortlist = ranked.slice(0, Math.max(1, Math.min(topK, ranked.length)));

    const memo = new Map<string, { value: number; metrics: TransitionMetrics; next: GameState }>();
    const scored = shortlist.map(candidate => {
        const evald = evaluateAction(state, candidate, strategicIntent, profile, memo);
        return { candidate, ...evald };
    });

    const nonStallingSkillActions = scored.filter(s => {
        if (s.candidate.action.type !== 'USE_SKILL') return true;
        const m = s.metrics;
        const noProgress = m.noProgressPenalty > 0
            && m.enemyDamage === 0
            && m.killShot === 0
            && m.stairsProgress === 0
            && m.shrineProgress === 0
            && m.floorProgress === 0;
        return !noProgress;
    });

    const candidatePool = nonStallingSkillActions.length > 0 ? nonStallingSkillActions : scored;
    if (candidatePool.length === 0) return { type: 'WAIT' };
    const killers = candidatePool.filter(s => s.metrics.killShot > 0);
    const bestPool = killers.length > 0 ? killers : candidatePool;
    bestPool.sort((a, b) => b.value - a.value);
    const best = bestPool[0].value;
    const ties = bestPool.filter(x => x.value === best).map(x => x.candidate.action);
    return chooseFrom(ties, `${simSeed}:sim`, decisionCounter);
};

const selectAction = (
    state: GameState,
    policy: BotPolicy,
    profile: StrategicPolicyProfile,
    simSeed: string,
    decisionCounter: number
): { action: Action; strategicIntent: StrategicIntent } => {
    const strategicIntent = chooseStrategicIntent(state, profile);

    if (policy === 'random') {
        const moves = legalMoves(state);
        const options: Action[] = [{ type: 'WAIT' }, ...moves.map(m => ({ type: 'MOVE' as const, payload: m }))];
        return { action: chooseFrom(options, simSeed, decisionCounter), strategicIntent };
    }

    return {
        action: selectByOnePlySimulation(state, strategicIntent, profile, simSeed, decisionCounter),
        strategicIntent
    };
};

const zeroSkillTelemetry = (): SkillTelemetry => ({
    casts: 0,
    enemyDamage: 0,
    killShots: 0,
    healingReceived: 0,
    hazardDamage: 0,
    stairsProgress: 0,
    shrineProgress: 0,
    floorProgress: 0
});

const zeroTriangleSignal = (): TriangleSignalSummary => ({
    samples: 0,
    avgHitPressure: 0,
    avgMitigationPressure: 0,
    avgCritPressure: 0,
    avgResistancePressure: 0
});

const zeroTrinityContribution = (): TrinityContributionSummary => ({
    samples: 0,
    bodyContribution: 0,
    mindContribution: 0,
    instinctContribution: 0
});

export const simulateRun = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default'
): RunResult => {
    const profile = getStrategicPolicyProfile(policyProfileId);
    let state = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS[loadoutId]);
    let decisionCounter = 0;
    let guard = 0;
    let stagnantPlayerActions = 0;
    const playerActionCounts: Record<string, number> = {};
    const playerSkillUsage: Record<string, number> = {};
    const strategicIntentCounts: Record<StrategicIntent, number> = {
        offense: 0,
        defense: 0,
        positioning: 0,
        control: 0
    };
    const playerSkillTelemetry: Record<string, SkillTelemetry> = {};
    let totalPlayerSkillCasts = 0;

    while (state.gameStatus !== 'won' && state.gameStatus !== 'lost' && guard < 1500) {
        guard++;
        if (state.turnsSpent >= maxTurns) {
            break;
        }

        if (state.gameStatus === 'choosing_upgrade') {
            const options = state.shrineOptions || [];
            const option = options[0] || 'EXTRA_HP';
            state = gameReducer(state, { type: 'SELECT_UPGRADE', payload: option });
            state = resolvePending(state);
            continue;
        }

        if (isPlayerTurn(state)) {
            const prev = state;
            const prevTurnsSpent = state.turnsSpent || 0;
            const selection = selectAction(state, policy, profile, `${seed}:${policy}`, decisionCounter++);
            const action = selection.action;
            strategicIntentCounts[selection.strategicIntent] += 1;
            incrementHistogram(playerActionCounts, action.type);
            if (action.type === 'USE_SKILL') {
                incrementHistogram(playerSkillUsage, action.payload.skillId);
                totalPlayerSkillCasts += 1;
            }

            state = gameReducer(state, action);
            state = resolvePending(state);
            if ((state.turnsSpent || 0) === prevTurnsSpent) {
                stagnantPlayerActions += 1;
            } else {
                stagnantPlayerActions = 0;
            }
            if (stagnantPlayerActions >= 3) {
                state = gameReducer(state, { type: 'ADVANCE_TURN' });
                state = resolvePending(state);
                stagnantPlayerActions = 0;
            }

            if (action.type === 'USE_SKILL') {
                const m = transitionMetrics(prev, state, action);
                if (!playerSkillTelemetry[action.payload.skillId]) {
                    playerSkillTelemetry[action.payload.skillId] = zeroSkillTelemetry();
                }
                const t = playerSkillTelemetry[action.payload.skillId];
                t.casts += 1;
                t.enemyDamage += m.enemyDamage;
                t.killShots += m.killShot;
                t.healingReceived += m.healingReceived;
                t.hazardDamage += m.hazardDamage;
                t.stairsProgress += m.stairsProgress;
                t.shrineProgress += m.shrineProgress;
                t.floorProgress += m.floorProgress;
            }
        } else {
            state = gameReducer(state, { type: 'ADVANCE_TURN' });
            state = resolvePending(state);
        }
    }

    const result: RunResult['result'] = state.gameStatus === 'won'
        ? 'won'
        : (state.gameStatus === 'lost' ? 'lost' : 'timeout');

    const playerId = state.player.id;
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

    return {
        seed,
        policy,
        policyProfileId: profile.version,
        loadoutId,
        result,
        turnsSpent: state.turnsSpent || 0,
        floor: state.floor,
        kills: state.kills || 0,
        hazardBreaches: state.hazardBreaches || 0,
        score: computeScore(state),
        playerActionCounts,
        playerSkillUsage,
        strategicIntentCounts,
        totalPlayerSkillCasts,
        playerSkillTelemetry,
        triangleSignal,
        trinityContribution
    };
};

export const runBatch = (
    seeds: string[],
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default'
): RunResult[] => {
    return seeds.map(seed => simulateRun(seed, policy, maxTurns, loadoutId, policyProfileId));
};

export const summarizeBatch = (
    results: RunResult[],
    policy: BotPolicy,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD'
): BatchSummary => {
    const wins = results.filter(r => r.result === 'won');
    const losses = results.filter(r => r.result === 'lost');
    const timeouts = results.filter(r => r.result === 'timeout');
    const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const actionTypeTotals: Record<string, number> = {};
    const skillUsageTotals: Record<string, number> = {};
    const strategicIntentTotals: Record<StrategicIntent, number> = {
        offense: 0,
        defense: 0,
        positioning: 0,
        control: 0
    };
    const skillTelemetryTotals: SkillTelemetryTotals = {};
    const triangleSignalTotals = zeroTriangleSignal();
    const trinityContributionTotals = zeroTrinityContribution();

    for (const run of results) {
        mergeHistogram(actionTypeTotals, run.playerActionCounts || {});
        mergeHistogram(skillUsageTotals, run.playerSkillUsage || {});
        strategicIntentTotals.offense += run.strategicIntentCounts?.offense || 0;
        strategicIntentTotals.defense += run.strategicIntentCounts?.defense || 0;
        strategicIntentTotals.positioning += run.strategicIntentCounts?.positioning || 0;
        strategicIntentTotals.control += run.strategicIntentCounts?.control || 0;
        mergeSkillTelemetry(skillTelemetryTotals, run.playerSkillTelemetry || {});
        triangleSignalTotals.samples += run.triangleSignal?.samples || 0;
        triangleSignalTotals.avgHitPressure += run.triangleSignal?.avgHitPressure || 0;
        triangleSignalTotals.avgMitigationPressure += run.triangleSignal?.avgMitigationPressure || 0;
        triangleSignalTotals.avgCritPressure += run.triangleSignal?.avgCritPressure || 0;
        triangleSignalTotals.avgResistancePressure += run.triangleSignal?.avgResistancePressure || 0;
        trinityContributionTotals.samples += run.trinityContribution?.samples || 0;
        trinityContributionTotals.bodyContribution += run.trinityContribution?.bodyContribution || 0;
        trinityContributionTotals.mindContribution += run.trinityContribution?.mindContribution || 0;
        trinityContributionTotals.instinctContribution += run.trinityContribution?.instinctContribution || 0;
    }

    const avgSkillUsagePerRun: Record<string, number> = {};
    const divisor = results.length || 1;
    for (const [skillId, total] of Object.entries(skillUsageTotals)) {
        avgSkillUsagePerRun[skillId] = total / divisor;
    }
    const avgStrategicIntentPerRun: Record<StrategicIntent, number> = {
        offense: strategicIntentTotals.offense / divisor,
        defense: strategicIntentTotals.defense / divisor,
        positioning: strategicIntentTotals.positioning / divisor,
        control: strategicIntentTotals.control / divisor
    };
    const triangleSignal: TriangleSignalSummary = {
        samples: triangleSignalTotals.samples,
        avgHitPressure: triangleSignalTotals.avgHitPressure / divisor,
        avgMitigationPressure: triangleSignalTotals.avgMitigationPressure / divisor,
        avgCritPressure: triangleSignalTotals.avgCritPressure / divisor,
        avgResistancePressure: triangleSignalTotals.avgResistancePressure / divisor
    };
    const trinityContribution: TrinityContributionSummary = {
        samples: trinityContributionTotals.samples,
        bodyContribution: trinityContributionTotals.bodyContribution / divisor,
        mindContribution: trinityContributionTotals.mindContribution / divisor,
        instinctContribution: trinityContributionTotals.instinctContribution / divisor
    };

    const summary: BatchSummary = {
        policy,
        policyProfileId: results[0]?.policyProfileId || 'sp-v1-default',
        loadoutId,
        games: results.length,
        winRate: results.length ? wins.length / results.length : 0,
        timeoutRate: results.length ? timeouts.length / results.length : 0,
        avgTurnsToWin: avg(wins.map(r => r.turnsSpent)),
        avgTurnsToLoss: avg(losses.map(r => r.turnsSpent)),
        avgFloor: avg(results.map(r => r.floor || 0)),
        avgHazardBreaches: avg(results.map(r => r.hazardBreaches)),
        hazardDeaths: losses.filter(r => r.hazardBreaches > 0).length,
        actionTypeTotals,
        skillUsageTotals,
        avgSkillUsagePerRun,
        strategicIntentTotals,
        avgStrategicIntentPerRun,
        avgPlayerSkillCastsPerRun: avg(results.map(r => r.totalPlayerSkillCasts || 0)),
        skillTelemetryTotals,
        triangleSignal,
        trinityContribution,
        dynamicSkillGrades: {}
    };

    summary.dynamicSkillGrades = computeDynamicSkillGrades(summary);
    return summary;
};

const resultRank = (result: RunResult['result']): number => {
    switch (result) {
        case 'won':
            return 3;
        case 'timeout':
            return 2;
        case 'lost':
        default:
            return 1;
    }
};

const compareRuns = (left: RunResult, right: RunResult): 'left' | 'right' | 'tie' => {
    if (left.score !== right.score) return left.score > right.score ? 'left' : 'right';
    if (left.floor !== right.floor) return left.floor > right.floor ? 'left' : 'right';
    const leftRank = resultRank(left.result);
    const rightRank = resultRank(right.result);
    if (leftRank !== rightRank) return leftRank > rightRank ? 'left' : 'right';
    if (left.turnsSpent !== right.turnsSpent) return left.turnsSpent < right.turnsSpent ? 'left' : 'right';
    if (left.kills !== right.kills) return left.kills > right.kills ? 'left' : 'right';
    if (left.hazardBreaches !== right.hazardBreaches) return left.hazardBreaches < right.hazardBreaches ? 'left' : 'right';
    return 'tie';
};

export const runHeadToHeadBatch = (
    seeds: string[],
    left: MatchupSide,
    right: MatchupSide,
    maxTurns = 80,
    leftPolicyProfileId = 'sp-v1-default',
    rightPolicyProfileId = 'sp-v1-default'
): MatchupRun[] => {
    return seeds.map(seed => {
        const leftRun = simulateRun(seed, left.policy, maxTurns, left.loadoutId, leftPolicyProfileId);
        const rightRun = simulateRun(seed, right.policy, maxTurns, right.loadoutId, rightPolicyProfileId);
        return {
            seed,
            left: leftRun,
            right: rightRun,
            winner: compareRuns(leftRun, rightRun)
        };
    });
};

export const summarizeMatchup = (runs: MatchupRun[]): MatchupSummary => {
    const games = runs.length;
    const leftWins = runs.filter(r => r.winner === 'left').length;
    const rightWins = runs.filter(r => r.winner === 'right').length;
    const ties = runs.filter(r => r.winner === 'tie').length;
    return {
        games,
        leftWins,
        rightWins,
        ties,
        leftWinRate: games ? leftWins / games : 0,
        rightWinRate: games ? rightWins / games : 0,
        tieRate: games ? ties / games : 0
    };
};
