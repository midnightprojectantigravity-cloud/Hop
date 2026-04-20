import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getActorAt } from '../helpers';
import { validateRange } from '../systems/validation';
import { UnifiedTileService } from '../systems/tiles/unified-tile-service';
import { createBombActor } from '../systems/effects/bomb-runtime';

/**
 * BOMB_TOSS
 * Spawns a bomb actor with a fuse counter and `TIME_BOMB` loadout.
 */
export const BOMB_TOSS: SkillDefinition = {
    id: 'BOMB_TOSS',
    name: 'Bomb Toss',
    description: 'Throw a bomb to a nearby tile.',
    slot: 'offensive',
    icon: '💣',
    baseVariables: {
        range: 3,
        cost: 0,
        cooldown: 2,
    },
    execute: (state: GameState, attacker: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        if (!validateRange(attacker.position, target, 3)) {
            messages.push('Out of range!');
            return { effects, messages, consumesTurn: false };
        }

        if (!UnifiedTileService.isWalkable(state, target)) {
            messages.push('Target blocked!');
            return { effects, messages, consumesTurn: false };
        }

        const occupant = getActorAt(state, target);
        if (occupant) {
            messages.push('Target occupied!');
            return { effects, messages, consumesTurn: false };
        }

        const bombId = `bomb-${attacker.id}-${state.turnNumber}-${state.actionLog?.length ?? 0}-${target.q}_${target.r}_${target.s}`;
        const bomb = createBombActor(bombId, target, attacker.factionId);

        effects.push({ type: 'SpawnActor', actor: bomb });
        messages.push('Bomb tossed!');

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const range = 3;
        const valid: Point[] = [];
        for (let q = -range; q <= range; q++) {
            for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
                const p = { q: origin.q + q, r: origin.r + r, s: origin.s - q - r };
                if (!validateRange(origin, p, range)) continue;
                if (!UnifiedTileService.isWalkable(state, p)) continue;
                if (getActorAt(state, p)) continue;
                valid.push(p);
            }
        }
        return valid;
    },
    upgrades: {},
};
