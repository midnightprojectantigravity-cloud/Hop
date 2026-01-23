import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

/**
 * Environmental Hazard Scenarios
 * Tests: Slippery tiles (sliding) and Void tiles (damage)
 */
export const hazardScenarios: ScenarioCollection = {
    id: 'hazards',
    name: 'Floor Hazards',
    description: 'Tests for environmental floor hazards like slippery ice and void consume',

    scenarios: [
        {
            id: 'slippery_slide',
            title: 'Slippery Slide',
            description: 'Moving onto a slippery tile causes a slide in the same direction.',
            relatedSkills: ['THEME_HAZARDS'],
            category: 'hazards',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['slippery', 'movement', 'environment'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, ['BASIC_MOVE']);
                engine.setTile({ q: 4, r: 4, s: -8 }, 'slippery');
            },
            run: (engine: any) => {
                engine.move({ q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, _logs: string[]) => {
                const expectedPos = { q: 5, r: 4, s: -9 };
                return hexEquals(state.player.position, expectedPos);
            }
        },
        {
            id: 'slippery_chain_slide',
            title: 'Chain Slippery Slide',
            description: 'Sliding onto another slippery tile continues the slide.',
            relatedSkills: ['THEME_HAZARDS'],
            category: 'hazards',
            difficulty: 'intermediate',
            isTutorial: true,
            tags: ['slippery', 'movement', 'environment'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, ['BASIC_MOVE']);
                engine.setTile({ q: 4, r: 4, s: -8 }, 'slippery');
                engine.setTile({ q: 5, r: 4, s: -9 }, 'slippery');
            },
            run: (engine: any) => {
                engine.move({ q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, _logs: string[]) => {
                const expectedPos = { q: 6, r: 4, s: -10 };
                return hexEquals(state.player.position, expectedPos);
            }
        },
        {
            id: 'void_tile_damage',
            title: 'Void Tile Damage',
            description: 'Ending a move on a void tile deals damage.',
            relatedSkills: ['THEME_HAZARDS'],
            category: 'hazards',
            difficulty: 'beginner',
            isTutorial: true,
            tags: ['void', 'damage', 'environment'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, ['BASIC_MOVE']);
                engine.state.player.hp = 3;
                engine.setTile({ q: 4, r: 4, s: -8 }, 'void');
            },
            run: (engine: any) => {
                engine.move({ q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                const damaged = state.player.hp === 2;
                const messageOk = logs.some(l => l.includes('Void consumes'));
                return damaged && messageOk;
            }
        }
    ]
};
