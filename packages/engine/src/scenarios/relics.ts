import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

export const relicScenarios: ScenarioCollection = {
    id: 'relics',
    name: 'Relics',
    description: 'Passive relic behaviors using existing engine hooks only.',
    scenarios: [
        {
            id: 'relic_ember_ward_reduces_fire_damage',
            title: 'Relic: Ember Ward',
            description: 'Equipping Ember Ward reduces incoming fire damage by 1.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'passive',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['relic', 'fire', 'passive'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, []);
                engine.state.upgrades = [...(engine.state.upgrades || []), 'RELIC_EMBER_WARD'];
                engine.state.tiles.set('4,4', {
                    baseId: 'STONE',
                    position: { q: 4, r: 4, s: -8 },
                    traits: new Set(['WALKABLE']),
                    effects: [{ id: 'FIRE', duration: -1, potency: 1 }]
                });
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    hpUnchanged: state.player.hp === state.player.maxHp,
                    relicMessageSeen: logs.some(l => l.includes('Ember Ward dampens the flames.')),
                };
                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'relic_cinder_orb_stacks_with_absorb_fire',
            title: 'Relic: Cinder Orb Stacking',
            description: 'Cinder Orb adds bonus healing when fire damage is converted by Absorb Fire.',
            relatedSkills: ['ABSORB_FIRE'],
            category: 'passive',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['relic', 'stacking', 'absorb-fire'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, ['ABSORB_FIRE']);
                engine.state.player = { ...engine.state.player, hp: 1, maxHp: 3 };
                engine.state.upgrades = [...(engine.state.upgrades || []), 'RELIC_CINDER_ORB'];
                engine.state.tiles.set('4,4', {
                    baseId: 'STONE',
                    position: { q: 4, r: 4, s: -8 },
                    traits: new Set(['WALKABLE']),
                    effects: [{ id: 'FIRE', duration: -1, potency: 1 }]
                });
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    healedByStacking: state.player.hp === 3,
                    stackingMessageSeen: logs.some(l => l.includes('Cinder Orb amplifies the absorption.')),
                };
                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'relic_steady_plates_end_to_end',
            title: 'Relic: Steady Plates',
            description: 'Steady Plates grants turn-start armor that resolves against incoming damage in the same round.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'passive',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['relic', 'armor', 'turn-start'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 4, s: -8 }, []);
                engine.state.upgrades = [...(engine.state.upgrades || []), 'RELIC_STEADY_PLATES'];
                engine.state.tiles.set('4,4', {
                    baseId: 'STONE',
                    position: { q: 4, r: 4, s: -8 },
                    traits: new Set(['WALKABLE']),
                    effects: [{ id: 'FIRE', duration: -1, potency: 1 }]
                });
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                const checks = {
                    playerHpProtected: state.player.hp === state.player.maxHp,
                    damageEventOccurred: logs.some(l => l.includes('player burns!')),
                    armorPresentAfterCycle: state.player.temporaryArmor >= 0 && state.player.temporaryArmor <= 2,
                    relicTriggerMessageSeen: logs.some(l => l.includes('Steady Plates harden your stance.')),
                };
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
