import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * Dash Scenarios
 * Tests: Axial movement, range, wall blocking, and Shield Shunt collision
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
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['DASH']);
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
                // Start at (4,5)
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['DASH']);
                engine.state.hasShield = true;

                // Wall blocking a long-range dash to (4,2)
                engine.setTile({ q: 4, r: 4, s: -8 }, 'wall');

                // Enemy for the final successful shunt at (6,5)
                engine.spawnEnemy('footman', { q: 6, r: 5, s: -11 }, 'victim');
            },
            run: (engine: any) => {
                // 1. FAIL: Try to dash THROUGH a wall to (4,3)
                engine.useSkill('DASH', { q: 4, r: 3, s: -7 });

                // 2. FAIL: Try to dash out of range (to q:10)
                engine.useSkill('DASH', { q: 10, r: 5, s: -15 });

                // 3. SUCCESS: Dash into enemy at (6,5) to trigger Shunt
                // This is a horizontal move (q-axis)
                engine.useSkill('DASH', { q: 6, r: 5, s: -11 });
            },
            verify: (state: GameState, logs: string[]) => {
                const victim = state.enemies.find(e => e.id === 'victim');

                const checks = {
                    // Player should NOT be at (4,3) or (10,5). 
                    // They should have ended up at the victim's original spot (6,5).
                    finalPositionCorrect: state.player.position.q === 6 && state.player.position.r === 5,

                    // Victim should be pushed further along the q-axis (e.g., to q:7)
                    victimPushed: !!(victim && victim.position.q >= 7),

                    // Logs should contain the history of the turn
                    wallErrorFound: logs.some(l => l.includes('wall blocks')),
                    rangeErrorFound: logs.some(l => l.includes('range')),
                    shuntSuccess: logs.some(l => l.includes('Shield Shunt')),

                    // Crucial for balancing: The failures shouldn't have ended the turn prematurely,
                    // but the final success should have consumed exactly 1 turn.
                    oneTurnSpent: state.turnsSpent === 1
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
