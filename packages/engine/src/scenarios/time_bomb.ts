import { buildBombFuseStatus, createBombActor } from '../systems/effects/bomb-runtime';
import type { GameState, Point } from '../types';
import type { ScenarioCollection } from './types';

const addBomb = (engine: any, id: string, position: Point, fuseDuration: number): void => {
    const bomb = createBombActor(id, position, 'enemy');
    bomb.statusEffects = [buildBombFuseStatus(fuseDuration)];
    engine.state.enemies.push(bomb);
};

export const timeBombScenarios: ScenarioCollection = {
    id: 'time_bomb',
    name: 'Time Bomb',
    description: 'Validates fuse gating, live detonation, and bomb self-removal parity.',
    scenarios: [
        {
            id: 'time_bomb_idle_fuse_turn',
            title: 'Fuse Above One Waits',
            description: 'A bomb with fuse 2 survives one live turn loop without exploding.',
            relatedSkills: ['TIME_BOMB'],
            category: 'passive',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['bomb', 'fuse', 'timing'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BASIC_MOVE']);
                addBomb(engine, 'scenario-bomb-idle', { q: 4, r: 6, s: -10 }, 2);
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState, logs: string[]) =>
                !!state.enemies.find(enemy => enemy.id === 'scenario-bomb-idle')
                && state.player.hp === state.player.maxHp
                && !logs.some(log => log.includes('exploded'))
        },
        {
            id: 'time_bomb_detonates_when_fuse_expires',
            title: 'Fuse One Detonates on Live Turn',
            description: 'A bomb with fuse 1 explodes during the live turn loop and damages adjacent targets.',
            relatedSkills: ['TIME_BOMB'],
            category: 'combat',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['bomb', 'blast', 'timing'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, ['BASIC_MOVE']);
                addBomb(engine, 'scenario-bomb-detonate', { q: 4, r: 6, s: -10 }, 1);
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState) =>
                !state.enemies.find(enemy => enemy.id === 'scenario-bomb-detonate')
                && state.player.hp < state.player.maxHp
        },
        {
            id: 'time_bomb_self_removes_without_targets',
            title: 'Detonation Removes Bomb Even Alone',
            description: 'A detonating bomb removes itself even if no adjacent unit is hit.',
            relatedSkills: ['TIME_BOMB'],
            category: 'passive',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['bomb', 'cleanup', 'determinism'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 1, r: 1, s: -2 }, ['BASIC_MOVE']);
                addBomb(engine, 'scenario-bomb-solo', { q: 7, r: 7, s: -14 }, 1);
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState) =>
                !state.enemies.find(enemy => enemy.id === 'scenario-bomb-solo')
        }
    ]
};
