import type { SkillDefinition, GameState, Actor, AtomicEffect, Point, WeightClass } from '../types';
import {
    hexDistance, hexSubtract, hexAdd, hexEquals,
    getNeighbors, getDirectionFromTo, hexDirection, getPathBetween,
    getHexLine, scaleVector
} from '../hex';
import { getAxialTargets } from './targeting';
import { getActorAt, isWalkable, isPerimeter } from '../helpers';
import { grappleHookScenarios } from '../scenarios/grapple_hook';
import { toScenarioV2 } from '../scenarios/utils';

import { getComponent, type PhysicsComponent } from '../systems/components';
import { processKineticRequest } from '../systems/movement';

export const GRAPPLE_HOOK: SkillDefinition = {
    id: 'GRAPPLE_HOOK',
    name: 'Grapple Hook',
    description: 'Pull targets. If lava is on path, they sink. Heavy targets pull shooter. Walls/Units stop flings and stun.',
    slot: 'offensive',
    icon: '🪝',
    baseVariables: { range: 4, cost: 1, cooldown: 3 },

    execute: (state: GameState, shooter: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        // 1. Range + axial check
        const dist = hexDistance(shooter.position, target);
        if (dist > 4) {
            messages.push('Out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // AXIAL CHECK: exact equality on one coordinate (flat-top axial)
        const isAxial = shooter.position.q === target.q || shooter.position.r === target.r || shooter.position.s === target.s;
        if (!isAxial) {
            messages.push('Invalid target: must be in a straight line');
            return { effects, messages, consumesTurn: false };
        }

        // 2. Line of Sight Check (New: Fixes "Hidden Target" scenario)
        const line = getHexLine(shooter.position, target);
        const obstruction = line.slice(1, -1).find(p => state.wallPositions?.some(w => hexEquals(w, p)));
        if (obstruction) {
            messages.push('Line of sight blocked by wall!');
            return { effects, messages, consumesTurn: false }; // In a real engine, this returns an 'invalid' flag to prevent turn consumption
        }

        const targetActor = getActorAt(state, target);
        const isWallOrPillar = state.wallPositions?.some(w => hexEquals(w, target)) ||
            isPerimeter(target, state.gridWidth, state.gridHeight);

        // ECS-Migration: Prefer component-based weight class
        const physicsComp = getComponent<PhysicsComponent>(targetActor?.components, 'physics');
        const weightClass: WeightClass = isWallOrPillar ? 'Heavy' : (physicsComp?.weightClass || targetActor?.weightClass || 'Standard');

        // CASE A: HEAVY / ANCHOR ZIP
        if (weightClass === 'Heavy' || weightClass === 'Anchored') {
            const dir = getDirectionFromTo(shooter.position, target);
            const landingPos = hexSubtract(target, hexDirection(dir));

            if (isWalkable(landingPos, state.wallPositions, state.lavaPositions, state.gridWidth, state.gridHeight)) {
                effects.push({ type: 'Displacement', target: 'self', destination: landingPos });
                getNeighbors(landingPos).forEach(n => {
                    if (getActorAt(state, n)) effects.push({ type: 'ApplyStatus', target: n, status: 'stunned', duration: 1 });
                });
                effects.push({ type: 'Juice', effect: 'shake', target: landingPos });
                messages.push(`${shooter.subtype || 'You'} zipped to anchor!`);
            } else {
                messages.push('No space to zip to target!');
                return { effects, messages, consumesTurn: false };
            }
        }

        // CASE B: STANDARD FLING
        if (targetActor && weightClass === 'Standard') {
            const pullPath = getPathBetween(shooter.position, target);
            const lavaStep = pullPath.find(step => state.lavaPositions?.some(l => hexEquals(l, step)));

            if (lavaStep) {
                effects.push({ type: 'Displacement', target: 'targetActor', destination: lavaStep });
                effects.push({ type: 'Damage', target: lavaStep, amount: 999 });
                effects.push({ type: 'Juice', effect: 'lavaSink', target: lavaStep });
                messages.push(`${targetActor.subtype} was pulled into lava!`);
            } else {
                // target2 Scenario: Swap + Fling
                const shooterOrigin = { ...shooter.position };
                const dirToTarget = getDirectionFromTo(shooterOrigin, target);
                const oneTileTowardTarget = hexAdd(shooterOrigin, hexDirection(dirToTarget));

                // 1. Shooter moves 1 tile toward target
                if (isWalkable(oneTileTowardTarget, state.wallPositions, state.lavaPositions, state.gridWidth, state.gridHeight)) {
                    effects.push({ type: 'Displacement', target: 'self', destination: oneTileTowardTarget });
                }

                // 2. Fling direction is from the new player position back through the origin
                const flingDirIdx = getDirectionFromTo(oneTileTowardTarget, shooterOrigin);
                const flingTarget = hexAdd(shooterOrigin, scaleVector(flingDirIdx, 4));

                // 3. Trigger Kinetic Pulse for the flip/fling
                const momentum = 4;
                const result = processKineticRequest(state, {
                    sourceId: targetActor.id, // The target becomes the source of the kinetic energy
                    target: flingTarget,
                    momentum,
                    isPulse: true
                });

                messages.push(`Flipped and flung ${targetActor.subtype}!`);
                return {
                    effects: [...effects, ...result.effects],
                    messages: [...messages, ...result.messages]
                };
            }
        }
        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => getAxialTargets(state, origin, 4),
    upgrades: {},

    scenarios: grappleHookScenarios.scenarios.map(toScenarioV2)
};


// ---------------------------------------------------------
// MATH UTILITIES
// ---------------------------------------------------------

// (roundToHex removed — unused helper)
