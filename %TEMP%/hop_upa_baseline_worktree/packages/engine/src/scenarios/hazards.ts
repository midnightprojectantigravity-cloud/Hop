import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

export const hazardScenarios: ScenarioCollection = {
    id: 'hazards_v1',
    name: 'Hazard Consolidation',
    description: 'Verifies centralized hazard logic and flight immunity',
    scenarios: [
        {
            id: 'Jump Over Lava',
            title: 'Jump Over Lava',
            description: 'Jumping over lava should not result in damage.',
            relatedSkills: ['JUMP'],
            category: 'hazards',
            tags: ['lava', 'jump'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['JUMP']);
                // Ensure tiles map is updated
                engine.state.tiles.set('4,8', { baseId: 'LAVA', position: { q: 4, r: 8, s: -12 }, traits: new Set(['HAZARDOUS', 'LAVA', 'LIQUID']), effects: [] });
            },
            run: (engine: any) => {
                engine.useSkill('JUMP', { q: 4, r: 7, s: -11 });
            },
            verify: (state: any) => {
                const player = state.player;
                const checks = {
                    playerPos: hexEquals(player.position, { q: 4, r: 7, s: -11 }),
                    isAlive: player.hp === player.maxHp
                };
                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'Walk Into Lava',
            title: 'Walk Into Lava',
            description: 'Walking into lava should be invalid unless the mover is hazard-safe.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'hazards',
            tags: ['lava', 'walk'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['BASIC_MOVE']);
                engine.state.tiles.set('4,8', { baseId: 'LAVA', position: { q: 4, r: 8, s: -12 }, traits: new Set(['HAZARDOUS', 'LAVA', 'LIQUID']), effects: [] });
            },
            run: (engine: any) => {
                engine.useSkill('BASIC_MOVE', { q: 4, r: 8, s: -12 });
            },
            verify: (state: any) => {
                const player = state.player;
                const checks = {
                    playerPos: hexEquals(player.position, { q: 4, r: 9, s: -13 }),
                    hpUnchanged: player.hp === player.maxHp
                };
                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'Falcon Flying Over Lava',
            title: 'Falcon Flying Over Lava',
            description: 'Flying units (Falcon) should ignore lava during transit and stay.',
            relatedSkills: ['FALCON_COMMAND'],
            category: 'hazards',
            tags: ['lava', 'falcon', 'flight'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 9, s: -13 }, ['FALCON_COMMAND']);
                engine.spawnFalcon({ q: 4, r: 8, s: -12 }, 'my-falcon');
                engine.state.tiles.set('4,8', { baseId: 'LAVA', position: { q: 4, r: 8, s: -12 }, traits: new Set(['HAZARDOUS', 'LAVA', 'LIQUID']), effects: [] });
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: any) => {
                const falcon = state.enemies.find((e: any) => e.id === 'my-falcon');
                const checks = {
                    falconExists: !!falcon,
                    falconAlive: (falcon?.hp || 0) > 0,
                    falconPos: hexEquals(falcon?.position, { q: 4, r: 8, s: -12 })
                };
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
