import type { GameState } from '../types';
import type { ScenarioCollection } from './types';

const makeSkill = (id: string) => {
    const byId: Record<string, { slot: 'offensive' | 'passive' | 'utility' | 'defensive'; range: number; cooldown: number; name: string; description: string }> = {
        BASIC_MOVE: { slot: 'passive', range: 1, cooldown: 0, name: 'Walk', description: 'Move to adjacent tile.' },
        BASIC_ATTACK: { slot: 'passive', range: 1, cooldown: 0, name: 'Basic Attack', description: 'Strike adjacent target.' },
        GRAPPLE_HOOK: { slot: 'offensive', range: 4, cooldown: 0, name: 'Grapple Hook', description: 'Pull and swap with target.' },
    };
    const def = byId[id] || { slot: 'offensive' as const, range: 1, cooldown: 0, name: id, description: id };
    return {
        id,
        name: def.name,
        description: def.description,
        slot: def.slot,
        cooldown: def.cooldown,
        currentCooldown: 0,
        range: def.range,
        upgrades: [],
        activeUpgrades: []
    } as any;
};

export const pouncerHookScenarios: ScenarioCollection = {
    id: 'pouncer_hook',
    name: 'Pouncer Hook',
    description: 'Second archetype reuse: enemy uses player GRAPPLE_HOOK via normal skill execution.',
    scenarios: [
        {
            id: 'pouncer_uses_grapple_hook_deterministically',
            title: 'Pouncer Uses Grapple Hook Through Skill Pipeline',
            description: 'Pouncer selects GRAPPLE_HOOK from AI and resolves via standard USE_SKILL execution.',
            relatedSkills: ['GRAPPLE_HOOK'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['parity', 'enemy-ai', 'determinism'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 6, s: -10 }, []);
                engine.spawnEnemy('pouncer', { q: 4, r: 2, s: -6 }, 'pouncer');
                const pouncer = engine.getEnemy('pouncer');
                if (pouncer) {
                    pouncer.activeSkills = [
                        makeSkill('BASIC_MOVE'),
                        makeSkill('BASIC_ATTACK'),
                        makeSkill('GRAPPLE_HOOK')
                    ];
                }
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) => {
                const pouncer = state.enemies.find(e => e.id === 'pouncer');
                const checks = {
                    pouncerStillAlive: !!pouncer,
                    grappleExecuted: logs.filter(l => l.includes('Vaulted and Flung!')).length === 2,
                    deterministicStatus: logs.filter(l => l.includes('You are stunned!')).length === 1,
                    noZeroEffectWarning: !logs.some(l => l.includes('produced ZERO effects')),
                };
                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
