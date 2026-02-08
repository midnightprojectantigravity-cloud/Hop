import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

/**
 * Spear Throw Scenarios
 * Tests: Range, Line of Sight, Obstacles, and Item Spawning
 */
export const spearThrowScenarios: ScenarioCollection = {
    id: 'spear_throw',
    name: 'Spear Throw',
    description: 'Tests for spear throw mechanics including range, LoS, and spear retrieval',

    scenarios: [
        {
            id: 'spear_kill',
            title: 'Spear Kill',
            description: 'Throw spear to kill an enemy and verify item spawn.',
            relatedSkills: ['SPEAR_THROW'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['projectile', 'combat', 'item-spawn'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SPEAR_THROW']);
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'target');
                engine.state.hasSpear = true;
            },
            run: (engine: any) => {
                engine.useSkill('SPEAR_THROW', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemyDead = !state.enemies.find(e => e.id === 'target');
                const spearSpawned = !!state.spearPosition && state.spearPosition.q === 3 && state.spearPosition.r === 4;
                const killMessage = logs.some(l => l.includes('Spear killed'));
                return enemyDead && spearSpawned && killMessage;
            }
        },
        {
            id: 'spear_miss_spawn',
            title: 'Spear Rejects Empty Tile',
            description: 'Enemy-only contract: empty tiles are invalid targets and do not spawn spear.',
            relatedSkills: ['SPEAR_THROW'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['projectile', 'item-spawn'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SPEAR_THROW']);
                engine.state.hasSpear = true;
            },
            run: (engine: any) => {
                engine.useSkill('SPEAR_THROW', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const rejected = logs.some(l => l.includes('No enemy at target.'));
                const spearStillHeld = state.hasSpear === true && !state.spearPosition;
                return rejected && spearStillHeld;
            }
        },
        {
            id: 'spear_wall_block',
            title: 'Spear Wall Block',
            description: 'Spear throw is blocked by walls.',
            relatedSkills: ['SPEAR_THROW'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['projectile', 'wall', 'boundary'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['SPEAR_THROW']);
                engine.spawnEnemy('footman', { q: 4, r: 3, s: -7 }, 'target');
                engine.setTile({ q: 4, r: 4, s: -8 }, 'wall');
                engine.state.hasSpear = true;
            },
            run: (engine: any) => {
                // Attempt to throw past the wall
                engine.useSkill('SPEAR_THROW', { q: 4, r: 3, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const losBlocked = logs.some(l => l.includes('No clear line of sight to enemy.'));
                const targetAlive = !!state.enemies.find(e => e.id === 'target');
                const spearStillHeld = state.hasSpear === true && !state.spearPosition;
                return losBlocked && targetAlive && spearStillHeld;
            }
        }
    ]
};
