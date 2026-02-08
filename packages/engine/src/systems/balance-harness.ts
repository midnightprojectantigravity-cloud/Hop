import { gameReducer, generateInitialState } from '../logic';
import type { Action, GameState, Point } from '../types';
import { DEFAULT_LOADOUTS } from './loadout';
import { isPlayerTurn } from './initiative';
import { getNeighbors, hexDistance, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { UnifiedTileService } from './unified-tile-service';
import { randomFromSeed } from './rng';
import { computeScore } from './score';
import { SkillRegistry } from '../skillRegistry';

export type BotPolicy = 'random' | 'heuristic';
export type ArchetypeLoadoutId = keyof typeof DEFAULT_LOADOUTS;

export interface RunResult {
    seed: string;
    policy: BotPolicy;
    loadoutId: ArchetypeLoadoutId;
    result: 'won' | 'lost' | 'timeout';
    turnsSpent: number;
    floor: number;
    kills: number;
    hazardBreaches: number;
    score: number;
}

export interface BatchSummary {
    policy: BotPolicy;
    loadoutId: ArchetypeLoadoutId;
    games: number;
    winRate: number;
    timeoutRate: number;
    avgTurnsToWin: number;
    avgTurnsToLoss: number;
    avgFloor: number;
    avgHazardBreaches: number;
    hazardDeaths: number;
}

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

const isFiremageLoadout = (state: GameState): boolean =>
    !!state.player.activeSkills?.some(s => s.id === 'FIREBALL');

const legalMoves = (state: GameState): Point[] => {
    const origin = state.player.position;
    return getNeighbors(origin)
        .filter(p => p.q >= 0 && p.q < state.gridWidth && p.r >= 0 && p.r < state.gridHeight)
        .filter(p => UnifiedTileService.isWalkable(state, p))
        .filter(p => {
            const occ = getActorAt(state, p);
            return !occ || occ.id !== state.player.id;
        });
};

const isHazardTile = (state: GameState, p: Point): boolean => {
    const tile = UnifiedTileService.getTileAt(state, p);
    if (!tile) return false;
    return tile.traits.has('HAZARDOUS')
        || tile.baseId === 'LAVA'
        || !!tile.effects?.some(e => e.id === 'FIRE' || e.id === 'SNARE');
};

const adjacentHostileCount = (state: GameState, p: Point): number => {
    return state.enemies.filter(e => e.hp > 0 && hexDistance(e.position, p) === 1).length;
};

const sumEnemyHp = (state: GameState): number =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy').reduce((acc, e) => acc + e.hp, 0);

const nearestHostileDistance = (state: GameState): number => {
    const hostiles = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && e.subtype !== 'bomb');
    if (hostiles.length === 0) return 0;
    return hostiles
        .map(e => hexDistance(state.player.position, e.position))
        .sort((a, b) => a - b)[0];
};

const aliveHostiles = (state: GameState): number =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && e.subtype !== 'bomb').length;

const distanceToStairs = (state: GameState): number => {
    if (!state.stairsPosition) return 0;
    return hexDistance(state.player.position, state.stairsPosition);
};

const AGGRESSIVE_WEIGHTS = {
    HAZARD_DAMAGE: -1.0,
    HEALING_RECEIVED: 2.0,
    DAMAGE_DEALT: 5.0,
    KILL_SHOT: 50.0,
    DISTANCE_TO_ENEMY: -0.5,
    ENEMY_CLEARED: 12.0,
    STAIRS_PROGRESS: 2.5,
    FLOOR_PROGRESS: 200.0,
    WAIT_PENALTY: -1.5
} as const;

