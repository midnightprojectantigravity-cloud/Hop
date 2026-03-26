import { hexEquals } from '../../hex';
import type { Actor } from '../../types';
import { applyDamage } from '../entities/actor';
import { stableIdFromSeed } from '../rng';
import { createBombActor } from './bomb-runtime';
import type { AtomicEffectHandlerMap } from './types';

export const itemHazardEffectHandlers: AtomicEffectHandlerMap = {
    PickupShield: (state, effect) => {
        let nextState = { ...state };
        const pickupPos = effect.position || nextState.shieldPosition;
        if (pickupPos && nextState.shieldPosition && hexEquals(nextState.shieldPosition, pickupPos)) {
            nextState.hasShield = true;
            nextState.shieldPosition = undefined;

            const bulwarkSkill: any = {
                id: 'BULWARK_CHARGE',
                name: 'Bulwark Charge',
                description: 'Shield Bash.',
                slot: 'utility',
                cooldown: 3,
                currentCooldown: 0,
                range: 1,
                upgrades: [],
                activeUpgrades: []
            };

            if (!nextState.player.activeSkills.some(s => s.id === 'BULWARK_CHARGE')) {
                nextState.player = {
                    ...nextState.player,
                    activeSkills: [...nextState.player.activeSkills, bulwarkSkill]
                };
            }
        }
        return nextState;
    },
    PickupSpear: (state, effect) => {
        let nextState = { ...state };
        const pickupPos = effect.position || nextState.spearPosition;
        if (pickupPos && nextState.spearPosition && hexEquals(nextState.spearPosition, pickupPos)) {
            nextState.hasSpear = true;
            nextState.spearPosition = undefined;
        }
        return nextState;
    },
    SpawnItem: (state, effect, context) => {
        let nextState = { ...state };
        if (effect.itemType === 'spear') {
            nextState.spearPosition = effect.position;
            if (context.sourceId === nextState.player.id) {
                nextState.hasSpear = false;
            }
            return nextState;
        }

        if (effect.itemType === 'bomb') {
            const seed = nextState.initialSeed ?? nextState.rngSeed ?? '0';
            const counter = (nextState.turnNumber << 16)
                + (nextState.actionLog?.length ?? 0)
                + nextState.enemies.length;
            const bombId = `bomb-${stableIdFromSeed(seed, counter, 8, 'bomb')}`;
            const bomb: Actor = createBombActor(bombId, effect.position, 'enemy');
            nextState.enemies = [...nextState.enemies, bomb];
            return nextState;
        }

        if (effect.itemType === 'shield') {
            nextState.shieldPosition = effect.position;
            nextState.hasShield = false;
        }
        return nextState;
    },
    LavaSink: (state, effect, context, api) => {
        let nextState = { ...state };
        nextState = api.appendTimelineEvent(
            nextState,
            'HAZARD_CHECK',
            'LavaSink',
            { target: effect.target },
            context,
            true,
            240
        );
        const targetId = effect.target;
        const actor = targetId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === targetId);
        if (actor) {
            nextState = api.appendTimelineEvent(
                nextState,
                'DEATH_RESOLVE',
                'LavaSink',
                { targetId },
                { ...context, targetId },
                true,
                280
            );
            if (targetId === nextState.player.id) {
                nextState.player = applyDamage(nextState.player, 99);
            } else {
                nextState.enemies = nextState.enemies.filter(e => e.id !== targetId);
                nextState.dyingEntities = [...(nextState.dyingEntities || []), actor];
                nextState = api.addCorpseTraitAt(nextState, actor.position);
            }
            nextState.visualEvents = [...(nextState.visualEvents || []),
            { type: 'vfx', payload: { type: 'vaporize', position: actor.position } }
            ];
        }
        return nextState;
    }
};
