import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import {
    hexDistance, hexAdd, hexEquals,
    isHexInRectangularGrid, scaleVector
} from '../hex';
import { getActorAt } from '../helpers';
import { processKineticRequest } from '../systems/movement';
import { shieldThrowScenarios } from '../scenarios/shield_throw';
import { toScenarioV2 } from '../scenarios/utils';


/**
 * Implementation of the Shield Throw skill (Enyo Secondary)
 * Features: Range 4, Stun, 4-tile Push, Wall Slam, and Lava Hazards.
 */
export const SHIELD_THROW: SkillDefinition = {
    id: 'SHIELD_THROW',
    name: 'Shield Throw',
    description: 'Stun and push an enemy 4 tiles. Stops and stuns on wall/unit collision. Sinks in lava.',
    slot: 'defensive',
    icon: '🛡️',
    baseVariables: { range: 4, cost: 1, cooldown: 3 },

    execute: (state: GameState, attacker: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        // 1. Range Check
        const dist = hexDistance(attacker.position, target);
        if (dist > 4) {
            messages.push('Out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // AXIAL CHECK: exact equality on one coordinate (flat-top axial)
        const isAxial = attacker.position.q === target.q || attacker.position.r === target.r || attacker.position.s === target.s;
        if (!isAxial) {
            messages.push('Invalid target: Shield must be thrown in a straight line');
            return { effects, messages, consumesTurn: false };
        }

        const targetActor = getActorAt(state, target);
        if (!targetActor) {
            messages.push('No target found!');
            return { effects, messages, consumesTurn: false };
        }

        // 2. PHYSICS RESOLUTION RELAY
        const momentum = 4;
        const result = processKineticRequest(state, {
            sourceId: attacker.id,
            target,
            momentum,
            isPulse: true,
            skipSourceDisplacement: true
        });

        // The shield should end up where the "lead" unit (the one the player threw it at) ends up,
        // or where the pulse stops.

        // Find final position of the targetActor
        const targetDisplacement = result.effects.find(e =>
            e.type === 'Displacement' &&
            (e.target === targetActor.id || (e.target === 'targetActor'))
        );

        const finalPos = targetDisplacement && 'destination' in targetDisplacement ? targetDisplacement.destination : target;

        // Projectile Persistence: Spawn the shield at the impact site
        effects.push({ type: 'SpawnItem', itemType: 'shield', position: finalPos });
        messages.push(`Threw shield! Kinetic Pulse triggered.`);

        return {
            effects: [...effects, ...result.effects],
            messages: [...messages, ...result.messages]
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const range = 4;
        const valid: Point[] = [];
        for (let d = 0; d < 6; d++) {
            for (let i = 1; i <= range; i++) {
                const p = hexAdd(origin, scaleVector(d, i));
                if (!isHexInRectangularGrid(p, state.gridWidth, state.gridHeight)) break;
                const isWall = state.wallPositions?.some(w => hexEquals(w, p));
                const actor = getActorAt(state, p);
                if (actor) valid.push(p);
                if (isWall || actor) break; // Blocked by wall or unit
            }
        }
        return valid;
    },
    upgrades: {},

    scenarios: shieldThrowScenarios.scenarios.map(toScenarioV2)
}