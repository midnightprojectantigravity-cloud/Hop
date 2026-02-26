import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { stableIdFromSeed } from '../systems/rng';
import { createCompanion } from '../systems/entities/entity-factory';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { resolveSummonPlacement } from '../systems/summon-placement';

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

        const placement = resolveSummonPlacement(state, attacker, target, 'push_friendly');
        if (!placement.ok) {
            return { effects, messages: [placement.failureMessage || 'Target tile occupied.'], consumesTurn: false };
        }
        effects.push(...placement.effects);
        messages.push(...placement.messages);

        // 1. Remove the corpse
        effects.push({ type: 'RemoveCorpse', position: target });

        // 2. Spawn Skeleton
        const skeleton: Actor = createCompanion({
            companionType: 'skeleton',
            ownerId: attacker.id,
            id: createUniqueSkeletonId(state),
            position: target,
        });

        effects.push({ type: 'SpawnActor', actor: skeleton });

        effects.push({
            type: 'Juice',
            effect: 'flash',
            target,
            color: '#aaaaaa',
            metadata: {
                signature: 'STATE.SPAWN.VOID.RAISE_DEAD',
                family: 'status',
                primitive: 'spawn',
                phase: 'impact',
                element: 'void',
                variant: 'raise_dead',
                targetRef: { kind: 'target_hex' },
                skillId: 'RAISE_DEAD'
            }
        });
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
            const placement = resolveSummonPlacement(state, actor, target, 'push_friendly');
            return placement.ok;
        });
    },
    upgrades: {},
    scenarios: getSkillScenarios('RAISE_DEAD')
};
