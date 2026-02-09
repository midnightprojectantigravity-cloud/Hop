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
const isNecromancerLoadout = (state: GameState): boolean =>
    !!state.player.activeSkills?.some(s => s.id === 'RAISE_DEAD');

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

const aliveHostilesList = (state: GameState) =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && e.subtype !== 'bomb');

const skeletonCount = (state: GameState): number =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'player' && e.subtype === 'skeleton').length;

const aliveHostiles = (state: GameState): number =>
    state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy' && e.subtype !== 'bomb').length;

const distanceToStairs = (state: GameState): number => {
    if (!state.stairsPosition) return 0;
    return hexDistance(state.player.position, state.stairsPosition);
};

const distanceToShrine = (state: GameState): number => {
    if (!state.shrinePosition) return 0;
    return hexDistance(state.player.position, state.shrinePosition);
};

const AGGRESSIVE_WEIGHTS = {
    HAZARD_DAMAGE: -0.5,
    HEALING_RECEIVED: 2.5,
    DAMAGE_DEALT: 12.0,
    KILL_SHOT: 200.0,
    DISTANCE_TO_ENEMY: -0.2,
    ENEMY_APPROACH_PROGRESS: 4.0,
    ENEMY_CLEARED: 90.0,
    STAIRS_PROGRESS: 1.2,
    SHRINE_PROGRESS: 1.5,
    FLOOR_PROGRESS: 600.0,
    WAIT_PENALTY: -5.0,
    NO_PROGRESS_PENALTY: -8.0,
    FIREWALK_NO_PROGRESS_PENALTY: -20.0
} as const;

