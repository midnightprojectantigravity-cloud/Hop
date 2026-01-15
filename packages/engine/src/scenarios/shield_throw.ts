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

            verify: (state: GameState) => {
                const enemy = state.enemies.find(e => e.id === 'victim');
                return enemy?.position.r === 1; // 5 - 4 = 1
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
            tags: ['collision', 'push', 'stun'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_THROW']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
                engine.spawnEnemy('footman', { q: 3, r: 3, s: -6 }, 'obstacle');
            },

            run: (engine: any) => engine.useSkill('SHIELD_THROW', { q: 3, r: 5, s: -8 }),

            verify: (state: GameState) => {
                const enemy = state.enemies.find(e => e.id === 'victim');
                return enemy?.position.r === 4; // Should stop at r:4, before the unit at r:3
            }
        },

        {
            id: 'shield_lava_sink',
            title: 'Shield Lava Sink',
            description: 'Verify enemy sinks when pushed into lava.',
            relatedSkills: ['SHIELD_THROW'],
            category: 'hazards',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['lava', 'push', 'environmental-kill'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_THROW']);
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
                engine.setTile({ q: 3, r: 4, s: -7 }, 'lava');
            },

            run: (engine: any) => engine.useSkill('SHIELD_THROW', { q: 3, r: 5, s: -8 }),

            verify: (state: GameState) => !state.enemies.find(e => e.id === 'victim')
        }
    ]
};
