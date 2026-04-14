import { hexEquals } from '../hex';
import type { GameState, Point } from '../types';
import type { ScenarioCollection } from './types';

const getSkillCooldown = (state: GameState, skillId: string): number =>
    state.player.activeSkills.find(skill => skill.id === skillId)?.currentCooldown || 0;

const getBombAt = (state: GameState, position: Point) =>
    state.enemies.find(enemy => enemy.subtype === 'bomb' && hexEquals(enemy.position, position));

export const bombTossScenarios: ScenarioCollection = {
    id: 'bomb_toss',
    name: 'Bomb Toss',
    description: 'Validates bomb spawning, invalid targeting, and max-range throw parity.',
    scenarios: [
        {
            id: 'bomb_toss_spawns_bomb',
            title: 'Throws Bomb onto Empty Tile',
            description: 'Bomb Toss spawns a bomb actor with the expected passive loadout and fuse.',
            relatedSkills: ['BOMB_TOSS'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['bomb', 'spawn', 'ephemeral'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BOMB_TOSS']);
            },
            run: (engine: any) => {
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'BOMB_TOSS', target: { q: 4, r: 4, s: -8 } }
                });
            },
            verify: (state: GameState, logs: string[]) => {
                const bomb = getBombAt(state, { q: 4, r: 4, s: -8 });
                const fuse = bomb?.statusEffects.find(status => status.type === 'time_bomb');
                return !!bomb
                    && bomb.factionId === state.player.factionId
                    && bomb.activeSkills.some(skill => skill.id === 'TIME_BOMB')
                    && bomb.activeSkills.some(skill => skill.id === 'VOLATILE_PAYLOAD')
                    && fuse?.duration === 2
                    && logs.some(log => log.includes('Bomb tossed'));
            }
        },
        {
            id: 'bomb_toss_rejects_occupied_tile',
            title: 'Rejects Occupied Throw Target',
            description: 'Bomb Toss does not spawn a bomb or consume cooldown when the target tile is occupied.',
            relatedSkills: ['BOMB_TOSS'],
            category: 'targeting',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['bomb', 'targeting', 'occupied'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BOMB_TOSS']);
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'bomb_blocker');
            },
            run: (engine: any) => {
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'BOMB_TOSS', target: { q: 4, r: 4, s: -8 } }
                });
            },
            verify: (state: GameState) =>
                !getBombAt(state, { q: 4, r: 4, s: -8 })
                && !!state.enemies.find(enemy => enemy.id === 'bomb_blocker')
                && getSkillCooldown(state, 'BOMB_TOSS') === 0
        },
        {
            id: 'bomb_toss_rejects_blocked_tile',
            title: 'Rejects Blocked Throw Target',
            description: 'Bomb Toss does not spawn a bomb or consume cooldown when the target tile is a wall.',
            relatedSkills: ['BOMB_TOSS'],
            category: 'targeting',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['bomb', 'targeting', 'wall'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BOMB_TOSS']);
                engine.setTile({ q: 4, r: 4, s: -8 }, 'wall');
            },
            run: (engine: any) => {
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'BOMB_TOSS', target: { q: 4, r: 4, s: -8 } }
                });
            },
            verify: (state: GameState) =>
                !getBombAt(state, { q: 4, r: 4, s: -8 })
                && getSkillCooldown(state, 'BOMB_TOSS') === 0
        },
        {
            id: 'bomb_toss_max_range_spawn',
            title: 'Spawns Bomb at Max Range',
            description: 'Bomb Toss succeeds at exactly range 3.',
            relatedSkills: ['BOMB_TOSS'],
            category: 'balancing',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['bomb', 'range'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 6, s: -10 }, ['BOMB_TOSS']);
            },
            run: (engine: any) => {
                engine.dispatchSync({
                    type: 'USE_SKILL',
                    payload: { skillId: 'BOMB_TOSS', target: { q: 4, r: 3, s: -7 } }
                });
            },
            verify: (state: GameState) =>
                !!getBombAt(state, { q: 4, r: 3, s: -7 })
        }
    ]
};
