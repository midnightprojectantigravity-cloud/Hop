import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const grappleHookScenarios: ScenarioCollection = {
    id: 'grapple_hook',
    name: 'Grapple Hook',
    description: 'Tests for grapple hook mechanics including LoS, lava sinking, and weight-based behavior',

    scenarios: [
        {
            id: 'hook_lava_intercept',
            title: 'Lava Interceptor & LoS',
            description: 'Verify LoS blocking and Lava killing targets.',
            relatedSkills: ['GRAPPLE_HOOK'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['lava', 'line-of-sight', 'displacement'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 6, s: -10 }, ['GRAPPLE_HOOK']);
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'target1');
                engine.spawnEnemy('footman', { q: 7, r: 3, s: -10 }, 'hidden');

                // Directly block the "hidden" target
                engine.setTile({ q: 6, r: 4, s: -10 }, 'wall');
                engine.setTile({ q: 4, r: 5, s: -9 }, 'lava');
            },

            run: (engine: any) => {
                // 1. Should fail due to LoS
                engine.useSkill('GRAPPLE_HOOK', { q: 7, r: 3, s: -10 });

                // 2. Should pull target1 into lava at (4,5)
                engine.useSkill('GRAPPLE_HOOK', { q: 4, r: 4, s: -8 });

                // 3. Trigger turn cycles to resolve environmental damage
                engine.wait();
                engine.wait();
            },

            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    // Wall blocked the hook
                    playerInOriginalPosition: state.player.position.q === 4 && state.player.position.r === 6 && state.player.position.s === -10,
                    // Target fell in lava and was removed or killed
                    target1Dead: !state.enemies.find(e => e.id === 'target1') || state.enemies.find(e => e.id === 'target1')!.hp <= 0,
                    // Feedback was provided
                    losWarning: logs.some(l => l.includes('Line of sight'))
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Logs:', logs);
                }
                else {
                    console.log('✅ Scenario Passed', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'hook_wall_anchor_zip',
            title: 'Heavy Zip to Wall',
            description: 'Verify zipping to a wall and stunning nearby enemies.',
            relatedSkills: ['GRAPPLE_HOOK'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['wall', 'displacement', 'stun'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['GRAPPLE_HOOK']);

                // Wall LoS blocked by the blocker enemy
                engine.setTile({ q: 6, r: 3, s: -9 }, 'wall');
                engine.spawnEnemy('footman', { q: 5, r: 4, s: -9 }, 'blocker');

                // Wall is the target, confirm the stun radius 
                engine.setTile({ q: 6, r: 6, s: -12 }, 'wall');
                engine.setTile({ q: 5, r: 6, s: -11 }, 'lava');
                engine.spawnEnemy('footman', { q: 6, r: 5, s: -11 }, 'stunMe');
                engine.spawnEnemy('footman', { q: 7, r: 5, s: -12 }, 'noStun');
            },

            run: (engine: any) => {
                // Zip to wall at (6,3). Should not consume a turn as wall is out of LoS.
                engine.useSkill('GRAPPLE_HOOK', { q: 6, r: 3, s: -9 });

                // Zip to wall at (6,6).
                // Should also stun the enemy at (6,5)
                // Player should stop at (5,6) because wall is impassable and should also sink.
                engine.useSkill('GRAPPLE_HOOK', { q: 6, r: 6, s: -12 });
            },

            verify: (state: GameState, logs: string[]) => {
                const victim = state.enemies.find(e => e.id === 'stunMe');
                const safe = state.enemies.find(e => e.id === 'noStun');
                const checks = {
                    // playerDead: !state.player.alive,
                    stunnedEnemy: !!(victim && victim.statusEffects.some(s => s.type === 'stunned')),
                    safeEnemy: !!(safe && !safe.statusEffects.some(s => s.type === 'stunned')),
                    zipLog: logs.some(l => l.includes('Zipped')),
                    lavaSinkLog: logs.some(l => l.includes('Lava Sink'))
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Player Pos:', state.player.position);
                    console.log('Victim Status:', victim?.statusEffects);
                }
                else {
                    console.log('✅ Scenario Passed', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};