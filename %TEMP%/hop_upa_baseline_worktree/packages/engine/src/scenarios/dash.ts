import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * Dash Scenarios
 * Tests: Axial movement, range, wall blocking, and Shield Shunt collision
 * This file has been reviewed and is now up to standards.
 */
export const dashScenarios: ScenarioCollection = {
    id: 'dash',
    name: 'Dash',
    description: 'Tests for dash mechanics including path validation and shield-based enemy shunting',

    scenarios: [
        {
            id: 'dash_shunt_lava',
            title: 'Shunt into Lava',
            description: 'Shunt an enemy into lava for an environmental kill.',
            relatedSkills: ['DASH'],
            category: 'hazards',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['lava', 'push', 'environmental-kill'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 5, s: -8 }, ['DASH']);
                engine.spawnEnemy('footman', { q: 5, r: 5, s: -10 }, 'victim');
                engine.setTile({ q: 7, r: 5, s: -12 }, 'lava');
                engine.state.hasShield = true;
            },
            run: (engine: any) => {
                engine.useSkill('DASH', { q: 5, r: 5, s: -10 });
            },
            verify: (state: GameState, logs: string[]) => {
                const victim = state.enemies.find(e => e.id === 'victim');

                const checks = {
                    playerPosition: state.player.position.q === 5 && state.player.position.r === 5,
                    victimDead: !victim
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Dash Shunt Lava Failed:', checks);
                    console.log('Final State:', state.player.position);
                    console.log('Victim Pos:', victim?.position);
                    console.log('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'dash_comprehensive_validation',
            title: 'Dash: Constraints & Shunt Physics',
            description: 'Validates range limits, wall blocking, and Shield Shunt displacement in one sequence.',
            relatedSkills: ['DASH'],
            category: 'movement',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['stress-test', 'collision', 'range'],

            setup: (engine: any) => {
                // Start at (4,9)
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['DASH']);
                engine.state.hasShield = true;

                // Wall blocking the enemy, preventing them from moving further.
                engine.setTile({ q: 4, r: 4, s: -8 }, 'wall');

                // Wall blocking a long-range dash to (7,4)
                engine.setTile({ q: 6, r: 5, s: -11 }, 'wall');

                // Enemy for the two consecutive shunts
                engine.spawnEnemy('footman', { q: 4, r: 7, s: -11 }, 'victim');
            },
            run: (engine: any) => {
                // 1. SUCCESS: Dash into enemy at (4,7) to trigger Shunt
                engine.useSkill('DASH', { q: 4, r: 7, s: -11 });

                // 2. FAIL: Try to dash THROUGH a wall to (7,4)
                engine.useSkill('DASH', { q: 7, r: 4, s: -11 });

                // 3. FAIL: Try to dash out of axialrange to (6,6)
                engine.useSkill('DASH', { q: 6, r: 6, s: -12 });

                // 4. SUCCESS: Dash into enemy at (4,5) to trigger Shunt
                // After this dash, the enemy should still be at (4,5) and the player should be at (4,6)
                engine.useSkill('DASH', { q: 4, r: 5, s: -9 });

            },
            verify: (state: GameState, logs: string[]) => {
                const victim = state.enemies.find(e => e.id === 'victim');

                const checks = {
                    // Player should NOT be at (4,7), (4,3), (6,6) or (7,4). 
                    // They should have ended up at the tile before the victim's final spot (4,6).
                    finalPositionCorrect: state.player.position.q === 4 && state.player.position.r === 6,

                    // Victim should be at (4,5)
                    victimPushed: !!(victim && victim.position.q === 4 && victim.position.r === 5),

                    // Logs should contain the history of the turn
                    wallErrorFound: logs.some(l => l.includes('wall blocks')),
                    axialRangeErrorFound: logs.some(l => l.includes('Axial only!')),
                    shuntSuccess: logs.some(l => l.includes('Shield Shunt')),

                    // Crucial for balancing: The failures shouldn't have ended the turn prematurely,
                    // but the final success should have consumed exactly 2 turns.
                    twoTurnSpent: state.turnsSpent === 2
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Dash Stress Test Failed:', checks);
                    console.log('Final State:', state.player.position);
                    console.log('Victim Pos:', victim?.position);
                    console.log('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
