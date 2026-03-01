import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * Shield Throw Scenarios
 * Tests: Push mechanics, collision detection, and lava interactions
 */
export const shieldThrowScenarios: ScenarioCollection = {
    id: 'shield_throw',
    name: 'Shield Throw',
    description: 'Tests for shield throw mechanics including push, stun, and collision behavior',

    scenarios: [
        {
            id: 'shield_stun_push',
            title: 'Standard Push',
            description: 'Verify 4-tile push in a straight line.',
            relatedSkills: ['SHIELD_THROW'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['push', 'displacement', 'stun'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_THROW']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
            },

            run: (engine: any) => engine.useSkill('SHIELD_THROW', { q: 3, r: 5, s: -8 }),

            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'victim');

                const checks = {
                    victimAt1: enemy?.position.r === 1, // 5 - 4 = 1
                    victimStunned: logs?.some(log => log.includes('stunned')),
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Shield Throw Failed:', checks);
                    console.log('Enemy Pos:', enemy?.position);
                    console.log('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        },

        {
            id: 'shield_unit_collision',
            title: 'Unit Collision',
            description: 'Verify push stops when hitting another unit.',
            relatedSkills: ['SHIELD_THROW'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['collision', 'lava', 'push', 'environmental-kill'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_THROW']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
                engine.spawnEnemy('shieldbearer', { q: 3, r: 3, s: -6 }, 'obstacle');
                engine.setTile({ q: 3, r: 1, s: -4 }, 'lava');
            },

            run: (engine: any) => engine.useSkill('SHIELD_THROW', { q: 3, r: 5, s: -8 }),

            verify: (state: GameState, logs: string[]) => {
                const victim = state.enemies.find(e => e.id === 'victim');
                const obstacle = state.enemies.find(e => e.id === 'obstacle');

                // Kinetic Pulse supports Chain Reaction: Victim pushes Obstacle!
                const checks = {
                    victimPushed: (victim?.position.r ?? 5) === 3,
                    obstacleDead: !obstacle
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Shield Throw Failed:', checks);
                    console.log('Victim Pushed:', checks.victimPushed);
                    console.log('Victim Pos:', victim?.position);
                    console.log('Obstacle Dead:', checks.obstacleDead);
                    console.log('Logs:', logs);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
