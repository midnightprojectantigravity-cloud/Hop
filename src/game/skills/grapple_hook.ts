import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getHexLine, hexEquals, hexSubtract, hexAdd } from '../hex';
import { getEnemyAt } from '../helpers';

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
        range: 3,
        cost: 1,
        cooldown: 3,
    },
    execute: (state: GameState, shooter: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[] } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages };

        const dist = hexDistance(shooter.position, target);
        if (dist > 3) {
            messages.push('Out of range!');
            return { effects, messages };
        }

        const targetEnemy = getEnemyAt(state.enemies, target);
        if (!targetEnemy) {
            messages.push('No target found!');
            return { effects, messages };
        }

        // Calculate the pull path
        const line = getHexLine(target, shooter.position);
        if (line.length < 2) return { effects, messages };

        // The destination is the hex adjacent to the shooter on the path from the target
        const dest = line[line.length - 2];

        // Path check for lava: If ANY hex on the path (including starting and dest) is lava, they fall in.
        // We check the entire path to satisfy "crosses a Lava hex".
        let fellInLava = false;

        for (const step of line) {
            if (hexEquals(step, shooter.position)) continue; // Can't fall into lava under shooter (usually)
            if (state.lavaPositions.some(lp => hexEquals(lp, step))) {
                fellInLava = true;
                break;
            }
        }

        if (fellInLava) {
            effects.push({ type: 'Message', text: `Hooked ${targetEnemy.subtype || 'enemy'}!` });
            effects.push({ type: 'Juice', effect: 'lavaSink', target: targetEnemy.position });
            effects.push({ type: 'Message', text: `${targetEnemy.subtype ? targetEnemy.subtype.charAt(0).toUpperCase() + targetEnemy.subtype.slice(1) : 'Enemy'} fell into Lava!` });
        } else {
            messages.push(`Hooked ${targetEnemy.subtype || 'enemy'}!`);
            effects.push({ type: 'Displacement', target: 'targetActor', destination: dest });

            // Upgrade: Hook & Bash
            // Adding a Knockback effect to the end of a Pull. 
            // The test must verify that the enemy is pulled to the player and then immediately pushed 1 hex away.
            if (activeUpgrades.includes('HOOK_AND_BASH')) {
                const diff = hexSubtract(dest, shooter.position);
                const pushDest = hexAdd(dest, diff);
                effects.push({ type: 'Displacement', target: 'targetActor', destination: pushDest });
                effects.push({ type: 'Message', text: 'Hook & Bash!' });
            }
        }

        return { effects, messages };
    },
    upgrades: {
        HOOK_AND_BASH: {
            id: 'HOOK_AND_BASH',
            name: 'Hook & Bash',
            description: 'Adding a Knockback effect to the end of a Pull.',
            extraEffects: [] // Handled in logic for this complex sequence
        }
    },
    scenarios: [
        {
            id: 'hook_lava_pull',
            title: 'Grappling with Fire',
            description: 'Pull the enemy across the lava hex to incinerate them.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['GRAPPLE_HOOK']);
                engine.setTile({ q: 3, r: 5, s: -8 }, 'lava');
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'target');
            },
            run: (engine: any) => {
                engine.useSkill('GRAPPLE_HOOK', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemyGone = state.enemies.length === 0;
                const messageOk = logs.some(l => l.includes('fell into Lava!'));
                return enemyGone && messageOk;
            }
        },
        {
            id: 'hook_and_bash_combo',
            title: 'Hook & Bash',
            description: 'Verify the combinatorial "Hook & Bash" upgrade: Pull then Push.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['GRAPPLE_HOOK']);
                engine.addUpgrade('GRAPPLE_HOOK', 'HOOK_AND_BASH');
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'target');
                // Stun to prevent it moving after being hooked
                engine.applyStatus('target', 'stunned');
            },
            run: (engine: any) => {
                engine.useSkill('GRAPPLE_HOOK', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find((e: Actor) => e.id === 'target');
                return enemy?.position.r === 3 && logs.some(l => l.includes('Hook & Bash!'));
            }
        }
    ]
};
