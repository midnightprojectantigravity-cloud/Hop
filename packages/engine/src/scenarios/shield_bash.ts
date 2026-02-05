import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

/**
 * Shield Bash Scenarios
 * Tests: Melee push, wall collision, and lava interactions
 */
export const shieldBashScenarios: ScenarioCollection = {
    id: 'shield_bash',
    name: 'Shield Bash',
    description: 'Tests for shield bash mechanics including push, stun, and collision behavior',

    scenarios: [
        {
            id: 'bash_push',
            title: 'Shield Push',
            description: 'Push an enemy into lava.',
            relatedSkills: ['SHIELD_BASH'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['push', 'displacement', 'lava'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_BASH']);
                engine.setTile({ q: 3, r: 4, s: -7 }, 'lava');
                engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'victim');
            },
            run: (engine: any) => {
                engine.useSkill('SHIELD_BASH', { q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    enemyGone: state.enemies.length === 0,
                    messageOk: logs.some(l => l.includes('Lava')),
                };
                if (Object.values(checks).some(v => v === false)) {
                    console.log('❌ Scenario Failed Details:', checks);
                    console.log('Current Player Pos:', state.player.position);
                    console.log('Logs found:', logs);
                }
                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'bash_wall_stun',
            title: 'Wall Slam Stun',
            description: 'Bash enemy into wall to cause a stun.',
            relatedSkills: ['SHIELD_BASH'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['collision', 'wall', 'stun'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['SHIELD_BASH']);
                engine.spawnEnemy('shieldBearer', { q: 3, r: 5, s: -8 }, 'victim');
                engine.setTile({ q: 3, r: 4, s: -7 }, 'wall');
            },
            run: (engine: any) => {
                engine.useSkill('SHIELD_BASH', { q: 3, r: 5, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'victim');
                if (!enemy) return false;
                const inPlace = hexEquals(enemy.position, { q: 3, r: 5, s: -8 });
                const logConfirm = logs.some(l => l.includes('into obstacle'));
                return inPlace && logConfirm;
            }
        }
    ]
};
