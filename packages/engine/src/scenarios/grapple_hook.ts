import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * Grapple Hook Scenarios
 * Tests: Line of sight, lava interactions, weight classes, and displacement mechanics
 */
export const grappleHookScenarios: ScenarioCollection = {
    id: 'grapple_hook',
    name: 'Grapple Hook',
    description: 'Tests for grapple hook mechanics including LoS, lava sinking, and weight-based behavior',

    scenarios: [
        {
            id: 'hook_lava_intercept',
            title: 'Lava Interceptor & LoS',
            description: 'Verify LoS blocking and Lava sinking both before and after swap.',
            relatedSkills: ['GRAPPLE_HOOK'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['lava', 'line-of-sight', 'displacement'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 6, s: -10 }, ['GRAPPLE_HOOK']);
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'target1'); // Pull into lava, no swap
                engine.spawnEnemy('footman', { q: 4, r: 9, s: -13 }, 'target2'); // Pull, swap, continue fling into lava
                engine.applyStatus('target2', 'stunned'); // Prevent movement
                engine.spawnEnemy('footman', { q: 7, r: 3, s: -10 }, 'hidden');
                engine.setTile({ q: 6, r: 4, s: -10 }, 'wall'); // Block LoS to 'hidden'
                engine.setTile({ q: 4, r: 5, s: -9 }, 'lava');
            },

            run: (engine: any) => {
                engine.useSkill('GRAPPLE_HOOK', { q: 7, r: 3, s: -10 }); // 1. Attempt blocked LoS, no effect, does not consume turn
                engine.useSkill('GRAPPLE_HOOK', { q: 4, r: 4, s: -8 }); // 2. Pull target1 into lava
                // Use the wait action which triggers the turn cycle including auto-attack
                engine.applyStatus('target2', 'stunned'); // Prevent movement
                engine.wait();
                engine.applyStatus('target2', 'stunned'); // Prevent movement
                engine.wait();
                engine.useSkill('GRAPPLE_HOOK', { q: 4, r: 9, s: -13 }); // 3. Fling target2 into lava
            },

            verify: (state: GameState, logs: string[]) => {
                const hiddenAlive = !!state.enemies.find(e => e.id === 'hidden');
                const target1Dead = !state.enemies.find(e => e.id === 'target1');
                const target2Dead = !state.enemies.find(e => e.id === 'target2');
                const losWarning = logs.some(l => l.includes('Line of sight blocked'));
                return hiddenAlive && target1Dead && target2Dead && losWarning;
            }
        },

        {
            id: 'hook_wall_anchor_zip',
            title: 'Heavy Zip to Wall',
            description: 'Verify LoS for walls and AoE stun.',
            relatedSkills: ['GRAPPLE_HOOK'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['wall', 'displacement', 'stun'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['GRAPPLE_HOOK']);
                engine.setTile({ q: 6, r: 6, s: -12 }, 'wall');
                engine.setTile({ q: 7, r: 6, s: -13 }, 'wall'); // Behind the first
                engine.spawnEnemy('footman', { q: 7, r: 5, s: -12 }, 'safe');
                engine.spawnEnemy('footman', { q: 5, r: 5, s: -10 }, 'stunMe');
                engine.setTile({ q: 4, r: 6, s: -10 }, 'lava');
            },

            run: (engine: any) => {
                engine.useSkill('GRAPPLE_HOOK', { q: 7, r: 6, s: -13 }); // Should fail (LoS)
                engine.useSkill('GRAPPLE_HOOK', { q: 6, r: 6, s: -12 }); // Should succeed
            },

            verify: (state: GameState) => {
                return state.player.position.q === 5;
            }
        },

        {
            id: 'hook_stress_test_identity',
            title: 'Identity Stress Test',
            description: 'Verify Auto-Attack logic.',
            relatedSkills: ['GRAPPLE_HOOK', 'AUTO_ATTACK'],
            category: 'combat',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['auto-attack', 'passive', 'integration'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 6, s: -10 }, ['GRAPPLE_HOOK', 'AUTO_ATTACK']);
                engine.spawnEnemy('footman', { q: 5, r: 6, s: -11 }, 'stayer');
                engine.spawnEnemy('archer', { q: 7, r: 3, s: -10 }, 'target');
            },

            run: (engine: any) => engine.useSkill('GRAPPLE_HOOK', { q: 7, r: 3, s: -10 }),

            verify: (state: GameState) => {
                const stayer = state.enemies.find(e => e.id === 'stayer');
                return (stayer?.hp ?? 0) < 2; // Assuming 2 HP start
            }
        }
    ]
};
