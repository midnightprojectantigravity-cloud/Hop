import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const setTrapScenarios: ScenarioCollection = {
    id: 'set_trap',
    name: 'Set Trap',
    description: 'Validates trap placement rules for occupied, blocked, and hazardous tiles.',

    scenarios: [
        {
            id: 'set_trap_allows_occupied_tiles',
            title: 'Occupied Tile Placement',
            description: 'Set Trap can be placed on an occupied adjacent tile and still registers ownership correctly.',
            relatedSkills: ['SET_TRAP'],
            category: 'deployment',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['trap', 'occupied', 'deployment'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, ['SET_TRAP'], 'HUNTER');
                engine.spawnEnemy('footman', { q: 5, r: 4, s: -9 }, 'trap_target');
            },

            run: (engine: any) => {
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'SET_TRAP', target: { q: 5, r: 4, s: -9 } } });
            },

            verify: (state: GameState, logs: string[]) => {
                const trap = state.traps?.find(candidate =>
                    candidate.position.q === 5
                    && candidate.position.r === 4
                    && candidate.position.s === -9
                );
                return !!trap
                    && trap.ownerId === state.player.id
                    && logs.some(log => log.includes('Trap set.'));
            }
        },
        {
            id: 'set_trap_rejects_blocked_or_lava_tiles',
            title: 'Blocked And Lava Rejection',
            description: 'Set Trap does not place traps on blocked wall or lava tiles.',
            relatedSkills: ['SET_TRAP'],
            category: 'hazards',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['trap', 'hazard', 'wall'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, ['SET_TRAP'], 'HUNTER');
                engine.setTile({ q: 5, r: 4, s: -9 }, 'wall');
                engine.setTile({ q: 4, r: 5, s: -9 }, 'lava');
            },

            run: (engine: any) => {
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'SET_TRAP', target: { q: 5, r: 4, s: -9 } } });
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'SET_TRAP', target: { q: 4, r: 5, s: -9 } } });
            },

            verify: (state: GameState, logs: string[]) =>
                (state.traps || []).length === 0
                && logs.some(log => log.includes('Invalid target') || log.includes('Cannot place trap here!'))
        }
    ]
};
