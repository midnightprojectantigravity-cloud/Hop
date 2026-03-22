import type { GameState } from '../types';
import type { ScenarioCollection } from './types';
import { hexEquals } from '../hex';

export const telegraphProjectionScenarios: ScenarioCollection = {
    id: 'telegraph_projection',
    name: 'Telegraph Projection',
    description: 'Deterministic intent previews for next-turn danger tiles.',
    scenarios: [
        {
            id: 'telegraph_projection_is_deterministic',
            title: 'Projection Determinism',
            description: 'Same state should always produce the same danger projection.',
            relatedSkills: ['BASIC_ATTACK'],
            category: 'telegraph',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['projection', 'determinism'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, []);
                engine.spawnEnemy('footman', { q: 7, r: 5, s: -12 }, 'threat');
            },
            run: (engine: any) => {
                engine.wait();
            },
            verify: (state: GameState) => {
                const fromEngine = state.intentPreview;
                const tiles = fromEngine?.dangerTiles || [];
                const projections = fromEngine?.projections || [];
                const tileKeys = tiles.map(t => `${t.q},${t.r},${t.s}`);
                const uniqueTiles = new Set(tileKeys);
                const tilesSorted = tileKeys.every((k, i) => i === 0 || tileKeys[i - 1].localeCompare(k) <= 0);
                const projectionKeys = projections.map(p => `${p.actorId}|${p.skillId}|${p.targetHex ? `${p.targetHex.q},${p.targetHex.r},${p.targetHex.s}` : 'none'}`);
                const projectionsSorted = projectionKeys.every((k, i) => i === 0 || projectionKeys[i - 1].localeCompare(k) <= 0);

                const checks = {
                    hasEnginePreview: !!fromEngine,
                    noDuplicateTiles: uniqueTiles.size === tileKeys.length,
                    tilesAreSorted: tilesSorted,
                    projectionsAreSorted: projectionsSorted,
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('Telegraph Projection Determinism Failed:', checks);
                    console.log('Engine Preview:', fromEngine);
                }

                return Object.values(checks).every(v => v === true);
            }
        },
        {
            id: 'telegraph_projection_matches_execute_footprint',
            title: 'Synapse Projection Matches Execute Footprint',
            description: 'Projected danger heat should include the tile actually damaged on staged execution.',
            relatedSkills: ['SENTINEL_TELEGRAPH', 'SENTINEL_BLAST'],
            category: 'telegraph',
            difficulty: 'intermediate',
            isTutorial: false,
            tags: ['projection', 'parity', 'combat'],
            setup: (engine: any) => {
                engine.setPlayer({ q: 4, r: 5, s: -9 }, []);
                engine.spawnEnemy('sentinel', { q: 4, r: 2, s: -6 }, 'threat');
            },
            run: (engine: any) => {
                engine.wait(); // enemy telegraphs first; intent preview is rebuilt for the player's next turn
                const previewBefore = engine.state.intentPreview;
                const tile = previewBefore?.synapse?.tiles?.find((entry: any) =>
                    entry.tile
                    && entry.tile.q === engine.state.player.position.q
                    && entry.tile.r === engine.state.player.position.r
                    && entry.heat > 0
                )?.tile;
                if (tile) {
                    engine.logs.push(`PREVIEW_TILE=${tile.q},${tile.r},${tile.s}`);
                } else {
                    engine.logs.push('PREVIEW_TILE=none');
                }
                const threat = engine.getEnemy('threat');
                if (threat?.ires) {
                    threat.activeSkills = threat.activeSkills.filter((skill: any) =>
                        skill.id === 'ENEMY_AWARENESS' || skill.id === 'SENTINEL_BLAST'
                    );
                    threat.ires = {
                        ...threat.ires,
                        mana: threat.ires.maxMana,
                        actedThisTurn: false,
                        movedThisTurn: false,
                        actionCountThisTurn: 0
                    };
                }
                engine.wait(); // projected threat should now execute
            },
            verify: (state: GameState, logs: string[]) => {
                const marker = logs.find(l => l.startsWith('PREVIEW_TILE='));
                const raw = marker?.split('=')[1] || 'none';
                const parsed = raw === 'none' ? undefined : (() => {
                    const [q, r, s] = raw.split(',').map(v => Number(v));
                    return { q, r, s };
                })();

                const checks = {
                    previewProducedTile: !!parsed,
                    projectedTileMatchesExecute: !!parsed && hexEquals(state.player.position, parsed) && logs.some(l => l.includes('massive blast')),
                };

                if (Object.values(checks).some(v => v === false)) {
                    console.log('Telegraph Projection Parity Failed:', checks);
                    console.log('Logs:', logs);
                    console.log('Player HP:', state.player.hp, '/', state.player.maxHp);
                }

                return Object.values(checks).every(v => v === true);
            }
        }
    ]
};
