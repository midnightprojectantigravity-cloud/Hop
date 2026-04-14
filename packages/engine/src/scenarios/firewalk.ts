import { hexEquals, pointToKey } from '../hex';
import type { GameState, Point } from '../types';
import type { ScenarioCollection } from './types';

const getSkillCooldown = (state: GameState, skillId: string): number =>
    state.player.activeSkills.find(skill => skill.id === skillId)?.currentCooldown || 0;

const setFireAt = (engine: any, position: Point): void => {
    engine.setTile(position, 'floor');
    const tile = engine.getTileAt(position);
    if (tile) {
        tile.effects.push({ id: 'FIRE', duration: 3, potency: 1 });
    }
    engine.state.tiles.set(pointToKey(position), tile);
};

const hasStatus = (state: GameState, statusType: string): boolean =>
    state.player.statusEffects.some(status => status.type === statusType);

export const firewalkScenarios: ScenarioCollection = {
    id: 'firewalk',
    name: 'Firewalk',
    description: 'Validates fire/lava targeting, occupied rejection, and capability-adjusted range parity.',
    scenarios: [
        {
            id: 'firewalk_teleports_to_fire',
            title: 'Teleports to Fire Tile',
            description: 'Firewalk teleports onto a fire tile and grants fire immunity.',
            relatedSkills: ['FIREWALK'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['fire', 'teleport', 'status'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['FIREWALK']);
                setFireAt(engine, { q: 4, r: 3, s: -7 });
            },
            run: (engine: any) => {
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'FIREWALK', target: { q: 4, r: 3, s: -7 } }
                });
            },
            verify: (state: GameState, logs: string[]) =>
                hexEquals(state.player.position, { q: 4, r: 3, s: -7 })
                && hasStatus(state, 'fire_immunity')
                && logs.some(log => log.includes('Firewalk'))
        },
        {
            id: 'firewalk_teleports_to_lava',
            title: 'Teleports to Lava Tile',
            description: 'Firewalk can target lava without needing a fire effect.',
            relatedSkills: ['FIREWALK'],
            category: 'movement',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['lava', 'teleport'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['FIREWALK']);
                engine.setTile({ q: 4, r: 2, s: -6 }, 'lava');
            },
            run: (engine: any) => {
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'FIREWALK', target: { q: 4, r: 2, s: -6 } }
                });
            },
            verify: (state: GameState) =>
                hexEquals(state.player.position, { q: 4, r: 2, s: -6 })
                && hasStatus(state, 'fire_immunity')
        },
        {
            id: 'firewalk_rejects_occupied_destination',
            title: 'Rejects Occupied Fire Tile',
            description: 'Firewalk does not consume cooldown when the destination fire tile is occupied.',
            relatedSkills: ['FIREWALK'],
            category: 'targeting',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['fire', 'occupied', 'teleport'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['FIREWALK']);
                setFireAt(engine, { q: 4, r: 3, s: -7 });
                engine.spawnEnemy('footman', { q: 4, r: 3, s: -7 }, 'firewalk_blocker');
            },
            run: (engine: any) => {
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'FIREWALK', target: { q: 4, r: 3, s: -7 } }
                });
            },
            verify: (state: GameState) =>
                hexEquals(state.player.position, { q: 4, r: 5, s: -9 })
                && !hasStatus(state, 'fire_immunity')
                && getSkillCooldown(state, 'FIREWALK') === 0
        },
        {
            id: 'firewalk_phase_step_reduces_range',
            title: 'Phase Step Reduces Firewalk Range',
            description: 'Phase Step lowers Firewalk range by one hex while preserving valid closer teleports.',
            relatedSkills: ['FIREWALK', 'PHASE_STEP'],
            category: 'movement',
            difficulty: 'advanced',
            isTutorial: false,
            tags: ['firewalk', 'phase-step', 'range'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['FIREWALK', 'PHASE_STEP']);
                engine.setTile({ q: 4, r: 1, s: -5 }, 'lava');
                engine.setTile({ q: 4, r: 2, s: -6 }, 'lava');
            },
            run: (engine: any) => {
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'FIREWALK', target: { q: 4, r: 1, s: -5 } }
                });
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'FIREWALK', target: { q: 4, r: 2, s: -6 } }
                });
            },
            verify: (state: GameState) =>
                hexEquals(state.player.position, { q: 4, r: 2, s: -6 })
                && hasStatus(state, 'fire_immunity')
        }
    ]
};
