import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getDirectionFromTo, getNeighbors, hexAdd, hexDirection, hexDistance, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { pointToKey } from '../hex';
import { SpatialSystem } from '../systems/SpatialSystem';

/**
 * Implementation of the Shield Bash skill using the Compositional Skill Framework.
 */
export const SHIELD_BASH: SkillDefinition = {
    id: 'SHIELD_BASH',
    name: 'Shield Bash',
    description: 'Push an enemy 1 tile. If they hit a wall or another enemy, they are stunned.',
    slot: 'defensive',
    icon: '🛡️',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 2,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };
        if (!attacker || !attacker.position) return { effects, messages, consumesTurn: false };

        // 1. Upgrade Detection
        const hasRange = activeUpgrades.includes('SHIELD_RANGE');
        const isArc = activeUpgrades.includes('ARC_BASH');
        const is360 = activeUpgrades.includes('BASH_360');
        const hasWallSlam = activeUpgrades.includes('WALL_SLAM');

        const range = 1 + (hasRange ? 1 : 0);

        // 2. Validation
        if (!validateRange(attacker.position, target, range)) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // 3. Identify Targets
        let targetsToHit: Point[] = [];
        if (is360) {
            targetsToHit = getNeighbors(attacker.position);
        } else if (isArc) {
            targetsToHit = [target];
            const neighbors = getNeighbors(target);
            for (const n of neighbors) {
                if (hexDistance(n, attacker.position) === 1 && targetsToHit.length < 3) {
                    targetsToHit.push(n);
                }
            }
        } else {
            targetsToHit = [target];
        }

        // 4. Recursive Bash Simulation (Ghost State)
        const simulatedPositions = new Map<string, Point>();
        state.enemies.forEach(e => simulatedPositions.set(e.id, e.position));
        if (state.player) simulatedPositions.set(state.player.id, state.player.position);

        const getActorAtSimulated = (pos: Point): Actor | undefined => {
            for (const [id, simPos] of Array.from(simulatedPositions.entries())) {
                if (hexEquals(simPos, pos)) {
                    if (id === state.player.id) return state.player;
                    return state.enemies.find(e => e.id === id);
                }
            }
            return undefined;
        };

        const resolveBash = (sourcePos: Point, currentTargetPos: Point) => {
            const targetActor = getActorAtSimulated(currentTargetPos);
            if (!targetActor || targetActor.id === attacker.id) return;

            const direction = getDirectionFromTo(sourcePos, currentTargetPos);
            const dirVec = hexDirection(direction);
            const pushDest = hexAdd(currentTargetPos, dirVec);

            // Obstacle Check
            const tile = state.tiles.get(pointToKey(pushDest));
            const blockedByWall = tile?.baseId === 'WALL' || tile?.traits.has('BLOCKS_MOVEMENT');
            const isOutOfBounds = !SpatialSystem.isWithinBounds(state, pushDest);
            const blockingActor = getActorAtSimulated(pushDest);

            if (blockedByWall || isOutOfBounds || (blockingActor && blockingActor.id !== targetActor.id)) {
                // Collision!
                effects.push({ type: 'ApplyStatus', target: targetActor.id, status: 'stunned', duration: 1 });
                messages.push(`Bashed ${targetActor.subtype || 'enemy'} into obstacle!`);
                effects.push({ type: 'Juice', effect: 'shake' });

                if (blockingActor && hasWallSlam) {
                    resolveBash(currentTargetPos, pushDest);
                }
            } else {
                // Successful Push
                effects.push({ type: 'Displacement', target: targetActor.id, destination: pushDest, simulatePath: true });
                simulatedPositions.set(targetActor.id, pushDest);
                messages.push(`Pushed ${targetActor.subtype || 'enemy'}!`);
            }
        };

        for (const t of targetsToHit) {
            resolveBash(attacker.position, t);
        }

        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        // Can target neighbors (or range 2 if upgraded)
        return SpatialSystem.getAreaTargets(state, origin, 1).filter(p => !!getActorAt(state, p));
    },
    upgrades: {
        SHIELD_RANGE: { id: 'SHIELD_RANGE', name: 'Extended Bash', description: 'Range +1' },
        SHIELD_COOLDOWN: { id: 'SHIELD_COOLDOWN', name: 'Quick Recovery', description: 'Cooldown -1', modifyCooldown: -1 },
        ARC_BASH: { id: 'ARC_BASH', name: 'Arc Bash', description: 'Bash hits 3-hex frontal arc (+1 cooldown)', modifyCooldown: 1 },
        BASH_360: { id: 'BASH_360', name: '360° Bash', description: 'Bash hits all neighbors (+1 cooldown)', modifyCooldown: 1 },
        PASSIVE_PROTECTION: { id: 'PASSIVE_PROTECTION', name: 'Passive Protection', description: '+1 temp armor when shield not on cooldown' },
        WALL_SLAM: { id: 'WALL_SLAM', name: 'Wall Slam', description: 'Enemies bashed into obstacles trigger a cascade and stun' }
    },
    scenarios: getSkillScenarios('SHIELD_BASH')
};
