import { hexEquals } from '../hex';
import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

const hasFireLikeMessage = (logs: string[]): boolean =>
    logs.some(log => log.includes('Meteor Impact'));

export const meteorImpactScenarios: ScenarioCollection = {
    id: 'meteor_impact',
    name: 'Meteor Impact',
    description: 'Validates leap landing, collision damage, and line-of-sight rejection for Meteor Impact.',

    scenarios: [
        {
            id: 'meteor_impact_leap_and_slam',
            title: 'Meteor Impact: Leap and Slam',
            description: 'Meteor Impact leaps to the target hex, damages the target, and leaves the player on the landing hex.',
            relatedSkills: ['METEOR_IMPACT'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['kinetic', 'leap', 'collision'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 2, r: 2, s: -4 }, ['METEOR_IMPACT']);
                engine.spawnEnemy('footman', { q: 2, r: 4, s: -6 }, 'meteor_target');
            },

            run: (engine: any) => {
                engine.useSkill('METEOR_IMPACT', { q: 2, r: 4, s: -6 });
            },

            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(actor => actor.id === 'meteor_target');
                return hexEquals(state.player.position, { q: 2, r: 4, s: -6 })
                    && !!target
                    && target.hp < target.maxHp
                    && hasFireLikeMessage(logs);
            }
        },
        {
            id: 'meteor_impact_rejects_blocked_lane',
            title: 'Meteor Impact: Wall Blocks the Leap Lane',
            description: 'Meteor Impact rejects a target when the lane is blocked by a wall and leaves the board state unchanged.',
            relatedSkills: ['METEOR_IMPACT'],
            category: 'targeting',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['kinetic', 'wall', 'line-of-sight'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 2, r: 2, s: -4 }, ['METEOR_IMPACT']);
                engine.setTile({ q: 2, r: 3, s: -5 }, 'wall');
                engine.spawnEnemy('footman', { q: 2, r: 4, s: -6 }, 'meteor_target');
            },

            run: (engine: any) => {
                engine.useSkill('METEOR_IMPACT', { q: 2, r: 4, s: -6 });
            },

            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(actor => actor.id === 'meteor_target');
                return hexEquals(state.player.position, { q: 2, r: 2, s: -4 })
                    && !!target
                    && target.hp === target.maxHp
                    && logs.some(log => log.includes('Invalid target') || log.includes('No clear line of sight'));
            }
        }
    ]
};
