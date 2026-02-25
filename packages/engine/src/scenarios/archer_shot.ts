import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const archerShotScenarios: ScenarioCollection = {
    id: 'archer_shot',
    name: 'Archer Shot',
    description: 'Tests for dedicated archer ranged line-shot targeting, LoS, and axial validation.',

    scenarios: [
        {
            id: 'archer_shot_clear_lane_hit',
            title: 'Archer Shot: Clear Lane Hit',
            description: 'A valid axial target in clear line of sight is damaged.',
            relatedSkills: ['ARCHER_SHOT'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['projectile', 'line-of-sight', 'axial'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['ARCHER_SHOT']);
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'target');
            },
            run: (engine: any) => {
                engine.useSkill('ARCHER_SHOT', { q: 3, r: 4, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(e => e.id === 'target');
                const hitLanded = !target || target.hp < target.maxHp;
                const castMessage = logs.some(l => l.includes('Archer shot!'));
                return hitLanded && castMessage;
            }
        },
        {
            id: 'archer_shot_wall_blocked',
            title: 'Archer Shot: Wall Blocks Line of Sight',
            description: 'Archer Shot fails when a wall blocks the line to the target actor.',
            relatedSkills: ['ARCHER_SHOT'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['projectile', 'line-of-sight', 'wall'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 6, s: -10 }, ['ARCHER_SHOT']);
                engine.spawnEnemy('footman', { q: 4, r: 3, s: -7 }, 'target');
                engine.setTile({ q: 4, r: 4, s: -8 }, 'wall');
            },
            run: (engine: any) => {
                engine.useSkill('ARCHER_SHOT', { q: 4, r: 3, s: -7 });
            },
            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(e => e.id === 'target');
                const targetUntouched = !!target && target.hp === target.maxHp;
                const losRejected = logs.some(l => l.includes('No clear line of sight'));
                return targetUntouched && losRejected;
            }
        },
        {
            id: 'archer_shot_rejects_non_axial',
            title: 'Archer Shot: Non-Axial Target Rejected',
            description: 'Archer Shot enforces axial targeting and rejects diagonal targets.',
            relatedSkills: ['ARCHER_SHOT'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['projectile', 'axial', 'targeting'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['ARCHER_SHOT']);
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'target');
            },
            run: (engine: any) => {
                engine.useSkill('ARCHER_SHOT', { q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(e => e.id === 'target');
                const targetUntouched = !!target && target.hp === target.maxHp;
                const axialRejected = logs.some(l => l.includes('Target must be axial'));
                return targetUntouched && axialRejected;
            }
        }
    ]
};

