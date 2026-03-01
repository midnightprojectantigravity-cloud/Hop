import type { GameState } from '../types';
import { applyEffects } from '../systems/effect-engine';
import { tickActorAilments } from '../systems/ailments/runtime';
import type { ScenarioCollection } from './types';

const enableAcae = (engine: any): void => {
    engine.state.ruleset = {
        ...(engine.state.ruleset || {}),
        ailments: {
            acaeEnabled: true,
            version: 'acae-v1'
        }
    };
};

const getCounters = (state: GameState): Record<string, number> => {
    const component = state.player.components?.get('ailments') as { counters?: Record<string, number> } | undefined;
    return component?.counters || {};
};

export const acaeScenarios: ScenarioCollection = {
    id: 'acae',
    name: 'ACAE Pilot',
    description: 'Ailment Counter & Annihilation Engine pilot behavior checks',
    scenarios: [
        {
            id: 'acae_lava_wet_annihilation',
            title: 'ACAE: Lava + Wet annihilation',
            description: 'Wet counters annihilate incoming heat counters deterministically.',
            relatedSkills: ['BASIC_MOVE'],
            category: 'hazards',
            tags: ['acae', 'annihilation'],
            setup: (engine: any) => {
                enableAcae(engine);
            },
            run: (engine: any) => {
                engine.state = applyEffects(engine.state, [
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'burn', amount: 10, source: 'tile' },
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'wet', amount: 5, source: 'tile' }
                ], { sourceId: engine.state.player.id, targetId: engine.state.player.id });
            },
            verify: (state: GameState) => {
                const counters = getCounters(state);
                return (counters.burn || 0) === 5 && (counters.wet || 0) === 0;
            }
        },
        {
            id: 'acae_miasma_poison_stack',
            title: 'ACAE: Miasma poison stack',
            description: 'Poison counters stack from repeated deposits.',
            relatedSkills: ['WAIT'],
            category: 'hazards',
            tags: ['acae', 'poison'],
            setup: (engine: any) => {
                enableAcae(engine);
            },
            run: (engine: any) => {
                engine.state = applyEffects(engine.state, [
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'poison', amount: 4, source: 'tile' },
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'poison', amount: 7, source: 'tile' }
                ], { sourceId: engine.state.player.id, targetId: engine.state.player.id });
            },
            verify: (state: GameState) => {
                const counters = getCounters(state);
                return (counters.poison || 0) === 11;
            }
        },
        {
            id: 'acae_bleed_spear_application',
            title: 'ACAE: Spear-family bleed application',
            description: 'Spear-family basic attack applies bleed counters under ACAE.',
            relatedSkills: ['BASIC_ATTACK', 'SPEAR_THROW'],
            category: 'combat',
            tags: ['acae', 'bleed', 'spear'],
            setup: (engine: any) => {
                enableAcae(engine);
                engine.setPlayer({ q: 3, r: 6, s: -9 }, ['BASIC_ATTACK', 'SPEAR_THROW']);
                engine.spawnEnemy('footman', { q: 4, r: 6, s: -10 }, 'bleed_target', { hp: 30, maxHp: 30 });
            },
            run: (engine: any) => {
                engine.useSkill('BASIC_ATTACK', { q: 4, r: 6, s: -10 });
            },
            verify: (state: GameState) => {
                const enemy = state.enemies.find(e => e.id === 'bleed_target');
                if (!enemy) return false;
                const component = enemy.components?.get('ailments') as { counters?: Record<string, number> } | undefined;
                return Math.max(0, Number(component?.counters?.bleed || 0)) > 0;
            }
        },
        {
            id: 'acae_incinerated_threshold',
            title: 'ACAE: Incinerated threshold trigger',
            description: 'Burn threshold emits INCINERATED threshold event.',
            relatedSkills: ['WAIT'],
            category: 'hazards',
            tags: ['acae', 'threshold'],
            setup: (engine: any) => {
                enableAcae(engine);
            },
            run: (engine: any) => {
                engine.state = applyEffects(engine.state, [
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'burn', amount: 24, source: 'tile' }
                ], { sourceId: engine.state.player.id, targetId: engine.state.player.id });
            },
            verify: (state: GameState) => {
                return (state.simulationEvents || []).some(ev =>
                    ev.type === 'AilmentThresholdTriggered'
                    && ev.payload?.effectId === 'INCINERATED'
                );
            }
        },
        {
            id: 'acae_hardening_tick_and_shock',
            title: 'ACAE: Hardening gain from tick and shock',
            description: 'Hardening progresses from both active tick and annihilation shock.',
            relatedSkills: ['WAIT'],
            category: 'hazards',
            tags: ['acae', 'hardening'],
            setup: (engine: any) => {
                enableAcae(engine);
            },
            run: (engine: any) => {
                engine.state = applyEffects(engine.state, [
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'burn', amount: 9, source: 'tile' },
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'wet', amount: 2, source: 'tile' }
                ], { sourceId: engine.state.player.id, targetId: engine.state.player.id });
                const tickResult = tickActorAilments(engine.state, engine.state.player.id, 'END_OF_TURN', 'acae-hardening');
                engine.state = tickResult.state;
            },
            verify: (state: GameState) => {
                const resilience = state.player.components?.get('ailment_resilience') as { resistancePct?: Record<string, number> } | undefined;
                const burnRes = Number(resilience?.resistancePct?.burn || 0);
                return burnRes > 0;
            }
        },
        {
            id: 'acae_compound_ordering',
            title: 'ACAE: Compound ordering is deterministic',
            description: 'Applying burn+wet+frozen resolves with stable ordering.',
            relatedSkills: ['WAIT'],
            category: 'hazards',
            tags: ['acae', 'ordering'],
            setup: (engine: any) => {
                enableAcae(engine);
            },
            run: (engine: any) => {
                engine.state = applyEffects(engine.state, [
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'burn', amount: 14, source: 'tile' },
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'wet', amount: 4, source: 'tile' },
                    { type: 'DepositAilmentCounters', target: engine.state.player.id, ailment: 'frozen', amount: 3, source: 'tile' }
                ], { sourceId: engine.state.player.id, targetId: engine.state.player.id });
            },
            verify: (state: GameState) => {
                const counters = getCounters(state);
                return (counters.burn || 0) === 10 && (counters.wet || 0) === 0 && (counters.frozen || 0) === 3;
            }
        }
    ]
};
