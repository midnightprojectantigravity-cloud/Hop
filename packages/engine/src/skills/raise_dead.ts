import type {
    AiBehaviorOverlayInstance,
    AtomicEffect,
    GameState,
    Point,
    SkillDefinition,
    SkillSummonDefinition,
    Actor
} from '../types';
import { hexDistance } from '../hex';
import { validateRange } from '../systems/validation';
import { createCompanion } from '../systems/entities/entity-factory';
import { createRaiseDeadSkeletonId } from '../systems/entities/companion-id-strategies';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { resolveSummonPlacement } from '../systems/summon-placement';

const RAISE_DEAD_SUMMON_OVERLAY: AiBehaviorOverlayInstance = {
    id: 'raise_dead_skeleton',
    source: 'summon',
    sourceId: 'raise_dead',
    desiredRange: 1,
    offenseBias: 0.1,
    commitBias: 0.15,
    followThroughBias: 0.1
};

const RAISE_DEAD_SUMMON: SkillSummonDefinition = {
    companionType: 'skeleton',
    visualAssetRef: '/Hop/assets/bestiary/unit.skeleton.basic.01.webp',
    trinity: { body: 12, mind: 2, instinct: 4 },
    skills: ['BASIC_MOVE', 'BASIC_ATTACK', 'AUTO_ATTACK'],
    behavior: {
        controller: 'generic_ai',
        anchorActorId: 'owner',
        overlays: [RAISE_DEAD_SUMMON_OVERLAY]
    }
};

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

/**
 * RAISE_DEAD Skill
 * Reanimate a corpse into a Skeleton minion.
 */
export const RAISE_DEAD: SkillDefinition = {
    id: 'RAISE_DEAD',
    name: 'Raise Dead',
    description: 'Reanimate a target corpse into an owner-aligned Skeleton minion.',
    slot: 'utility',
    icon: '💀✨',
    deathDecalVariant: 'bones',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 3,
    },
    summon: RAISE_DEAD_SUMMON,
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
            ownerFactionId: attacker.factionId,
            id: createRaiseDeadSkeletonId(state),
            position: target,
            summon: RAISE_DEAD_SUMMON,
            initialAnchorActorId: attacker.id
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
};
