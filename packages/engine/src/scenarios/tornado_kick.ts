import { hexEquals } from '../hex';
import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

const hasKickMessage = (logs: string[]): boolean =>
    logs.some(log => log.includes('Tornado Kick'));

export const tornadoKickScenarios: ScenarioCollection = {
    id: 'tornado_kick',
    name: 'Tornado Kick',
    description: 'Validates pull-then-push sequencing, collision handling, and range rejection for Tornado Kick.',

    scenarios: [
        {
            id: 'tornado_kick_shifts_target',
            title: 'Tornado Kick: Pull Then Push',
            description: 'Tornado Kick resolves a nearby enemy through the full pull/push sequence and leaves them displaced.',
            relatedSkills: ['TORNADO_KICK'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['kinetic', 'pull', 'push'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 2, r: 2, s: -4 }, ['TORNADO_KICK']);
                engine.spawnEnemy('footman', { q: 3, r: 2, s: -5 }, 'tornado_target');
            },

            run: (engine: any) => {
                engine.useSkill('TORNADO_KICK', { q: 3, r: 2, s: -5 });
            },

            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(actor => actor.id === 'tornado_target');
                return !!target
                    && hexEquals(target.position, { q: 6, r: 2, s: -8 })
                    && target.hp < target.maxHp
                    && hasKickMessage(logs);
            }
        },
        {
            id: 'tornado_kick_stops_on_wall_collision',
            title: 'Tornado Kick: Stops on Wall Collision',
            description: 'Tornado Kick stuns and stops when the push path hits a wall.',
            relatedSkills: ['TORNADO_KICK'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['kinetic', 'wall', 'stun'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 2, r: 2, s: -4 }, ['TORNADO_KICK']);
                engine.spawnEnemy('footman', { q: 3, r: 2, s: -5 }, 'tornado_target');
                engine.setTile({ q: 4, r: 2, s: -6 }, 'wall');
            },

            run: (engine: any) => {
                engine.useSkill('TORNADO_KICK', { q: 3, r: 2, s: -5 });
            },

            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(actor => actor.id === 'tornado_target');
                const stunned = !!target?.statusEffects.some(status => status.type === 'stunned');
                return !!target
                    && hexEquals(target.position, { q: 3, r: 2, s: -5 })
                    && stunned
                    && hasKickMessage(logs)
                    && logs.some(log => log.toLowerCase().includes('stunned'));
            }
        },
        {
            id: 'tornado_kick_rejects_non_adjacent_target',
            title: 'Tornado Kick: Rejects Distant Targets',
            description: 'Tornado Kick only accepts adjacent targets and leaves distant enemies untouched.',
            relatedSkills: ['TORNADO_KICK'],
            category: 'targeting',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['kinetic', 'range', 'targeting'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 2, r: 2, s: -4 }, ['TORNADO_KICK']);
                engine.spawnEnemy('footman', { q: 4, r: 2, s: -6 }, 'tornado_target');
            },

            run: (engine: any) => {
                engine.useSkill('TORNADO_KICK', { q: 4, r: 2, s: -6 });
            },

            verify: (state: GameState, logs: string[]) => {
                const target = state.enemies.find(actor => actor.id === 'tornado_target');
                return !!target
                    && hexEquals(target.position, { q: 4, r: 2, s: -6 })
                    && target.hp === target.maxHp
                    && logs.some(log => log.includes('Invalid target') || log.includes('Out of range'));
            }
        }
    ]
};
