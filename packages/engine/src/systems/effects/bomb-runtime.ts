import { getNeighbors } from '../../hex';
import { BOMB_ACTOR_CONTRACT } from '../../data/hazards/ephemeral-actors';
import { createEntity } from '../entities/entity-factory';
import type { Actor, AtomicEffect, Point, StatusEffect } from '../../types';

export const BOMB_PASSIVE_SKILL_IDS = ['TIME_BOMB', 'VOLATILE_PAYLOAD'] as const;

export const isBombActor = (actor: Actor | null | undefined): actor is Actor =>
    !!actor && actor.subtype === 'bomb';

export const hasVolatilePayload = (actor: Actor | null | undefined): boolean =>
    !!actor?.activeSkills?.some(skill => skill.id === 'VOLATILE_PAYLOAD');

export const buildBombFuseStatus = (duration = BOMB_ACTOR_CONTRACT.fuseTurns): StatusEffect => ({
    id: 'TIME_BOMB',
    type: 'time_bomb',
    duration,
    tickWindow: 'END_OF_TURN'
});

export const createBombActor = (
    id: string,
    position: Point,
    factionId: string
): Actor => {
    const bomb = createEntity({
        id,
        type: 'enemy',
        subtype: 'bomb',
        factionId,
        position,
        hp: 1,
        maxHp: 1,
        speed: BOMB_ACTOR_CONTRACT.speed,
        skills: [...BOMB_PASSIVE_SKILL_IDS],
        weightClass: BOMB_ACTOR_CONTRACT.weightClass,
        armorBurdenTier: BOMB_ACTOR_CONTRACT.armorBurdenTier,
        trinity: BOMB_ACTOR_CONTRACT.trinity
    });
    bomb.statusEffects = [buildBombFuseStatus()];
    return bomb;
};

export const buildBombDetonationEffects = (bomb: Actor): AtomicEffect[] => {
    const blastTiles = getNeighbors(bomb.position);
    return [
        ...blastTiles.map(position => ({
            type: 'Damage' as const,
            target: position,
            amount: 1,
            reason: 'bomb_explosion'
        })),
        {
            type: 'Damage' as const,
            target: bomb.id,
            amount: 999,
            reason: 'bomb_explosion'
        },
        {
            type: 'Juice' as const,
            effect: 'explosion_ring',
            target: bomb.position,
            intensity: 'high' as const,
            metadata: {
                signature: 'ATK.BLAST.FIRE.TIME_BOMB',
                family: 'attack',
                primitive: 'blast',
                phase: 'impact',
                element: 'fire',
                variant: 'time_bomb',
                targetRef: { kind: 'target_hex' },
                skillId: 'TIME_BOMB'
            }
        }
    ];
};