const buildSkillActions = (state: GameState): Action[] => {
    const actions: Action[] = [];
    const origin = state.player.position;
    for (const skill of (state.player.activeSkills || [])) {
        if ((skill.currentCooldown || 0) > 0) continue;
        if (skill.id === 'AUTO_ATTACK') continue;
        const def = SkillRegistry.get(skill.id);
        if (!def?.getValidTargets) continue;
        const targets = def.getValidTargets(state, origin);
        if (!targets || targets.length === 0) continue;

        // Keep candidate fanout bounded while preserving tactical variety.
        const rankedTargets = targets
            .map(target => {
                const adjacent = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && hexDistance(e.position, target) <= 1).length;
                const direct = enemyAt(state, target) ? 2 : 0;
                return { target, score: direct + adjacent };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(t => t.target);

        for (const target of rankedTargets) {
            actions.push({ type: 'USE_SKILL', payload: { skillId: skill.id, target } });
        }
    }
    return actions;
};

const virtualStep = (state: GameState, action: Action): GameState => {
    const progressed = gameReducer(state, action);
    return resolvePending(progressed);
};

const scoreStateTransition = (prev: GameState, next: GameState, action: Action): number => {
    const hpDiff = (next.player.hp || 0) - (prev.player.hp || 0);
    const hazardDamage = Math.max(0, -hpDiff);
    const healingReceived = Math.max(0, hpDiff);
    const enemyDamage = Math.max(0, sumEnemyHp(prev) - sumEnemyHp(next));
    const killShot = Math.max(0, (next.kills || 0) - (prev.kills || 0));
    const distance = nearestHostileDistance(next);
    const enemiesCleared = Math.max(0, aliveHostiles(prev) - aliveHostiles(next));
    const stairsProgress = Math.max(0, distanceToStairs(prev) - distanceToStairs(next));
    const floorProgress = Math.max(0, (next.floor || 0) - (prev.floor || 0));
    const waitPenalty = action.type === 'WAIT' ? 1 : 0;

    return (
        AGGRESSIVE_WEIGHTS.HAZARD_DAMAGE * hazardDamage
        + AGGRESSIVE_WEIGHTS.HEALING_RECEIVED * healingReceived
        + AGGRESSIVE_WEIGHTS.DAMAGE_DEALT * enemyDamage
        + AGGRESSIVE_WEIGHTS.KILL_SHOT * killShot
        + AGGRESSIVE_WEIGHTS.DISTANCE_TO_ENEMY * distance
        + AGGRESSIVE_WEIGHTS.ENEMY_CLEARED * enemiesCleared
        + AGGRESSIVE_WEIGHTS.STAIRS_PROGRESS * stairsProgress
        + AGGRESSIVE_WEIGHTS.FLOOR_PROGRESS * floorProgress
        + AGGRESSIVE_WEIGHTS.WAIT_PENALTY * waitPenalty
    );
};

const selectByOnePlySimulation = (state: GameState, simSeed: string, decisionCounter: number): Action => {
    const moveActions: Action[] = legalMoves(state).map(m => ({ type: 'MOVE', payload: m }));
    const skillActions = buildSkillActions(state);
    const candidates: Action[] = [{ type: 'WAIT' }, ...moveActions, ...skillActions];

    if (candidates.length === 0) return { type: 'WAIT' };

    const scored = candidates.map(action => ({
        action,
        value: scoreStateTransition(state, virtualStep(state, action), action)
    }));

    scored.sort((a, b) => b.value - a.value);
    const best = scored[0].value;
    const ties = scored.filter(s => s.value === best).map(s => s.action);
    return chooseFrom(ties, `${simSeed}:sim`, decisionCounter);
};

const getReadySkill = (state: GameState, skillId: string) => {
    const skill = state.player.activeSkills?.find(s => s.id === skillId);
    if (!skill) return undefined;
    return (skill.currentCooldown || 0) <= 0 ? skill : undefined;
};

const enemyAt = (state: GameState, p: Point) =>
    state.enemies.find(e => e.hp > 0 && hexEquals(e.position, p));

const pickBestTarget = (targets: Point[], score: (t: Point) => number, seed: string, counter: number): Point | undefined => {
    if (targets.length === 0) return undefined;
    const ranked = targets.map(t => ({ t, s: score(t) })).sort((a, b) => b.s - a.s);
    const best = ranked[0].s;
    const ties = ranked.filter(x => x.s === best).map(x => x.t);
    return chooseFrom(ties, seed, counter);
};

const chooseSkillAction = (state: GameState, simSeed: string, decisionCounter: number): Action | null => {
    const origin = state.player.position;
    const adjacentEnemy = state.enemies.find(e => e.hp > 0 && e.subtype !== 'bomb' && hexDistance(origin, e.position) === 1);

    // Always convert immediate adjacency into direct attack first.
    if (adjacentEnemy && getReadySkill(state, 'BASIC_ATTACK')) {
        return { type: 'USE_SKILL', payload: { skillId: 'BASIC_ATTACK', target: adjacentEnemy.position } };
    }

    // Firemage priority: value AoE pressure before melee.
    if (getReadySkill(state, 'FIREBALL')) {
        const def = SkillRegistry.get('FIREBALL');
        const targets = def?.getValidTargets ? def.getValidTargets(state, origin) : [];
        const best = pickBestTarget(targets, (t) => {
            const direct = enemyAt(state, t) ? 2 : 0;
            const splash = state.enemies.filter(e => e.hp > 0 && hexDistance(e.position, t) <= 1).length;
            return direct + splash;
        }, simSeed, decisionCounter);
        const bestScore = best
            ? ((enemyAt(state, best) ? 2 : 0) + state.enemies.filter(e => e.hp > 0 && hexDistance(e.position, best) <= 1).length)
            : 0;
        if (best && bestScore >= 2) {
            return { type: 'USE_SKILL', payload: { skillId: 'FIREBALL', target: best } };
        }
    }

    if (getReadySkill(state, 'FIREWALL')) {
        const def = SkillRegistry.get('FIREWALL');
        const targets = def?.getValidTargets ? def.getValidTargets(state, origin) : [];
        const best = pickBestTarget(targets, (t) => {
            // Coarse value: targets with multiple enemies nearby are good firewall anchors.
            return state.enemies.filter(e => e.hp > 0 && hexDistance(e.position, t) <= 2).length;
        }, simSeed, decisionCounter);
        const bestScore = best
            ? state.enemies.filter(e => e.hp > 0 && hexDistance(e.position, best) <= 2).length
            : 0;
        if (best && bestScore >= 3) {
            return { type: 'USE_SKILL', payload: { skillId: 'FIREWALL', target: best } };
        }
    }

    if (getReadySkill(state, 'SPEAR_THROW')) {
        const def = SkillRegistry.get('SPEAR_THROW');
        const targets = def?.getValidTargets ? def.getValidTargets(state, origin) : [];
        const best = pickBestTarget(targets, (t) => (enemyAt(state, t) ? 1 : 0), simSeed, decisionCounter);
        if (best && enemyAt(state, best)) {
            return { type: 'USE_SKILL', payload: { skillId: 'SPEAR_THROW', target: best } };
        }
    }

    return null;
};

const selectAction = (state: GameState, policy: BotPolicy, simSeed: string, decisionCounter: number): Action => {
    const moves = legalMoves(state);
    if (moves.length === 0) {
        return { type: 'WAIT' };
    }

    if (policy === 'random') {
        const options: Action[] = [{ type: 'WAIT' }, ...moves.map(m => ({ type: 'MOVE' as const, payload: m }))];
        return chooseFrom(options, simSeed, decisionCounter);
    }

    if (isFiremageLoadout(state)) {
        return selectByOnePlySimulation(state, simSeed, decisionCounter);
    }

    const skillAction = chooseSkillAction(state, simSeed, decisionCounter);
    if (skillAction) {
        return skillAction;
    }

    const nearestEnemy = state.enemies
        .filter(e => e.hp > 0 && e.subtype !== 'bomb')
        .sort((a, b) => hexDistance(state.player.position, a.position) - hexDistance(state.player.position, b.position))[0];

    if (!nearestEnemy) {
        if (state.stairsPosition) {
            const towardStairs = moves
                .map(move => ({
                    move,
                    score: (hexDistance(move, state.stairsPosition as Point) * 10)
                        + (isHazardTile(state, move) ? 120 : 0)
                        + (adjacentHostileCount(state, move) * 4)
                }))
                .sort((a, b) => a.score - b.score);
            const best = towardStairs[0]?.score;
            const ties = towardStairs.filter(m => m.score === best).map(m => m.move);
            if (ties.length > 0) {
                return { type: 'MOVE', payload: chooseFrom(ties, simSeed, decisionCounter) };
            }
        }
        return { type: 'WAIT' };
    }

    const currentHazard = isHazardTile(state, state.player.position) ? 1 : 0;
    const candidates: Array<{ action: Action; score: number }> = [
        {
            action: { type: 'WAIT' },
            score: (hexDistance(state.player.position, nearestEnemy.position) * 10)
                + (currentHazard * 120)
                + (adjacentHostileCount(state, state.player.position) * 6)
        },
        ...moves.map(move => {
            const distanceScore = hexDistance(move, nearestEnemy.position) * 10;
            const hazardPenalty = isHazardTile(state, move) ? 120 : 0;
            const pressurePenalty = adjacentHostileCount(state, move) * 6;
            const score = distanceScore + hazardPenalty + pressurePenalty;
            return { action: { type: 'MOVE', payload: move } as Action, score };
        })
    ];

    candidates.sort((a, b) => a.score - b.score);
    const bestScore = candidates[0].score;
    const tiedBest = candidates.filter(c => c.score === bestScore).map(c => c.action);
    return chooseFrom(tiedBest, simSeed, decisionCounter);
};

export const simulateRun = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD'
): RunResult => {
    let state = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS[loadoutId]);
    let decisionCounter = 0;
    let guard = 0;

    while (state.gameStatus === 'playing' && guard < 2000) {
        guard++;
        if (state.turnsSpent >= maxTurns) {
            break;
        }

        if (isPlayerTurn(state)) {
            const action = selectAction(state, policy, `${seed}:${policy}`, decisionCounter++);
            state = gameReducer(state, action);
            state = resolvePending(state);
        } else {
            state = gameReducer(state, { type: 'ADVANCE_TURN' });
            state = resolvePending(state);
        }
    }

    const result: RunResult['result'] = state.gameStatus === 'won'
        ? 'won'
        : (state.gameStatus === 'lost' ? 'lost' : 'timeout');

    return {
        seed,
        policy,
        loadoutId,
        result,
        turnsSpent: state.turnsSpent || 0,
        floor: state.floor,
        kills: state.kills || 0,
        hazardBreaches: state.hazardBreaches || 0,
        score: computeScore(state)
    };
};

export const runBatch = (
    seeds: string[],
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD'
): RunResult[] => {
    return seeds.map(seed => simulateRun(seed, policy, maxTurns, loadoutId));
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
    return {
        policy,
        loadoutId,
        games: results.length,
        winRate: results.length ? wins.length / results.length : 0,
        timeoutRate: results.length ? timeouts.length / results.length : 0,
        avgTurnsToWin: avg(wins.map(r => r.turnsSpent)),
        avgTurnsToLoss: avg(losses.map(r => r.turnsSpent)),
        avgFloor: avg(results.map(r => r.floor || 0)),
        avgHazardBreaches: avg(results.map(r => r.hazardBreaches)),
        hazardDeaths: losses.filter(r => r.hazardBreaches > 0).length
    };
};
