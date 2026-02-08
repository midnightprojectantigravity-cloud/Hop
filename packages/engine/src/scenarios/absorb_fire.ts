import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

export const absorbFireScenarios: ScenarioCollection = {
    id: 'absorb_fire',
    name: 'Absorb Fire Passive',
    description: 'Verifies that fire damage is converted to healing.',
    scenarios: [
        {
            id: 'Absorb Fire Damage',
            title: 'Stand on Fire',
            description: 'Player with Absorb Fire should be healed when standing on fire.',
            relatedSkills: ['ABSORB_FIRE'],
            category: 'passive',
            tags: ['fire', 'healing'],
            setup: (engine: any) => {
                // Set player with 1/3 HP and the skill
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['ABSORB_FIRE']);
                engine.state.player.hp = 1;

                // Place fire under player
                engine.setTile({ q: 4, r: 5, s: -9 }, 'stone');

                // Use pointToKey to find tile
                const p = { q: 4, r: 5, s: -9 };
                const tile = engine.getTileAt(p);
                if (tile) {
                    tile.effects.push({ id: 'FIRE', duration: 3, potency: 1 });
                }
            },
            run: (engine: any) => {
                // Wait to trigger end-of-turn fire damage
                engine.wait();
            },
            verify: (state: any) => {
                const player = state.player;
                if (player.hp <= 1) console.log('Stand on Fire Failed: HP did not increase', player.hp);
                // Should have healed from 1 to 2
                return player.hp > 1;
            }
        },
        {
            id: 'Absorb Lava Damage',
            title: 'Walk into Lava',
            description: 'Player with Absorb Fire should be healed when walking into lava.',
            relatedSkills: ['ABSORB_FIRE', 'BASIC_MOVE'],
            category: 'passive',
            tags: ['lava', 'healing'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['ABSORB_FIRE', 'BASIC_MOVE']);
                engine.state.player.hp = 1;

                // Place lava on an adjacent in-bounds tile.
                engine.setTile({ q: 4, r: 6, s: -10 }, 'lava');
            },
            run: (engine: any) => {
                // Walk into lava
                engine.useSkill('BASIC_MOVE', { q: 4, r: 6, s: -10 });
            },
            verify: (state: any) => {
                const player = state.player;
                // Should be alive and healed (Lava does 99 dmg -> +99 hp -> Max HP)
                const checks = {
                    alive: player.hp > 0,
                    healed: player.hp === player.maxHp,
                    onLava: hexEquals(player.position, { q: 4, r: 6, s: -10 })
                };
                if (!checks.alive || !checks.healed || !checks.onLava) {
                    console.log('Walk into Lava Failed:', checks, 'HP:', player.hp, 'MaxHP:', player.maxHp);
                    console.log('Player Pos:', player.position);
                }
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
