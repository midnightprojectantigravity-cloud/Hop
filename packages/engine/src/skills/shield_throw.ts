import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import {
    hexDistance, hexAdd, hexEquals,
    isHexInRectangularGrid, scaleVector, getHexLine, getDirectionFromTo, hexDirection
} from '../hex';
import { getActorAt, isPerimeter } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { processKineticPulse } from '../systems/kinetic-kernel';
import { SKILL_JUICE_SIGNATURES, JuiceHelpers } from '../systems/juice-manifest';

/**
 * Implementation of the Shield Throw skill.
 * Features: Range 4, Stun, 4-momentum Push via Kinetic Pulse.
 */
export const SHIELD_THROW: SkillDefinition = {
    id: 'SHIELD_THROW',
    name: 'Shield Throw',
    description: 'Throw your shield to strike and push enemies. Triggers a kinetic pulse on impact.',
    slot: 'defensive',
    icon: '🛡️',
    baseVariables: { range: 4, cost: 1, cooldown: 3 },

    execute: (state: GameState, attacker: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        if (!state.hasShield) {
            messages.push('Shield not in hand!');
            return { effects, messages, consumesTurn: false };
        }

        // JUICE: Anticipation - Trajectory arc
        effects.push(...SKILL_JUICE_SIGNATURES.SHIELD_THROW.anticipation(attacker.position, target));

        // 1. Line of Sight / Travel Check
        const line = getHexLine(attacker.position, target);
        // Ensure unencumbered travel to target (no walls/perimeter)
        for (const point of line.slice(1, -1)) {
            const isWall = state.wallPositions?.some(w => hexEquals(w, point)) ||
                isPerimeter(point, state.gridWidth, state.gridHeight);
            if (isWall) {
                messages.push('Shield hit a wall mid-flight!');
                effects.push({ type: 'SpawnItem', itemType: 'shield', position: point });
                return { effects, messages, consumesTurn: true };
            }
        }

        const targetActor = getActorAt(state, target);
        if (!targetActor) {
            messages.push('Shield missed: No target at location.');
            effects.push({ type: 'SpawnItem', itemType: 'shield', position: target });
            return { effects, messages, consumesTurn: true };
        }

        // JUICE: Execution - Shield arc + spin
        effects.push(...SKILL_JUICE_SIGNATURES.SHIELD_THROW.execution(line));

        // 2. Physics Resolution (Kinetic Pulse)
        const momentum = 4;
        const dirIdx = getDirectionFromTo(attacker.position, target);
        const direction = hexDirection(dirIdx);

        // Stun the primary target on impact
        effects.push({ type: 'ApplyStatus', target: targetActor.id, status: 'stunned', duration: 1 });

        // JUICE: Impact - Heavy impact + shake + freeze
        effects.push(...SKILL_JUICE_SIGNATURES.SHIELD_THROW.impact(target, direction));

        // Generate Kinetic Pulse effects starting at the impact hex
        const pulseEffects = processKineticPulse(state, {
            origin: target,
            direction: direction,
            momentum: momentum
        });

        // Determine final landing spot for the shield (it follows the lead unit)
        const targetDisps = pulseEffects.filter(e => e.type === 'Displacement' && e.target === targetActor.id);
        const lastDisp = targetDisps[targetDisps.length - 1];
        const finalPos = (lastDisp && 'destination' in lastDisp) ? lastDisp.destination : target;

        // JUICE: Resolution - Kinetic wave + momentum trails
        const kineticPath = getHexLine(target, finalPos);
        if (kineticPath.length > 1) {
            effects.push(...SKILL_JUICE_SIGNATURES.SHIELD_THROW.resolution(kineticPath));
        }

        // Projectile Persistence & Drain
        effects.push({ type: 'SpawnItem', itemType: 'shield', position: finalPos });

        messages.push(`Direct hit! Shield triggered kinetic pulse.`);

        return {
            effects: [...effects, ...pulseEffects],
            messages,
            consumesTurn: true
        };
    },

    getValidTargets: (state: GameState, origin: Point) => {
        const range = 4;
        const valid: Point[] = [];
        for (let d = 0; d < 6; d++) {
            for (let i = 1; i <= range; i++) {
                const p = hexAdd(origin, scaleVector(d, i));
                if (!isHexInRectangularGrid(p, state.gridWidth, state.gridHeight)) break;

                const isWall = state.wallPositions?.some(w => hexEquals(w, p)) ||
                    isPerimeter(p, state.gridWidth, state.gridHeight);

                const actor = getActorAt(state, p);
                // Can target any hex with an actor (except self)
                if (actor && actor.id !== state.player.id) {
                    valid.push(p);
                }

                // Path is blocked by walls or other actors
                if (isWall || actor) break;
            }
        }
        return valid;
    },
    upgrades: {},
    scenarios: getSkillScenarios('SHIELD_THROW')
};
