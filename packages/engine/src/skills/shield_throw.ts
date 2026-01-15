import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import {
    hexDistance, hexAdd, hexEquals,
    getDirectionFromTo, getHexLine,
    isHexInRectangularGrid, scaleVector
} from '../hex';
import { getActorAt } from '../helpers';
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

        // 2. Line of Sight Check
        const line = getHexLine(attacker.position, target);
        const obstruction = line.slice(1, -1).find(p => state.wallPositions?.some(w => hexEquals(w, p)));
        if (obstruction) {
            messages.push('Line of sight blocked!');
            return { effects, messages, consumesTurn: false };
        }

        const targetActor = getActorAt(state, target);
        const dirIdx = getDirectionFromTo(attacker.position, target);
        if (dirIdx === -1) {
            messages.push('Invalid direction');
            return { effects, messages, consumesTurn: false };
        }

        if (!targetActor) {
            messages.push('No target found!');
            return { effects, messages, consumesTurn: false };
        }

        // Immediate Stun
        effects.push({ type: 'ApplyStatus', target: 'targetActor', status: 'stunned', duration: 1 });

        let finalPos = target;
        let sunk = false;

        // Start from 1 to check the tiles BEYOND the target
        for (let i = 1; i <= 4; i++) {
            const next = hexAdd(target, scaleVector(dirIdx, i));

            // Boundary check: is it off-grid?
            if (!isHexInRectangularGrid(next, state.gridWidth, state.gridHeight)) break;

            const isWall = state.wallPositions?.some(w => hexEquals(w, next));
            const otherActor = getActorAt(state, next);

            if (isWall || otherActor) {
                // Wall Slam or Unit Collision (Stops here)
                effects.push({ type: 'ApplyStatus', target: 'targetActor', status: 'stunned', duration: 1 });
                effects.push({ type: 'Juice', effect: 'impact', target: next });
                break;
            }

            // Path is clear, update the potential destination
            finalPos = next;

            // Hazard Check (Lava)
            if (state.lavaPositions?.some(l => hexEquals(l, next))) {
                // Same order as Grapple Hook: Displacement -> Damage -> Sink
                effects.push({ type: 'Displacement', target: 'targetActor', destination: finalPos });
                effects.push({ type: 'Damage', target: finalPos, amount: 999 });
                effects.push({ type: 'Juice', effect: 'lavaSink', target: finalPos });
                messages.push(`${targetActor.subtype} was pushed into lava!`);
                sunk = true;
                break;
            }
        }

        if (!sunk) {
            effects.push({ type: 'Displacement', target: 'targetActor', destination: finalPos });
            messages.push(`Threw shield! Stunned and pushed ${targetActor.subtype}.`);
        }


        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const range = 4;
        const valid: Point[] = [];
        for (let d = 0; d < 6; d++) {
            for (let i = 1; i <= range; i++) {
                const p = hexAdd(origin, scaleVector(d, i));
                if (!isHexInRectangularGrid(p, state.gridWidth, state.gridHeight)) break;
                // Only include tiles that currently have an enemy (Shield Throw targets enemies only)
                const actor = getActorAt(state, p);
                if (actor) valid.push(p);
            }
        }
        return valid;
    },
    upgrades: {},

    scenarios: shieldThrowScenarios.scenarios.map(toScenarioV2)
}