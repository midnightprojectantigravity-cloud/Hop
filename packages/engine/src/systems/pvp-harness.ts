import type { GameState, Actor, Point } from '../types';
import type { ArchetypeLoadoutId, BotPolicy } from './balance-harness';
import { generateInitialState } from '../logic';
import { DEFAULT_LOADOUTS, applyLoadoutToPlayer } from './loadout';
import { createEntity, ensureActorTrinity } from './entity-factory';
import { SkillRegistry } from '../skillRegistry';
import { applyEffects } from './effect-engine';
import { tickActorSkills } from './actor';
import { tickStatuses } from './status';
import { SpatialSystem } from './SpatialSystem';
import { hexDistance, hexEquals, pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { randomFromSeed } from './rng';

type DuelSide = 'left' | 'right';

interface DuelAction {
    kind: 'WAIT' | 'MOVE' | 'USE_SKILL';
    skillId?: string;
    target?: Point;
}

export interface PvpRunResult {
    seed: string;
    maxRounds: number;
    roundsPlayed: number;
    leftLoadoutId: ArchetypeLoadoutId;
    rightLoadoutId: ArchetypeLoadoutId;
    leftPolicy: BotPolicy;
    rightPolicy: BotPolicy;
    winner: DuelSide | 'draw';
    leftHp: number;
    rightHp: number;
    leftActionCounts: Record<string, number>;
    rightActionCounts: Record<string, number>;
    leftSkillUsage: Record<string, number>;
    rightSkillUsage: Record<string, number>;
}

export interface PvpSummary {
    games: number;
    leftWins: number;
    rightWins: number;
    draws: number;
    leftWinRate: number;
    rightWinRate: number;
    drawRate: number;
    avgRounds: number;
    leftAvgRemainingHp: number;
    rightAvgRemainingHp: number;
    leftActionTotals: Record<string, number>;
    rightActionTotals: Record<string, number>;
    leftSkillUsageTotals: Record<string, number>;
    rightSkillUsageTotals: Record<string, number>;
    leftAvgSkillUsagePerRun: Record<string, number>;
    rightAvgSkillUsagePerRun: Record<string, number>;
}

const LEFT_POS: Point = { q: 3, r: 5, s: -8 };
const RIGHT_POS: Point = { q: 7, r: 5, s: -12 };

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

const getActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player as Actor;
    return state.enemies.find(e => e.id === actorId) as Actor | undefined;
};

const setActorById = (state: GameState, actor: Actor): GameState => {
    if (state.player.id === actor.id) {
        return { ...state, player: actor };
    }
    return {
        ...state,
        enemies: state.enemies.map(e => (e.id === actor.id ? actor : e))
    };
};

const hasReadySkill = (actor: Actor, skillId: string): boolean => {
    const skill = actor.activeSkills?.find(s => s.id === skillId);
    if (!skill) return false;
    return (skill.currentCooldown || 0) <= 0;
};

const setSkillCooldown = (actor: Actor, skillId: string): Actor => {
    const def = SkillRegistry.get(skillId);
    const cooldown = def?.baseVariables.cooldown || 0;
    if (cooldown <= 0) return actor;
    return {
        ...actor,
        activeSkills: (actor.activeSkills || []).map(s => (
            s.id === skillId ? { ...s, currentCooldown: cooldown } : s
        ))
    };
};

const resolveTargetId = (state: GameState, actorId: string, target?: Point): string | undefined => {
    if (!target) return undefined;
    const occupant = getActorAt(state, target) as Actor | undefined;
    if (!occupant || occupant.id === actorId) return undefined;
    return occupant.id;
};

const clonePoint = (p: Point): Point => ({ q: p.q, r: p.r, s: p.s });

const cloneActor = (actor: Actor): Actor => {
    const components = actor.components
        ? new Map(Array.from(actor.components.entries()).map(([k, v]) => [k, structuredClone(v)]))
        : new Map();
    return {
        ...actor,
        position: clonePoint(actor.position),
        previousPosition: actor.previousPosition ? clonePoint(actor.previousPosition) : actor.previousPosition,
        activeSkills: (actor.activeSkills || []).map((skill: any) => {
            const { actionLabel, ...rest } = skill;
            return {
                ...rest,
                activeUpgrades: [...(rest.activeUpgrades || [])]
            };
        }),
        statusEffects: (actor.statusEffects || []).map(status => ({ ...status })),
        components
    };
};

