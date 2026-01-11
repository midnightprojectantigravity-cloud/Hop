import type { SkillDefinition, GameState, Actor, AtomicEffect, Point, WeightClass } from '../types';
import { hexDistance, hexSubtract, hexAdd, hexEquals, getNeighbors, getDirectionFromTo, hexDirection, isHexInRectangularGrid } from '../hex';
import { getEnemyAt, getActorAt, isWalkable, isPerimeter } from '../helpers';

/**
 * Implementation of the Grapple Hook (Enyo Pull) using the Compositional Skill Framework.
 */
export const GRAPPLE_HOOK: SkillDefinition = {
    id: 'GRAPPLE_HOOK',
    name: 'Grapple Hook',
    description: 'Pull an enemy toward you. If they cross lava, they are consumed.',
    slot: 'offensive',
    icon: '🪝',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 3,
    },
    execute: (state: GameState, shooter: Actor, target?: Point, _activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[] } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages };

        const dist = hexDistance(shooter.position, target);
        if (dist > 4) {
            messages.push('Out of range!');
            return { effects, messages };
        }

        // Check if target is Outer Wall
        const isWall = state.wallPositions.some(w => hexEquals(w, target));
        // We need a way to distinguish Outer Wall from Internal Pillar.
        // For now, if it's on the perimeter, it's Outer Wall.
        // In our generation, all perimeter tiles are in wallPositions.
        // MRD says: "Internal Pillars, Large Rocks" are Anchored/Heavy.
        // Let's assume nodes with weightClass = 'Anchored' or 'Heavy' or even generic walls that are NOT perimeter.

        if (isWall && isPerimeter(target, state.gridWidth, state.gridHeight)) {
            messages.push('Cannot hook the outer wall!');
            return { effects, messages };
        }

        const targetActor = getActorAt(state, target);

        // Weight Class Determination
        let weightClass: WeightClass = 'Standard';
        if (targetActor) {
            weightClass = targetActor.weightClass || 'Standard';
        } else if (isWall) {
            weightClass = 'Anchored';
        }

        if (weightClass === 'Standard' && targetActor) {
            // Pull -> Swap -> 4-Tile Fling
            const shooterOrigPos = shooter.position;
            const targetOrigPos = targetActor.position;

            // 1. Move shooter to target's original position (Zip)
            effects.push({ type: 'Displacement', target: 'self', destination: targetOrigPos });

            // 2. Move target to shooter's original position, then fling 4 tiles past
            const dirIdx = getDirectionFromTo(targetOrigPos, shooterOrigPos);
            const dirVec = hexDirection(dirIdx);

            // Fling destination: shooterOrigPos + 4 * dirVec
            let flingDest = shooterOrigPos;
            let current = shooterOrigPos;
            for (let i = 0; i < 4; i++) {
                const next = hexAdd(current, dirVec);
                const isWall = state.wallPositions.some(w => hexEquals(w, next));
                const inGrid = isHexInRectangularGrid(next, state.gridWidth, state.gridHeight);
                const isOccupiedByEnemy = !!getEnemyAt(state.enemies, next);

                if (inGrid && !isWall && !isOccupiedByEnemy) {
                    current = next;
                    flingDest = next;
                    // If we pass through lava, we stop and sink!
                    if (state.lavaPositions.some(l => hexEquals(l, next))) {
                        effects.push({ type: 'Displacement', target: 'targetActor', destination: next, isFling: true });
                        effects.push({ type: 'Juice', effect: 'lavaSink', target: next });
                        messages.push(`Swapped and flung ${targetActor.subtype || 'enemy'} into Lava!`);
                        return { effects, messages };
                    }
                } else {
                    // Stop at wall/obstacle (Wall slam stun)
                    if (isWall) {
                        effects.push({ type: 'ApplyStatus', target: targetActor.position, status: 'stunned', duration: 1 });
                        effects.push({ type: 'Juice', effect: 'impact', target: next });
                        messages.push(`${targetActor.subtype || 'Enemy'} slammed into a wall!`);
                    }
                    break;
                }
            }

            effects.push({ type: 'Displacement', target: 'targetActor', destination: flingDest, isFling: true });
            messages.push(`Swapped and flung ${targetActor.subtype || 'enemy'}!`);

        } else if (weightClass === 'Heavy' || weightClass === 'Anchored') {
            // Player Zip-to-Target -> AoE Stun
            const dirIdx = getDirectionFromTo(shooter.position, target);
            const dirVec = hexDirection(dirIdx);
            const zipDest = hexSubtract(target, dirVec); // Adjacent to target

            if (isWalkable(zipDest, state.wallPositions, state.lavaPositions, state.gridWidth, state.gridHeight)) {
                effects.push({ type: 'Displacement', target: 'self', destination: zipDest });

                // AoE Stun on target and neighbors
                effects.push({ type: 'ApplyStatus', target: target, status: 'stunned', duration: 1 });
                const neighbors = getNeighbors(target);
                for (const n of neighbors) {
                    const enemy = getEnemyAt(state.enemies, n);
                    if (enemy) {
                        effects.push({ type: 'ApplyStatus', target: n, status: 'stunned', duration: 1 });
                    }
                }
                effects.push({ type: 'Juice', effect: 'shake' });
                messages.push(`Zipped to heavy target and stunned area!`);
            } else {
                messages.push('No space to zip to target!');
            }
        }

        return { effects, messages };
    },
    upgrades: {},
    scenarios: [
        {
            id: 'hook_fling_standard',
            title: 'Standard Fling',
            description: 'Swap and fling a standard enemy 4 tiles past.',
            rationale: '1. Hook connects at (3,3). 2. Swap: Player moves to (3,3), Target moves to (3,4). 3. Fling: Target starts at (3,4), vector is South (0,1). 4. Formula: (3,4) + 4*(0,1) = (3,8). Final: Target at (3,8).',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, ['GRAPPLE_HOOK']);
                engine.spawnEnemy('footman', { q: 3, r: 3, s: -6 }, 'target'); // 1 tile away
                engine.applyStatus('target', 'stunned');
            },
            run: (engine: any) => {
                engine.useSkill('GRAPPLE_HOOK', { q: 3, r: 3, s: -6 });
            },
            verify: (state: GameState, _logs: string[]) => {
                const enemy = state.enemies.find((e: Actor) => e.id === 'target');
                // TargetOrig at (3,3). ShooterOrig at (3,4).
                // dir from Target to Shooter: (3,4)-(3,3) = (0,1).
                // Fling: ShooterOrig (3,4) + 4*(0,1) = (3,8).
                return !!enemy && enemy.position.r === 8 && state.player.position.r === 3;
            }
        },
        {
            id: 'hook_heavy_zip',
            title: 'Heavy Zip',
            description: 'Zip to a heavy target and stun area.',
            rationale: 'Target is Heavy. Player Zips to the space adjacent to target (3,3) and emits an AoE stun.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, ['GRAPPLE_HOOK']);
                engine.spawnEnemy('shieldBearer', { q: 3, r: 2, s: -5 }, 'heavy'); // ShieldBearer is Heavy
                engine.applyStatus('heavy', 'stunned');
            },
            run: (engine: any) => {
                engine.useSkill('GRAPPLE_HOOK', { q: 3, r: 2, s: -5 });
            },
            verify: (state: GameState, logs: string[]) => {
                // Zip means player moves to neighbor of target (3,3) and target is stunned
                const atNeighbor = state.player.position.r === 3 && state.player.position.q === 3;
                const stunned = logs.some(l => l.includes('Zipped to heavy target'));
                return atNeighbor && stunned;
            }
        },
        {
            id: 'hook_lava_pull',
            title: 'Grappling with Fire',
            description: 'Fling an enemy into a lava tile.',
            rationale: 'Target at (3,4), Player at (3,6). Swap moves Target to (3,6). Fling dir is South (0,1). Target hits Lava at (3,8) after 2 hexes and dies.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['GRAPPLE_HOOK']);
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'target'); // 2 tiles away
                engine.setTile({ q: 3, r: 8, s: -11 }, 'lava'); // 2 tiles past player
                engine.applyStatus('target', 'stunned');
            },
            run: (engine: any) => {
                engine.useSkill('GRAPPLE_HOOK', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'target');
                const dead = !enemy || enemy.hp <= 0;
                const messageOk = logs.some(l => l.includes('into Lava'));
                return dead && messageOk;
            }
        },
        {
            id: 'hook_and_bash_combo',
            title: 'Hook & Bash',
            description: 'Verify fling moves target correctly for follow-up.',
            rationale: 'Standard swap-and-fling logic as per first scenario, verified for combo potential.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, ['GRAPPLE_HOOK']);
                engine.spawnEnemy('footman', { q: 3, r: 3, s: -6 }, 'target'); // 1 tile away
                engine.applyStatus('target', 'stunned');
            },
            run: (engine: any) => {
                engine.useSkill('GRAPPLE_HOOK', { q: 3, r: 3, s: -6 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find((e: Actor) => e.id === 'target');
                // Target at (3,3). Player at (3,4).
                // Fling from (3,4) in dir (0,1) -> (3,8)
                return !!enemy && enemy.position.r === 8 && logs.some(l => l.includes('Swapped and flung'));
            }
        }
    ]
};
