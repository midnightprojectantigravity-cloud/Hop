import { hexEquals, pointToKey } from '../hex';
import type { GameState, Point } from '../types';
import type { ScenarioCollection } from './types';

const hasFireAt = (state: GameState, position: Point): boolean =>
    !!state.tiles.get(pointToKey(position))?.effects?.some(effect => effect.id === 'FIRE');

const sortPoints = (points: Point[]): Point[] =>
    [...points].sort((left, right) =>
        left.q === right.q
            ? left.r === right.r
                ? left.s - right.s
                : left.r - right.r
            : left.q - right.q
    );

const collectFireTiles = (state: GameState): Point[] =>
    Array.from(state.tiles.values())
        .filter(tile => tile.effects.some(effect => effect.id === 'FIRE'))
        .map(tile => tile.position);

export const firewallScenarios: ScenarioCollection = {
    id: 'firewall',
    name: 'Firewall',
    description: 'Validates perpendicular wall geometry, wall skipping, and boundary truncation.',

    scenarios: [
        {
            id: 'firewall_perpendicular_wall',
            title: 'Perpendicular Wall Placement',
            description: 'Firewall places a centered 5-hex wall perpendicular to the cast vector and damages actors on valid tiles.',
            relatedSkills: ['FIREWALL'],
            category: 'combat',
            difficulty: 'beginner',
            isTutorial: false,
            tags: ['geometry', 'surface', 'fire'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 3, s: -6 }, ['FIREWALL'], 'FIREMAGE');
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'wall_target');
            },

            run: (engine: any) => {
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'FIREWALL', target: { q: 3, r: 5, s: -8 } } });
            },

            verify: (state: GameState, logs: string[]) => {
                const expected = sortPoints([
                    { q: 3, r: 5, s: -8 },
                    { q: 4, r: 4, s: -8 },
                    { q: 5, r: 3, s: -8 },
                    { q: 2, r: 6, s: -8 },
                    { q: 1, r: 7, s: -8 }
                ]);
                const actual = sortPoints(collectFireTiles(state));
                const enemy = state.enemies.find(actor => actor.id === 'wall_target');

                return JSON.stringify(actual) === JSON.stringify(expected)
                    && !!enemy
                    && enemy.hp < enemy.maxHp
                    && logs.some(log => log.includes('Firewall raised'));
            }
        },
        {
            id: 'firewall_skips_wall_tiles',
            title: 'Wall Tiles Are Skipped',
            description: 'Firewall does not place fire or deal damage on tiles blocked by walls.',
            relatedSkills: ['FIREWALL'],
            category: 'hazards',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['geometry', 'wall', 'surface'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 3, r: 3, s: -6 }, ['FIREWALL'], 'FIREMAGE');
                engine.setTile({ q: 2, r: 6, s: -8 }, 'wall');
                engine.spawnEnemy('footman', { q: 2, r: 6, s: -8 }, 'blocked_target');
                engine.spawnEnemy('footman', { q: 4, r: 4, s: -8 }, 'open_target');
            },

            run: (engine: any) => {
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'FIREWALL', target: { q: 3, r: 5, s: -8 } } });
            },

            verify: (state: GameState) => {
                const blockedTarget = state.enemies.find(actor => actor.id === 'blocked_target');
                const openTarget = state.enemies.find(actor => actor.id === 'open_target');

                return !hasFireAt(state, { q: 2, r: 6, s: -8 })
                    && hasFireAt(state, { q: 4, r: 4, s: -8 })
                    && !!blockedTarget
                    && !!openTarget
                    && blockedTarget.hp === blockedTarget.maxHp
                    && openTarget.hp < openTarget.maxHp;
            }
        },
        {
            id: 'firewall_boundary_truncation',
            title: 'Boundary Truncation',
            description: 'Firewall truncates cleanly at map boundaries while preserving the remaining wall order.',
            relatedSkills: ['FIREWALL'],
            category: 'geometry',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['geometry', 'boundary', 'surface'],

            setup: (engine: any) => {
                engine.setPlayer({ q: 2, r: 4, s: -6 }, ['FIREWALL'], 'FIREMAGE');
            },

            run: (engine: any) => {
                engine.dispatchSync({ type: 'USE_SKILL', payload: { skillId: 'FIREWALL', target: { q: 0, r: 4, s: -4 } } });
            },

            verify: (state: GameState) => {
                const expected = sortPoints([
                    { q: 0, r: 4, s: -4 },
                    { q: 0, r: 5, s: -5 },
                    { q: 0, r: 6, s: -6 }
                ]);
                const actual = sortPoints(collectFireTiles(state));

                return JSON.stringify(actual) === JSON.stringify(expected)
                    && !actual.some(point => hexEquals(point, { q: 0, r: 3, s: -3 }));
            }
        }
    ]
};