const cloneGameStateForSimulation = (state: GameState): GameState => {
    const tiles = new Map(
        Array.from(state.tiles.entries()).map(([key, tile]) => [
            key,
            {
                ...tile,
                position: clonePoint(tile.position),
                traits: new Set(tile.traits),
                effects: (tile.effects || []).map(effect => ({
                    ...effect,
                    metadata: effect.metadata ? { ...effect.metadata } : effect.metadata
                }))
            }
        ])
    );

    return {
        ...state,
        player: cloneActor(state.player as Actor),
        enemies: state.enemies.map(e => cloneActor(e as Actor)),
        companions: (state.companions || []).map(c => cloneActor(c as Actor)),
        occupancyMask: [...(state.occupancyMask || [])],
        message: [...(state.message || [])],
        visualEvents: [...(state.visualEvents || [])],
        timelineEvents: [...(state.timelineEvents || [])],
        tiles
    };
};

const applyDuelAction = (state: GameState, actorId: string, action: DuelAction): GameState => {
    let cur = state;
    const actor = getActorById(cur, actorId);
    if (!actor || actor.hp <= 0) return cur;

    if (action.kind !== 'WAIT') {
        const skillId = action.kind === 'MOVE' ? 'BASIC_MOVE' : action.skillId;
        if (skillId && hasReadySkill(actor, skillId)) {
            const def = SkillRegistry.get(skillId);
            if (def) {
                const target = action.target;
                const validTargets = def.getValidTargets ? def.getValidTargets(cur, actor.position) : [];
                const isValid = target
                    ? validTargets.some(v => hexEquals(v, target))
                    : validTargets.length === 0;
                if (isValid) {
                    const execution = def.execute(cur, actor, target);
                    const targetId = resolveTargetId(cur, actor.id, target);
                    cur = applyEffects(cur, execution.effects, { sourceId: actor.id, targetId });
                    const post = getActorById(cur, actor.id);
                    if (post && post.hp > 0 && action.kind === 'USE_SKILL' && action.skillId) {
                        cur = setActorById(cur, setSkillCooldown(post, action.skillId));
                    }
                }
            }
        }
    }

    const actorAfter = getActorById(cur, actor.id);
    if (!actorAfter || actorAfter.hp <= 0) {
        return cur;
    }

    const ticked = tickActorSkills(tickStatuses(actorAfter));
    cur = setActorById(cur, ticked);
    cur.occupancyMask = SpatialSystem.refreshOccupancyMask(cur);
    return cur;
};

const legalActionsForActor = (state: GameState, actor: Actor, opponent: Actor): DuelAction[] => {
    const actions: DuelAction[] = [{ kind: 'WAIT' }];

    if (hasReadySkill(actor, 'BASIC_MOVE')) {
        const moveDef = SkillRegistry.get('BASIC_MOVE');
        const moveTargets = moveDef?.getValidTargets ? moveDef.getValidTargets(state, actor.position) : [];
        const rankedMoves = moveTargets
            .slice()
            .sort((a, b) => hexDistance(a, opponent.position) - hexDistance(b, opponent.position))
            .slice(0, 8);
        for (const target of rankedMoves) {
            actions.push({ kind: 'MOVE', target });
        }
    }

    for (const skill of actor.activeSkills || []) {
        if (skill.id === 'AUTO_ATTACK' || skill.id === 'BASIC_MOVE') continue;
        if (!hasReadySkill(actor, skill.id)) continue;
        const def = SkillRegistry.get(skill.id);
        if (!def?.getValidTargets) continue;
        const targets = def.getValidTargets(state, actor.position);
        if (!targets || targets.length === 0) continue;
        const ranked = targets
            .slice()
            .sort((a, b) => {
                const aDirect = hexEquals(a, opponent.position) ? 100 : 0;
                const bDirect = hexEquals(b, opponent.position) ? 100 : 0;
                const aScore = aDirect - hexDistance(a, opponent.position);
                const bScore = bDirect - hexDistance(b, opponent.position);
                return bScore - aScore;
            })
            .slice(0, 6);
        for (const target of ranked) {
            actions.push({ kind: 'USE_SKILL', skillId: skill.id, target });
        }
    }

    return actions;
};

const evaluateAction = (state: GameState, actorId: string, opponentId: string, action: DuelAction): number => {
    const selfBefore = getActorById(state, actorId);
    const oppBefore = getActorById(state, opponentId);
    if (!selfBefore || !oppBefore) return -9999;
    const distBefore = hexDistance(selfBefore.position, oppBefore.position);

    const simState = cloneGameStateForSimulation(state);
    const next = applyDuelAction(simState, actorId, action);
    const selfAfter = getActorById(next, actorId);
    const oppAfter = getActorById(next, opponentId);

    const selfHpAfter = selfAfter?.hp || 0;
    const oppHpAfter = oppAfter?.hp || 0;
    const distAfter = selfAfter && oppAfter ? hexDistance(selfAfter.position, oppAfter.position) : 0;

    const enemyDamage = (oppBefore.hp || 0) - oppHpAfter;
    const selfDamage = (selfBefore.hp || 0) - selfHpAfter;
    const killBonus = oppHpAfter <= 0 ? 250 : 0;
    const deathPenalty = selfHpAfter <= 0 ? 300 : 0;
    const distanceGain = distBefore - distAfter;
    const waitPenalty = action.kind === 'WAIT' ? 3 : 0;
    const noImpactPenalty = enemyDamage <= 0 && selfDamage <= 0 && distanceGain <= 0 ? 2 : 0;

    return (enemyDamage * 30)
        - (selfDamage * 22)
        + killBonus
        - deathPenalty
        + (distanceGain * 2)
        - waitPenalty
        - noImpactPenalty;
};

