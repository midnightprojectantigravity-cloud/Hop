import { pointToKey } from '../hex';
import type { GameState, Point } from '../types';
import type { ScenarioCollection } from './types';

const setCorpseAt = (engine: any, position: Point): void => {
    const key = pointToKey(position);
    const tile = engine.getTileAt(position);
    engine.state.tiles.set(key, {
        ...(tile || {
            baseId: 'STONE',
            position,
            traits: new Set(['WALKABLE']),
            effects: []
        }),
        position,
        traits: new Set([...(tile?.traits || []), 'CORPSE']),
        effects: [...(tile?.effects || [])]
    });
};

const hasCorpseAt = (state: GameState, position: Point): boolean =>
    !!state.tiles.get(pointToKey(position))?.traits?.has('CORPSE');

const getSkillCooldown = (state: GameState, skillId: string): number =>
    state.player.activeSkills.find(skill => skill.id === skillId)?.currentCooldown || 0;

export const corpseExplosionScenarios: ScenarioCollection = {
    id: 'corpse_explosion',
    name: 'Corpse Explosion',
    description: 'Validates corpse-targeted AoE damage, corpse removal, invalid targeting, and max-range parity.',

    scenarios: [
        {
            id: 'corpse_explosion_detonates_corpse',
            title: 'Detonates Corpse and Hits Blast Radius',
            description: 'Corpse Explosion removes the corpse and damages the corpse hex plus adjacent targets.',
            relatedSkills: ['CORPSE_EXPLOSION'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['corpse', 'aoe', 'damage'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 3, s: -6 }, ['CORPSE_EXPLOSION'], 'NECROMANCER');
                setCorpseAt(engine, { q: 4, r: 4, s: -8 });
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'corpse_center');
                engine.spawnEnemy('footman', { q: 5, r: 4, s: -9 }, 'corpse_neighbor');
            },
            run: (engine: any) => {
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'CORPSE_EXPLOSION', target: { q: 4, r: 4, s: -8 } } });
            },
            verify: (state: GameState, logs: string[]) => {
                const center = state.enemies.find(enemy => enemy.id === 'corpse_center');
                const neighbor = state.enemies.find(enemy => enemy.id === 'corpse_neighbor');
                return !hasCorpseAt(state, { q: 4, r: 4, s: -8 })
                    && !!center
                    && !!neighbor
                    && center.hp < center.maxHp
                    && neighbor.hp < neighbor.maxHp
                    && logs.some(log => log.includes('Corpse exploded'));
            }
        },
        {
            id: 'corpse_explosion_rejects_non_corpse',
            title: 'Rejects Non-Corpse Targets',
            description: 'Attempting to explode a non-corpse tile is rejected and does not consume cooldown.',
            relatedSkills: ['CORPSE_EXPLOSION'],
            category: 'targeting',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['corpse', 'targeting', 'invalid'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 3, s: -6 }, ['CORPSE_EXPLOSION'], 'NECROMANCER');
                setCorpseAt(engine, { q: 4, r: 4, s: -8 });
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'corpse_guard');
            },
            run: (engine: any) => {
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'CORPSE_EXPLOSION', target: { q: 5, r: 5, s: -10 } } });
            },
            verify: (state: GameState, logs: string[]) => {
                const guard = state.enemies.find(enemy => enemy.id === 'corpse_guard');
                return hasCorpseAt(state, { q: 4, r: 4, s: -8 })
                    && !!guard
                    && guard.hp === guard.maxHp
                    && getSkillCooldown(state, 'CORPSE_EXPLOSION') === 0
                    && logs.some(log => log.toLowerCase().includes('invalid target'));
            }
        },
        {
            id: 'corpse_explosion_max_range',
            title: 'Explodes at Max Range',
            description: 'Corpse Explosion succeeds at exactly range 4 and still damages adjacent enemies.',
            relatedSkills: ['CORPSE_EXPLOSION'],
            category: 'balancing',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['corpse', 'range', 'aoe'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 1, r: 4, s: -5 }, ['CORPSE_EXPLOSION'], 'NECROMANCER');
                setCorpseAt(engine, { q: 5, r: 4, s: -9 });
                engine.spawnEnemy('footman', { q: 6, r: 4, s: -10 }, 'max_range_neighbor');
            },
            run: (engine: any) => {
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'CORPSE_EXPLOSION', target: { q: 5, r: 4, s: -9 } } });
            },
            verify: (state: GameState, logs: string[]) => {
                const neighbor = state.enemies.find(enemy => enemy.id === 'max_range_neighbor');
                return !hasCorpseAt(state, { q: 5, r: 4, s: -9 })
                    && !!neighbor
                    && neighbor.hp < neighbor.maxHp
                    && logs.some(log => log.includes('Corpse exploded'));
            }
        }
    ]
};
