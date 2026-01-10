import type { SkillDefinition, GameState } from '../types';
import { hexEquals } from '../hex';

/**
 * THEME HAZARD SCENARIOS
 * This is a "Dummy Skill" used to register scenarios for testing floor hazards
 * like Slippery Tiles and Void Tiles.
 */
export const THEME_HAZARDS: SkillDefinition = {
    id: 'THEME_HAZARDS',
    name: 'Theme Hazards',
    description: 'Internal skill for testing floor themes.',
    slot: 'passive',
    icon: '🧊',
    baseVariables: {
        range: 0,
        cost: 0,
        cooldown: 0,
    },
    execute: (_state: GameState) => {
        return { effects: [], messages: [] };
    },
    upgrades: {},
    scenarios: [
        {
            id: 'slippery_slide',
            title: 'Slippery Slide',
            description: 'Moving onto a slippery tile causes a slide in the same direction.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, []);
                // Set slippery tile at (4, 4, -8)
                engine.setTile({ q: 4, r: 4, s: -8 }, 'slippery');
            },
            run: (engine: any) => {
                // Move from (3,4) to (4,4)
                engine.move({ q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, _logs: string[]) => {
                // Expected to slide one more step in same direction: (4,4) + (1,0) = (5,4)
                const expectedPos = { q: 5, r: 4, s: -9 };
                return hexEquals(state.player.position, expectedPos);
            }
        },
        {
            id: 'slippery_chain_slide',
            title: 'Chain Slippery Slide',
            description: 'Sliding onto another slippery tile continues the slide.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, []);
                // Set two slippery tiles in a row: (4,4) and (5,4)
                engine.setTile({ q: 4, r: 4, s: -8 }, 'slippery');
                engine.setTile({ q: 5, r: 4, s: -9 }, 'slippery');
            },
            run: (engine: any) => {
                engine.move({ q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, _logs: string[]) => {
                // Move(3,4->4,4) -> Slide(4,4->5,4) -> Slide(5,4->6,4)
                const expectedPos = { q: 6, r: 4, s: -10 };
                return hexEquals(state.player.position, expectedPos);
            }
        },
        {
            id: 'void_tile_damage',
            title: 'Void Tile Damage',
            description: 'Ending a move on a void tile deals damage.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, []);
                engine.state.player.hp = 3;
                engine.setTile({ q: 4, r: 4, s: -8 }, 'void');
            },
            run: (engine: any) => {
                engine.move({ q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                // HP should drop from 3 to 2
                const damaged = state.player.hp === 2;
                const messageOk = logs.some(l => l.includes('Void consumes'));
                return damaged && messageOk;
            }
        },
        {
            id: 'slippery_into_void',
            title: 'Slippery into Void',
            description: 'Sliding onto a void tile also triggers the void effect.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 4, s: -7 }, []);
                engine.state.player.hp = 3;
                engine.setTile({ q: 4, r: 4, s: -8 }, 'slippery');
                engine.setTile({ q: 5, r: 4, s: -9 }, 'void');
            },
            run: (engine: any) => {
                engine.move({ q: 4, r: 4, s: -8 });
            },
            verify: (state: GameState, logs: string[]) => {
                // Position should be (5,4) and HP should be 2
                const posOk = hexEquals(state.player.position, { q: 5, r: 4, s: -9 });
                const damaged = state.player.hp === 2;
                const messageOk = logs.some(l => l.includes('Void consumes'));
                return posOk && damaged && messageOk;
            }
        },
        {
            id: 'enemy_slippery_slide',
            title: 'Enemy Slippery Slide',
            description: 'Enemies ending a move on a slippery tile also slide.',
            setup: (engine: any) => {
                engine.setPlayer({ q: 6, r: 4, s: -10 }, []); // Far away axial line
                engine.spawnEnemy('footman', { q: 3, r: 4, s: -7 }, 'victim');
                engine.setTile({ q: 4, r: 4, s: -8 }, 'slippery');
            },
            run: (engine: any) => {
                // Footman moves toward player (q:6, r:4).
                // From (3,4), best move is (4,4) [distance 3 -> 2].
                // (4,4) is slippery, so it should slide to (5,4).
                engine.wait();
            },
            verify: (state: GameState, _logs: string[]) => {
                const enemy = state.enemies.find(e => e.id === 'victim');
                if (!enemy) return false;
                // Move(3,4->4,4) -> Slide(4,4->5,4)
                return hexEquals(enemy.position, { q: 5, r: 4, s: -9 });
            }
        }
    ]
};
