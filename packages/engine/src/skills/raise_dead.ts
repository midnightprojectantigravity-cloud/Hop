import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getNeighbors } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { stableIdFromSeed } from '../systems/rng';
import { createEntity } from '../systems/entity-factory';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { UnifiedTileService } from '../systems/unified-tile-service';

const hasCorpseAt = (state: GameState, target: Point): boolean => {
    const tile = state.tiles.get(pointToKey(target));
    return !!tile?.traits?.has('CORPSE');
};

const getCorpseTargetsInRange = (state: GameState, origin: Point, range: number): Point[] => {
    const targets: Point[] = [];
    state.tiles.forEach(tile => {
        if (tile.traits.has('CORPSE') && hexDistance(origin, tile.position) <= range) {
            targets.push(tile.position);
        }
    });
    return targets;
};

const inBounds = (state: GameState, p: Point): boolean =>
    p.q >= 0 && p.q < state.gridWidth && p.r >= 0 && p.r < state.gridHeight;

const findPushDestination = (state: GameState, attacker: Actor, origin: Point): Point | null => {
    const options = getNeighbors(origin)
        .filter(p => inBounds(state, p))
        .filter(p => UnifiedTileService.isWalkable(state, p))
        .filter(p => !getActorAt(state, p))
        .sort((a, b) => {
            const da = hexDistance(a, attacker.position);
            const db = hexDistance(b, attacker.position);
            if (da !== db) return da - db;
            if (a.q !== b.q) return a.q - b.q;
            return a.r - b.r;
        });
    return options[0] || null;
};

const isPushableAlly = (attacker: Actor, occupant: Actor): boolean => {
    if (occupant.id === attacker.id) return false;
    if (occupant.factionId !== attacker.factionId) return false;
    return true;
};

const createUniqueSkeletonId = (state: GameState): string => {
    const seed = state.initialSeed ?? state.rngSeed ?? '0';
    const existingIds = new Set<string>([
        ...state.enemies.map(e => e.id),
        ...(state.companions || []).map(c => c.id)
    ]);

    // Include floor so the first summon on each floor cannot collide after migration.
    let counter = (state.floor << 20)
        + (state.turnNumber << 12)
        + (state.actionLog?.length ?? 0)
        + (state.rngCounter ?? 0);
    let candidate = `skeleton_${stableIdFromSeed(seed, counter, 8, 'skeleton')}`;

    while (existingIds.has(candidate)) {
        counter += 1;
        candidate = `skeleton_${stableIdFromSeed(seed, counter, 8, 'skeleton')}`;
    }
    return candidate;
};

/**
 * RAISE_DEAD Skill
 * Reanimate a corpse into a Skeleton minion.
 */
export const RAISE_DEAD: SkillDefinition = {
    id: 'RAISE_DEAD',
    name: 'Raise Dead',
    description: 'Reanimate a target corpse into a Skeleton minion (Faction: Player).',
    slot: 'utility',
    icon: '💀✨',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 3,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const hasCorpse = hasCorpseAt(state, target);
        if (!hasCorpse) {
            return { effects, messages: ['A corpse is required!'], consumesTurn: false };
        }

        if (!validateRange(attacker.position, target, 4)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }

        const occupant = getActorAt(state, target) as Actor | undefined;
        if (occupant) {
            if (!isPushableAlly(attacker, occupant)) {
                return { effects, messages: ['Target tile occupied.'], consumesTurn: false };
            }
            const pushDestination = findPushDestination(state, attacker, target);
            if (!pushDestination) {
                return { effects, messages: ['No space to reposition ally.'], consumesTurn: false };
            }
            effects.push({
                type: 'Displacement',
                target: occupant.id,
                destination: pushDestination,
                source: occupant.position,
                simulatePath: true
            });
            messages.push('Ally repositions to make room.');
        }

        // 1. Remove the corpse
        effects.push({ type: 'RemoveCorpse', position: target });

        // 2. Spawn Skeleton
        const skeleton: Actor = createEntity({
            id: createUniqueSkeletonId(state),
            type: 'enemy', // Technical type for initiative entry sorting
            subtype: 'skeleton',
            factionId: 'player', // CRITICAL: Friendly to player
            companionOf: attacker.id,
            position: target,
            hp: 2,
            maxHp: 2,
            speed: 50,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK', 'AUTO_ATTACK'],
            weightClass: 'Standard'
        });

        effects.push({ type: 'SpawnActor', actor: skeleton });

        effects.push({ type: 'Juice', effect: 'flash', target, color: '#aaaaaa' });
        messages.push("Skeleton raised!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const actor = getActorAt(state, origin) as Actor | undefined;
        if (!actor) return [];
        return getCorpseTargetsInRange(state, origin, 4).filter(target => {
            const occupant = getActorAt(state, target) as Actor | undefined;
            if (!occupant) return true;
            if (!isPushableAlly(actor, occupant)) return false;
            return !!findPushDestination(state, actor, target);
        });
    },
    upgrades: {},
    scenarios: getSkillScenarios('RAISE_DEAD')
};
