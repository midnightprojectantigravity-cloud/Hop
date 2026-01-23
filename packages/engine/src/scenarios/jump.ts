import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

/**
 * Jump Scenarios
 * Tests: Range, Obstacles (Lava/Walls), and Stunning Landing
 */
export const jumpScenarios: ScenarioCollection = {
    id: 'jump',
    name: 'Jump',
    description: 'Tests for jump mechanics including range validation and stunning landing',

    scenarios: [
        {
            id: 'jump_basic',
            title: 'Basic Jump',
            description: 'Jump to a tile.',
            relatedSkills: ['JUMP'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['movement', 'leap'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['JUMP']);
            },
            run: (engine: any) => {
                engine.useSkill('JUMP', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                return hexEquals(state.player.position, { q: 3, r: 4, s: -7 }) && logs.some(l => l.includes('Jumped'));
            }
        },
        {
            id: 'jump_stunning_landing',
            title: 'Stunning Landing',
            description: 'Jump into a group of enemies and ensure neighbors are stunned.',
            relatedSkills: ['JUMP'],
            category: 'movement',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['movement', 'stun', 'aoe'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['JUMP']);
                engine.spawnEnemy('shieldBearer', { q: 3, r: 7, s: -10 }, 'neighbor_1');
                engine.spawnEnemy('shieldBearer', { q: 4, r: 7, s: -11 }, 'neighbor_2');
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'distant_enemy');
            },
            run: (engine: any) => {
                engine.useSkill('JUMP', { q: 3, r: 8, s: -11 });
            },
            verify: (state: GameState, logs: string[]) => {
                const n1Stunned = logs.filter(l => l.includes('stunned by landing')).length >= 2;
                const distantNotStunned = !logs.some(l => l.includes('distant_enemy') && l.includes('stunned'));
                const playerAtTarget = state.player.position.r === 8;
                return n1Stunned && distantNotStunned && playerAtTarget;
            }
        }
    ]
};
