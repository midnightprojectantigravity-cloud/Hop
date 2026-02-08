import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const iceScenarios: ScenarioCollection = {
    id: 'ice',
    name: 'Ice Terrain',
    description: 'ICE/SLIPPERY terrain behavior for pass-through momentum and landing slide.',
    scenarios: [
        {
            id: 'ice_pass_preserves_dash_momentum',
            title: 'Ice Pass: Dash Carries Momentum',
            description: 'Passing through ICE during DASH should preserve momentum and carry movement beyond nominal target.',
            relatedSkills: ['DASH'],
            category: 'movement',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['terrain', 'ice', 'momentum', 'pass'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, ['DASH']);
                engine.state.hasShield = false;
                engine.setTile({ q: 5, r: 4, s: -9 }, 'slippery');
                engine.setTile({ q: 6, r: 4, s: -10 }, 'floor');
                engine.setTile({ q: 7, r: 4, s: -11 }, 'floor');
            },
            run: (engine: any) => {
                engine.useSkill('DASH', { q: 6, r: 4, s: -10 });
            },
            verify: (state: GameState) => {
                return state.player.position.q > 6;
            }
        },
        {
            id: 'ice_land_slides_after_basic_move',
            title: 'Ice Land: Basic Move Slides Forward',
            description: 'Landing on ICE with BASIC_MOVE should slide one hex in the move direction when the next tile is walkable.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['terrain', 'ice', 'slide', 'land'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, ['BASIC_MOVE']);
                engine.setTile({ q: 5, r: 4, s: -9 }, 'slippery');
                engine.setTile({ q: 6, r: 4, s: -10 }, 'floor');
            },
            run: (engine: any) => {
                engine.move({ q: 5, r: 4, s: -9 });
            },
            verify: (state: GameState) => {
                return state.player.position.q === 6 && state.player.position.r === 4;
            }
        }
    ]
};
