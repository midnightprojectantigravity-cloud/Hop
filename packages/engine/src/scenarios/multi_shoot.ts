import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const multiShootScenarios: ScenarioCollection = {
    id: 'multi_shoot',
    name: 'Multi-Shoot',
    description: 'Tests for axial targeting and splash damage around the selected impact hex.',

    scenarios: [
        {
            id: 'multi_shoot_hits_target_and_neighbors',
            title: 'Multi-Shoot: Center and Splash',
            description: 'Multi-Shoot damages the selected axial hex and adjacent occupied neighbors.',
            relatedSkills: ['MULTI_SHOOT'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['projectile', 'axial', 'splash'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['MULTI_SHOOT']);
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'primary');
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'neighbor');
            },

            run: (engine: any) => {
                engine.useSkill('MULTI_SHOOT', { q: 3, r: 4, s: -7 });
            },

            verify: (state: GameState, logs: string[]) => {
                const primary = state.enemies.find(enemy => enemy.id === 'primary');
                const neighbor = state.enemies.find(enemy => enemy.id === 'neighbor');
                return !!primary
                    && !!neighbor
                    && primary.hp < primary.maxHp
                    && neighbor.hp < neighbor.maxHp
                    && logs.some(log => log.includes('Multi-Shoot!'));
            }
        },
        {
            id: 'multi_shoot_rejects_non_axial_target',
            title: 'Multi-Shoot: Non-Axial Rejected',
            description: 'Multi-Shoot keeps its axial targeting contract and rejects diagonal targets.',
            relatedSkills: ['MULTI_SHOOT'],
            category: 'targeting',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['projectile', 'axial', 'targeting'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['MULTI_SHOOT']);
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'diagonal_target');
            },

            run: (engine: any) => {
                engine.useSkill('MULTI_SHOOT', { q: 4, r: 4, s: -8 });
            },

            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(enemy => enemy.id === 'diagonal_target');
                return !!target
                    && target.hp === target.maxHp
                    && logs.some(log => log.includes('Invalid target') || log.includes('Axial range 4'));
            }
        }
    ]
};