const buildSkillActions = (state: GameState): Action[] => {
    const actions: Action[] = [];
    const origin = state.player.position;
    for (const skill of (state.player.activeSkills || [])) {
        if ((skill.currentCooldown || 0) > 0) continue;
        if (skill.id === 'AUTO_ATTACK') continue;
        // FIREWALK creates frequent low-value loops in harness policy; keep focus on kill/progress actions.
        if (skill.id === 'FIREWALK') continue;
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

type TransitionMetrics = {
    hazardDamage: number;
    healingReceived: number;
    enemyDamage: number;
    killShot: number;
    distanceToEnemy: number;
    enemyApproachProgress: number;
    enemiesCleared: number;
    stairsProgress: number;
    shrineProgress: number;
    floorProgress: number;
    waitPenalty: number;
    noProgressPenalty: number;
    firewalkNoProgressPenalty: number;
};

const transitionMetrics = (prev: GameState, next: GameState, action: Action): TransitionMetrics => {
    const hpDiff = (next.player.hp || 0) - (prev.player.hp || 0);
    const hazardDamage = Math.max(0, -hpDiff);
    const healingReceived = Math.max(0, hpDiff);
    const enemyDamage = Math.max(0, sumEnemyHp(prev) - sumEnemyHp(next));
    const killShot = Math.max(0, (next.kills || 0) - (prev.kills || 0));
    const prevDistanceToEnemy = nearestHostileDistance(prev);
    const distanceToEnemy = nearestHostileDistance(next);
    const enemyApproachProgress = Math.max(0, prevDistanceToEnemy - distanceToEnemy);
    const previousHostiles = aliveHostiles(prev);
    const enemiesCleared = Math.max(0, aliveHostiles(prev) - aliveHostiles(next));
    const isCombatOngoing = previousHostiles > 0;
    const stairsProgressRaw = Math.max(0, distanceToStairs(prev) - distanceToStairs(next));
    const shrineProgressRaw = Math.max(0, distanceToShrine(prev) - distanceToShrine(next));
    // Prioritize killing while enemies remain; prioritize progression once floor is clear.
    const stairsProgress = isCombatOngoing ? 0 : stairsProgressRaw;
    const shrineProgress = isCombatOngoing ? 0 : shrineProgressRaw;
    const floorProgress = Math.max(0, (next.floor || 0) - (prev.floor || 0));
    const waitPenalty = action.type === 'WAIT' ? 1 : 0;
    const noProgress = enemyDamage === 0
        && killShot === 0
        && enemiesCleared === 0
        && enemyApproachProgress === 0
        && stairsProgress === 0
        && shrineProgress === 0
        && floorProgress === 0;
    const noProgressPenalty = noProgress ? 1 : 0;
    const firewalkNoProgressPenalty = action.type === 'USE_SKILL'
        && action.payload.skillId === 'FIREWALK'
        && noProgress
        ? 1
        : 0;

    return {
        hazardDamage,
        healingReceived,
        enemyDamage,
        killShot,
        distanceToEnemy,
        enemyApproachProgress,
        enemiesCleared,
        stairsProgress,
        shrineProgress,
        floorProgress,
        waitPenalty,
        noProgressPenalty,
        firewalkNoProgressPenalty
    };
};

const scoreStateTransition = (m: TransitionMetrics): number => {
    return (
        AGGRESSIVE_WEIGHTS.HAZARD_DAMAGE * m.hazardDamage
        + AGGRESSIVE_WEIGHTS.HEALING_RECEIVED * m.healingReceived
        + AGGRESSIVE_WEIGHTS.DAMAGE_DEALT * m.enemyDamage
        + AGGRESSIVE_WEIGHTS.KILL_SHOT * m.killShot
        + AGGRESSIVE_WEIGHTS.DISTANCE_TO_ENEMY * m.distanceToEnemy
        + AGGRESSIVE_WEIGHTS.ENEMY_APPROACH_PROGRESS * m.enemyApproachProgress
        + AGGRESSIVE_WEIGHTS.ENEMY_CLEARED * m.enemiesCleared
        + AGGRESSIVE_WEIGHTS.STAIRS_PROGRESS * m.stairsProgress
        + AGGRESSIVE_WEIGHTS.SHRINE_PROGRESS * m.shrineProgress
        + AGGRESSIVE_WEIGHTS.FLOOR_PROGRESS * m.floorProgress
        + AGGRESSIVE_WEIGHTS.WAIT_PENALTY * m.waitPenalty
        + AGGRESSIVE_WEIGHTS.NO_PROGRESS_PENALTY * m.noProgressPenalty
        + AGGRESSIVE_WEIGHTS.FIREWALK_NO_PROGRESS_PENALTY * m.firewalkNoProgressPenalty
    );
};

const selectByOnePlySimulation = (state: GameState, simSeed: string, decisionCounter: number): Action => {
    const moveActions: Action[] = legalMoves(state).map(m => ({ type: 'MOVE', payload: m }));
    const skillActions = buildSkillActions(state);
    const rawCandidates: Action[] = [{ type: 'WAIT' }, ...moveActions, ...skillActions];
    const hasHostiles = aliveHostiles(state) > 0;
    const candidates = hasHostiles
        ? rawCandidates.filter(a => a.type !== 'WAIT' || rawCandidates.length === 1)
        : rawCandidates;

    if (candidates.length === 0) return { type: 'WAIT' };

    const scored = candidates.map(action => {
        const next = virtualStep(state, action);
        const metrics = transitionMetrics(state, next, action);
        return { action, value: scoreStateTransition(metrics), metrics };
    });
    const pickBest = (entries: typeof scored): Action => {
        entries.sort((a, b) => b.value - a.value);
        const best = entries[0].value;
        const ties = entries.filter(s => s.value === best).map(s => s.action);
        return chooseFrom(ties, `${simSeed}:sim`, decisionCounter);
    };

    // Hard tactical bias: if any action kills, choose among killers.
    const killers = scored.filter(s => s.metrics.killShot > 0 || s.metrics.enemiesCleared > 0);
    if (killers.length > 0) {
        return pickBest(killers);
    }

    // In-combat policy: force immediate damage before setup/dancing.
    if (hasHostiles) {
        const damaging = scored.filter(s => s.metrics.enemyDamage > 0);
        if (damaging.length > 0) {
            return pickBest(damaging);
        }

        // If no immediate damage is available, force distance closing moves.
        const advancing = scored
            .filter(s => s.action.type === 'MOVE' && s.metrics.enemyApproachProgress > 0)
            .sort((a, b) => {
                if (b.metrics.enemyApproachProgress !== a.metrics.enemyApproachProgress) {
                    return b.metrics.enemyApproachProgress - a.metrics.enemyApproachProgress;
                }
                return b.value - a.value;
            });
        if (advancing.length > 0) {
            return pickBest(advancing);
        }
    }

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
            const direct = enemyAt(state, t) ? 10 : 0;
            const splash = state.enemies.filter(e => e.hp > 0 && hexDistance(e.position, t) <= 1).length;
            return direct + splash;
        }, simSeed, decisionCounter);
        const bestScore = best
            ? ((enemyAt(state, best) ? 10 : 0) + state.enemies.filter(e => e.hp > 0 && hexDistance(e.position, best) <= 1).length)
            : 0;
        if (best && bestScore >= 1) {
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

const chooseNecromancerAction = (state: GameState, simSeed: string, decisionCounter: number, moves: Point[]): Action | null => {
    const origin = state.player.position;
    const hostiles = aliveHostilesList(state);
    const nearestHostile = hostiles
        .slice()
        .sort((a, b) => hexDistance(origin, a.position) - hexDistance(origin, b.position))[0];
    const skCount = skeletonCount(state);
    const openingPhase = (state.kills || 0) === 0;

    const basicAttack = getReadySkill(state, 'BASIC_ATTACK');
    const raiseDead = getReadySkill(state, 'RAISE_DEAD');
    const soulSwap = getReadySkill(state, 'SOUL_SWAP');

    const adjacentHostile = hostiles
        .slice()
        .sort((a, b) => (a.hp - b.hp) || (hexDistance(origin, a.position) - hexDistance(origin, b.position)))[0];
    const adjacent = adjacentHostile && hexDistance(origin, adjacentHostile.position) === 1 ? adjacentHostile : null;

    // 1) Open with direct basic attack pressure until first kill.
    if (openingPhase && adjacent && basicAttack) {
        return { type: 'USE_SKILL', payload: { skillId: 'BASIC_ATTACK', target: adjacent.position } };
    }

    // 2) Core plan: prioritize Raise Dead up to six skeletons.
    if (skCount < 6 && raiseDead) {
        const def = SkillRegistry.get('RAISE_DEAD');
        const targets = def?.getValidTargets ? def.getValidTargets(state, origin) : [];
        if (targets.length > 0) {
            const best = pickBestTarget(
                targets,
                (t) => {
                    const hostileProximity = hostiles.filter(h => hexDistance(h.position, t) <= 2).length;
                    return (hostileProximity * 5) - hexDistance(origin, t);
                },
                `${simSeed}:necro-raise`,
                decisionCounter
            );
            if (best) {
                return { type: 'USE_SKILL', payload: { skillId: 'RAISE_DEAD', target: best } };
            }
        }
    }

    // 3) Emergency safety: swap only under real pressure.
    const adjacentPressure = adjacentHostileCount(state, origin);
    const pressured = (state.player.hp || 0) <= Math.max(2, Math.floor((state.player.maxHp || 1) * 0.4))
        && (adjacentPressure >= 2 || isHazardTile(state, origin));
    if (pressured && soulSwap) {
        const def = SkillRegistry.get('SOUL_SWAP');
        const targets = def?.getValidTargets ? def.getValidTargets(state, origin) : [];
        const best = pickBestTarget(
            targets,
            (t) => {
                const hazardPenalty = isHazardTile(state, t) ? 100 : 0;
                const pressurePenalty = adjacentHostileCount(state, t) * 8;
                const dist = nearestHostile
                    ? hexDistance(t, nearestHostile.position)
                    : 0;
                return dist * 4 - hazardPenalty - pressurePenalty;
            },
            `${simSeed}:necro-swap`,
            decisionCounter
        );
        if (best) {
            return { type: 'USE_SKILL', payload: { skillId: 'SOUL_SWAP', target: best } };
        }
    }

    // Optional conversion: if we already have a bone line and can clip multiple enemies, explode.
    if (skCount >= 3 && getReadySkill(state, 'CORPSE_EXPLOSION')) {
        const def = SkillRegistry.get('CORPSE_EXPLOSION');
        const targets = def?.getValidTargets ? def.getValidTargets(state, origin) : [];
        const best = pickBestTarget(
            targets,
            (t) => hostiles.filter(h => hexDistance(h.position, t) <= 1).length * 10 - hexDistance(origin, t),
            `${simSeed}:necro-boom`,
            decisionCounter
        );
        const density = best ? hostiles.filter(h => hexDistance(h.position, best) <= 1).length : 0;
        if (best && density >= 2) {
            return { type: 'USE_SKILL', payload: { skillId: 'CORPSE_EXPLOSION', target: best } };
        }
    }

    // 4) During opener, force approach to secure first kill.
    if (openingPhase && nearestHostile && moves.length > 0) {
        const towardKill = moves
            .map(move => ({
                move,
                score: (hexDistance(move, nearestHostile.position) * 10)
                    + (isHazardTile(state, move) ? 120 : 0)
                    + (adjacentHostileCount(state, move) * 5)
            }))
            .sort((a, b) => a.score - b.score);
        const best = towardKill[0]?.score;
        const ties = towardKill.filter(m => m.score === best).map(m => m.move);
        if (ties.length > 0) {
            return { type: 'MOVE', payload: chooseFrom(ties, `${simSeed}:necro-open`, decisionCounter) };
        }
    }

    // 4.1) If opener is done and no summon action is available, avoid melee loops and reposition safely.
    if (!openingPhase && moves.length > 0) {
        const disengage = moves
            .map(move => {
                const hazardPenalty = isHazardTile(state, move) ? 120 : 0;
                const pressurePenalty = adjacentHostileCount(state, move) * 12;
                const dist = nearestHostile ? hexDistance(move, nearestHostile.position) : 0;
                const shrineBias = state.shrinePosition ? hexDistance(move, state.shrinePosition) : 0;
                // Lower score is better: prioritize safety and slight shrine pull.
                const score = hazardPenalty + pressurePenalty - (dist * 6) + shrineBias;
                return { move, score };
            })
            .sort((a, b) => a.score - b.score);
        const best = disengage[0]?.score;
        const ties = disengage.filter(m => m.score === best).map(m => m.move);
        if (ties.length > 0) {
            return { type: 'MOVE', payload: chooseFrom(ties, `${simSeed}:necro-disengage`, decisionCounter) };
        }
    }

    // 5) Army phase: mostly move safely, prefer shrine when injured, then stairs.
    if (moves.length > 0) {
        const progressionTarget = ((state.player.hp || 0) < (state.player.maxHp || 0) && state.shrinePosition)
            ? state.shrinePosition
            : (state.stairsPosition ?? state.shrinePosition);
        const hasHostiles = hostiles.length > 0;

        const safeMoves = moves
            .map(move => {
                const hazardPenalty = isHazardTile(state, move) ? 120 : 0;
                const pressurePenalty = adjacentHostileCount(state, move) * 10;
                const distanceFromHostiles = nearestHostile ? hexDistance(move, nearestHostile.position) : 0;
                const progressionPenalty = progressionTarget ? hexDistance(move, progressionTarget) * (hasHostiles ? 1 : 5) : 0;
                // Lower score is better. Favor safety strongly, then progression.
                const score = hazardPenalty + pressurePenalty - (distanceFromHostiles * (hasHostiles ? 2 : 1)) + progressionPenalty;
                return { move, score };
            })
            .sort((a, b) => a.score - b.score);
        const best = safeMoves[0]?.score;
        const ties = safeMoves.filter(m => m.score === best).map(m => m.move);
        if (ties.length > 0) {
            return { type: 'MOVE', payload: chooseFrom(ties, `${simSeed}:necro-safe`, decisionCounter) };
        }
    }

    return { type: 'WAIT' };
};

const selectAction = (state: GameState, policy: BotPolicy, simSeed: string, decisionCounter: number): Action => {
    const moves = legalMoves(state);

    if (policy === 'random') {
        const options: Action[] = [{ type: 'WAIT' }, ...moves.map(m => ({ type: 'MOVE' as const, payload: m }))];
        return chooseFrom(options, simSeed, decisionCounter);
    }

    if (isNecromancerLoadout(state)) {
        const necroAction = chooseNecromancerAction(state, simSeed, decisionCounter, moves);
        return necroAction || { type: 'WAIT' };
    }

    const skillAction = chooseSkillAction(state, simSeed, decisionCounter);
    if (skillAction) {
        return skillAction;
    }
    if (moves.length === 0) {
        return { type: 'WAIT' };
    }

    const nearestEnemy = state.enemies
        .filter(e => e.hp > 0 && e.subtype !== 'bomb')
        .sort((a, b) => hexDistance(state.player.position, a.position) - hexDistance(state.player.position, b.position))[0];

    if (!nearestEnemy) {
        const progressionTarget = state.shrinePosition ?? state.stairsPosition;
        if (progressionTarget) {
            const towardStairs = moves
                .map(move => ({
                    move,
                    score: (hexDistance(move, progressionTarget as Point) * 10)
                        + (state.player.previousPosition && hexEquals(move, state.player.previousPosition) ? 20 : 0)
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
    if (isFiremageLoadout(state)) {
        const chaseMoves = moves
            .map(move => ({
                move,
                score: (hexDistance(move, nearestEnemy.position) * 10)
                    + (state.player.previousPosition && hexEquals(move, state.player.previousPosition) ? 5 : 0)
            }))
            .sort((a, b) => a.score - b.score);
        const best = chaseMoves[0]?.score;
        const ties = chaseMoves.filter(m => m.score === best).map(m => m.move);
        if (ties.length > 0) {
            return { type: 'MOVE', payload: chooseFrom(ties, simSeed, decisionCounter) };
        }
    }

    const candidates: Array<{ action: Action; score: number }> = moves.map(move => {
            const distanceScore = hexDistance(move, nearestEnemy.position) * 10;
            const hazardPenalty = isHazardTile(state, move) ? 120 : 0;
            const pressurePenalty = adjacentHostileCount(state, move) * 6;
            const backtrackPenalty = state.player.previousPosition && hexEquals(move, state.player.previousPosition) ? 20 : 0;
            const score = distanceScore + hazardPenalty + pressurePenalty + backtrackPenalty;
            return { action: { type: 'MOVE', payload: move } as Action, score };
        });

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

    while (state.gameStatus !== 'won' && state.gameStatus !== 'lost' && guard < 4000) {
        guard++;
        if (state.turnsSpent >= maxTurns) {
            break;
        }

        if (state.gameStatus === 'choosing_upgrade') {
            const options = state.shrineOptions || [];
            const option = (loadoutId === 'NECROMANCER' && options.includes('EXTRA_HP'))
                ? 'EXTRA_HP'
                : (options[0] || 'EXTRA_HP');
            state = gameReducer(state, { type: 'SELECT_UPGRADE', payload: option });
            state = resolvePending(state);
            continue;
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
