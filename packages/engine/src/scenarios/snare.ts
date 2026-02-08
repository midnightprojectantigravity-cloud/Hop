import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const snareScenarios: ScenarioCollection = {
    id: 'snare',
    name: 'Snare Terrain',
    description: 'Snare tile effect movement restriction and status interaction.',
    scenarios: [
        {
            id: 'snare_interrupts_dash_and_roots_actor',
            title: 'Snare Interrupts Dash',
            description: 'DASH into a snare tile should halt movement at snare and apply rooted status.',
            relatedSkills: ['DASH'],
            category: 'movement',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['terrain', 'snare', 'movement-restriction'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, ['DASH']);
                engine.state.hasShield = false;
                engine.state.tiles.set('5,4', {
                    baseId: 'STONE',
                    position: { q: 5, r: 4, s: -9 },
                    traits: new Set(['WALKABLE']),
                    effects: [{ id: 'SNARE', duration: -1, potency: 1 }]
                });
                engine.setTile({ q: 6, r: 4, s: -10 }, 'floor');
                engine.setTile({ q: 7, r: 4, s: -11 }, 'floor');
            },
            run: (engine: any) => {
                engine.useSkill('DASH', { q: 7, r: 4, s: -11 });
            },
            verify: (state: GameState, logs: string[]) => {
                const rooted = state.player.statusEffects.some(s => s.type === 'rooted');
                const checks = {
                    stoppedAtSnare: state.player.position.q === 5 && state.player.position.r === 4,
                    rootedApplied: rooted,
                    snareMessageLogged: logs.some(l => l.includes('Snared! Movement halted.')),
                };
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