const chooseActionForActor = (
    state: GameState,
    actorId: string,
    opponentId: string,
    policy: BotPolicy,
    seed: string,
    counter: number
): DuelAction => {
    const actor = getActorById(state, actorId);
    const opponent = getActorById(state, opponentId);
    if (!actor || !opponent) return { kind: 'WAIT' };

    const actions = legalActionsForActor(state, actor, opponent);
    if (actions.length === 0) return { kind: 'WAIT' };

    if (policy === 'random') {
        return chooseFrom(actions, `${seed}:random:${actorId}`, counter);
    }

    const scored = actions.map(action => ({
        action,
        score: evaluateAction(state, actorId, opponentId, action)
    }));
    scored.sort((a, b) => b.score - a.score);
    const bestScore = scored[0].score;
    const ties = scored.filter(s => s.score === bestScore).map(s => s.action);
    return chooseFrom(ties, `${seed}:heuristic:${actorId}`, counter);
};

const buildDuelState = (seed: string, leftLoadoutId: ArchetypeLoadoutId, rightLoadoutId: ArchetypeLoadoutId): GameState => {
    const leftLoadout = DEFAULT_LOADOUTS[leftLoadoutId];
    const rightLoadout = DEFAULT_LOADOUTS[rightLoadoutId];
    let state = generateInitialState(1, seed, seed, undefined, leftLoadout);

    // Normalize arena to deterministic flat floor (no hazards, no walls).
    const tiles = new Map(state.tiles);
    for (let q = 0; q < state.gridWidth; q++) {
        for (let r = 0; r < state.gridHeight; r++) {
            const pos: Point = { q, r, s: -q - r };
            tiles.set(pointToKey(pos), {
                baseId: 'STONE',
                position: pos,
                traits: new Set(['WALKABLE']),
                effects: [],
            } as any);
        }
    }

    const left = state.player as Actor;
    const leftApplied = applyLoadoutToPlayer(leftLoadout);
    const leftActor: Actor = ensureActorTrinity(createEntity({
        id: left.id,
        type: 'player',
        position: LEFT_POS,
        hp: left.maxHp,
        maxHp: left.maxHp,
        speed: left.speed || 1,
        factionId: 'player',
        activeSkills: leftApplied.activeSkills,
        archetype: leftLoadout.id as any,
        weightClass: 'Standard',
    }));
    leftActor.previousPosition = LEFT_POS;
    leftActor.statusEffects = [];
    leftActor.temporaryArmor = 0;

    const rightApplied = applyLoadoutToPlayer(rightLoadout);
    const rightActor: Actor = ensureActorTrinity({
        ...createEntity({
            id: 'duelist-right',
            type: 'enemy',
            subtype: rightLoadout.id.toLowerCase(),
            factionId: 'enemy',
            position: RIGHT_POS,
            hp: left.maxHp,
            maxHp: left.maxHp,
            speed: left.speed || 1,
            skills: rightLoadout.startingSkills,
            weightClass: 'Standard',
            activeSkills: rightApplied.activeSkills,
            archetype: rightLoadout.id as any
        }),
        previousPosition: RIGHT_POS,
        statusEffects: [],
        temporaryArmor: 0
    } as Actor);

    state = {
        ...state,
        tiles,
        player: leftActor,
        enemies: [rightActor],
        companions: [],
        gameStatus: 'playing',
        message: [],
        turnsSpent: 0,
        kills: 0,
        hazardBreaches: 0,
        stairsPosition: { q: 0, r: 0, s: 0 },
        shrinePosition: undefined,
        shrineOptions: undefined,
        pendingStatus: undefined,
        visualEvents: [],
        timelineEvents: [],
        initiativeQueue: undefined
    };
    state.occupancyMask = SpatialSystem.refreshOccupancyMask(state);
    return state;
};

