import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

export const tileInteractionScenarios: ScenarioCollection = {
    id: 'tile_interactions',
    name: 'Tile Interactions',
    description: 'Verifies interactions with special tiles like Shrines and Stairs.',
    scenarios: [
        {
            id: 'shrine_interaction',
            title: 'Shrine Interaction',
            description: 'Moving onto a shrine should trigger an upgrade choice.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'progression',
            tags: ['shrine', 'upgrade'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BASIC_MOVE']);
                engine.state.shrinePosition = { q: 4, r: 6, s: -10 };
                engine.state.tiles.set('4,6', {
                    baseId: 'SHRINE',
                    position: { q: 4, r: 6, s: -10 },
                    traits: new Set(['INTERACTABLE', 'SHRINE']),
                    effects: []
                });
            },
            run: (engine: any) => {
                engine.move({ q: 4, r: 6, s: -10 });
            },
            verify: (state: GameState) => {
                const checks = {
                    playerOnShrine: hexEquals(state.player.position, { q: 4, r: 6, s: -10 }),
                    isChoosingUpgrade: state.pendingStatus?.status === 'choosing_upgrade',
                    hasOptions: (state.pendingStatus as any)?.shrineOptions?.length > 0
                };
                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'stairs_interaction',
            title: 'Stairs Interaction',
            description: 'Moving onto stairs should trigger level transition.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'progression',
            tags: ['stairs', 'portal'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BASIC_MOVE']);
                engine.state.stairsPosition = { q: 4, r: 6, s: -10 };
                engine.state.tiles.set('4,6', {
                    baseId: 'STAIRS',
                    position: { q: 4, r: 6, s: -10 },
                    traits: new Set(['INTERACTABLE', 'STAIRS']),
                    effects: []
                });
            },
            run: (engine: any) => {
                engine.move({ q: 4, r: 6, s: -10 });
            },
            verify: (state: GameState) => {
                const checks = {
                    playerOnStairs: hexEquals(state.player.position, { q: 4, r: 6, s: -10 }),
                    isTransitioning: state.pendingStatus?.status === 'playing' || state.pendingStatus?.status === 'won',
                    messageFound: state.message.some(m => m.includes('Descending') || m.includes('Cleared'))
                };
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