export const simulatePvpRun = (
    seed: string,
    leftLoadoutId: ArchetypeLoadoutId,
    rightLoadoutId: ArchetypeLoadoutId,
    leftPolicy: BotPolicy,
    rightPolicy: BotPolicy,
    maxRounds = 60
): PvpRunResult => {
    let state = buildDuelState(seed, leftLoadoutId, rightLoadoutId);
    let counter = 0;
    const leftActionCounts: Record<string, number> = {};
    const rightActionCounts: Record<string, number> = {};
    const leftSkillUsage: Record<string, number> = {};
    const rightSkillUsage: Record<string, number> = {};

    let roundsPlayed = 0;
    for (let round = 0; round < maxRounds; round++) {
        roundsPlayed = round + 1;
        const left = getActorById(state, state.player.id);
        const right = getActorById(state, 'duelist-right');
        if (!left || !right || left.hp <= 0 || right.hp <= 0) break;

        const leftAction = chooseActionForActor(state, left.id, right.id, leftPolicy, seed, counter++);
        incrementHistogram(leftActionCounts, leftAction.kind);
        if (leftAction.kind === 'USE_SKILL' && leftAction.skillId) {
            incrementHistogram(leftSkillUsage, leftAction.skillId);
        }
        state = applyDuelAction(state, left.id, leftAction);

        const rightAfterLeft = getActorById(state, right.id);
        if (!rightAfterLeft || rightAfterLeft.hp <= 0) break;

        const rightAction = chooseActionForActor(state, right.id, state.player.id, rightPolicy, seed, counter++);
        incrementHistogram(rightActionCounts, rightAction.kind);
        if (rightAction.kind === 'USE_SKILL' && rightAction.skillId) {
            incrementHistogram(rightSkillUsage, rightAction.skillId);
        }
        state = applyDuelAction(state, right.id, rightAction);

        const leftAfterRight = getActorById(state, state.player.id);
        if (!leftAfterRight || leftAfterRight.hp <= 0) break;
    }

    const leftFinal = getActorById(state, state.player.id);
    const rightFinal = getActorById(state, 'duelist-right');
    const leftHp = leftFinal?.hp || 0;
    const rightHp = rightFinal?.hp || 0;
    const winner: DuelSide | 'draw' =
        leftHp <= 0 && rightHp <= 0 ? 'draw'
            : leftHp <= 0 ? 'right'
                : rightHp <= 0 ? 'left'
                    : 'draw';

    return {
        seed,
        maxRounds,
        roundsPlayed,
        leftLoadoutId,
        rightLoadoutId,
        leftPolicy,
        rightPolicy,
        winner,
        leftHp,
        rightHp,
        leftActionCounts,
        rightActionCounts,
        leftSkillUsage,
        rightSkillUsage
    };
};

export const runPvpBatch = (
    seeds: string[],
    leftLoadoutId: ArchetypeLoadoutId,
    rightLoadoutId: ArchetypeLoadoutId,
    leftPolicy: BotPolicy,
    rightPolicy: BotPolicy,
    maxRounds = 60
): PvpRunResult[] => {
    return seeds.map(seed => simulatePvpRun(seed, leftLoadoutId, rightLoadoutId, leftPolicy, rightPolicy, maxRounds));
};

export const summarizePvpBatch = (runs: PvpRunResult[]): PvpSummary => {
    const games = runs.length;
    const leftWins = runs.filter(r => r.winner === 'left').length;
    const rightWins = runs.filter(r => r.winner === 'right').length;
    const draws = runs.filter(r => r.winner === 'draw').length;
    const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const leftActionTotals: Record<string, number> = {};
    const rightActionTotals: Record<string, number> = {};
    const leftSkillUsageTotals: Record<string, number> = {};
    const rightSkillUsageTotals: Record<string, number> = {};
    for (const run of runs) {
        mergeHistogram(leftActionTotals, run.leftActionCounts);
        mergeHistogram(rightActionTotals, run.rightActionCounts);
        mergeHistogram(leftSkillUsageTotals, run.leftSkillUsage);
        mergeHistogram(rightSkillUsageTotals, run.rightSkillUsage);
    }
    const leftAvgSkillUsagePerRun: Record<string, number> = {};
    const rightAvgSkillUsagePerRun: Record<string, number> = {};
    const divisor = games || 1;
    for (const [skillId, total] of Object.entries(leftSkillUsageTotals)) {
        leftAvgSkillUsagePerRun[skillId] = total / divisor;
    }
    for (const [skillId, total] of Object.entries(rightSkillUsageTotals)) {
        rightAvgSkillUsagePerRun[skillId] = total / divisor;
    }

    return {
        games,
        leftWins,
        rightWins,
        draws,
        leftWinRate: games ? leftWins / games : 0,
        rightWinRate: games ? rightWins / games : 0,
        drawRate: games ? draws / games : 0,
        avgRounds: avg(runs.map(r => r.roundsPlayed)),
        leftAvgRemainingHp: avg(runs.map(r => r.leftHp)),
        rightAvgRemainingHp: avg(runs.map(r => r.rightHp)),
        leftActionTotals,
        rightActionTotals,
        leftSkillUsageTotals,
        rightSkillUsageTotals,
        leftAvgSkillUsagePerRun,
        rightAvgSkillUsagePerRun
    };
};
