import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import type { Actor, GameState, Point } from '../types';
import { buildSynapseThreatPreview, computeActionReach } from '../systems/synapse-threat';
import { computeRelativeThreatScores, computeUnifiedPowerScoreBreakdown } from '../systems/threat-scoring';
import { buildIntentPreview } from '../systems/telegraph-projection';
import { getHexLine, getNeighbors, hexDistance, pointToKey } from '../hex';
import { validateAxialDirection } from '../systems/validation';
import { createActiveSkill } from '../skillRegistry';

const withSingleEnemyState = (seed: string): GameState => {
    const state = generateInitialState(1, seed);
    const enemy: Actor = {
        ...state.player,
        id: 'enemy-a',
        type: 'enemy',
        factionId: 'enemy',
        position: { q: state.player.position.q + 1, r: state.player.position.r, s: state.player.position.s - 1 },
    };
    return {
        ...state,
        enemies: [enemy],
        companions: [],
    };
};

const findThreatTileForSource = (
    preview: ReturnType<typeof buildSynapseThreatPreview>,
    sourceActorId: string
) => preview.tiles.find(tile => tile.sourceActorIds.includes(sourceActorId));

const buildMeleeEnemy = (
    template: Actor,
    id: string,
    position: Point,
    overrides: Partial<Actor> = {}
): Actor => ({
    ...template,
    id,
    type: 'enemy',
    factionId: 'enemy',
    position,
    activeSkills: [createActiveSkill('BASIC_ATTACK') as any],
    ...overrides
});

const pickCenterTile = (tiles: Array<{ tile: Point }>): Point => {
    const tileByKey = new Set(tiles.map(entry => pointToKey(entry.tile)));
    const ranked = tiles
        .map(entry => ({
            tile: entry.tile,
            openNeighbors: getNeighbors(entry.tile)
                .filter(neighbor => tileByKey.has(pointToKey(neighbor)))
                .length
        }))
        .sort((a, b) => b.openNeighbors - a.openNeighbors);
    return ranked[0]?.tile || tiles[0]?.tile;
};

describe('synapse threat preview', () => {
    it('includes synapse preview on fresh initial state', () => {
        const state = generateInitialState(1, 'synapse-initial-seed');
        expect(state.intentPreview?.synapse).toBeDefined();
        expect((state.intentPreview?.synapse?.unitScores || []).length).toBeGreaterThan(0);
        expect(state.intentPreview?.synapse?.bandThresholds.contestedHighMin).toBe(2);
        expect(state.intentPreview?.synapse?.bandThresholds.deadlyMin).toBe(5);
    });

    it('computes deterministic UPS breakdowns', () => {
        const state = withSingleEnemyState('synapse-ups-seed');
        const first = computeUnifiedPowerScoreBreakdown(state.player);
        const second = computeUnifiedPowerScoreBreakdown(state.player);
        expect(first).toEqual(second);
        expect(first.ups).toBeGreaterThan(0);
        expect(Number.isInteger(first.ups)).toBe(true);
    });

    it('handles sparse skill edge cases (0/1/2 skills)', () => {
        const state = withSingleEnemyState('synapse-sparse-seed');
        const baseActor = state.player;
        const firstSkill = baseActor.activeSkills[0];
        const secondSkill = baseActor.activeSkills[1];
        const none = computeUnifiedPowerScoreBreakdown({
            ...baseActor,
            activeSkills: []
        });
        const one = computeUnifiedPowerScoreBreakdown({
            ...baseActor,
            activeSkills: firstSkill ? [firstSkill] : []
        });
        const two = computeUnifiedPowerScoreBreakdown({
            ...baseActor,
            activeSkills: [firstSkill, secondSkill].filter((skill): skill is Actor['activeSkills'][number] => Boolean(skill))
        });

        expect(none.skillScore).toBe(0);
        expect(one.skillScore).toBeGreaterThanOrEqual(0);
        expect(two.skillScore).toBeGreaterThanOrEqual(one.skillScore);
    });

    it('applies sigma floor and tier boundaries deterministically', () => {
        const state = withSingleEnemyState('synapse-sigma-seed');
        const relative = computeRelativeThreatScores(state);
        expect(relative.sigmaRef).toBeGreaterThanOrEqual(600);

        const playerEntry = relative.entries.find(entry => entry.actorId === state.player.id);
        expect(playerEntry?.zScore).toBe(0);
        expect(playerEntry?.sigmaTier).toBe('elevated');
    });

    it('keeps intent preview synapse payload deterministic', () => {
        const state = withSingleEnemyState('synapse-intent-seed');
        const first = buildIntentPreview(state).synapse;
        const second = buildIntentPreview(state).synapse;
        expect(first).toEqual(second);
    });

    it('uses attack range only for danger reach', () => {
        const state = generateInitialState(1, 'synapse-reach-seed');
        const base = state.player.activeSkills[0];
        const actor: Actor = {
            ...state.player,
            speed: 2,
            activeSkills: [
                {
                    ...base,
                    id: 'BASIC_MOVE',
                    range: 2,
                    slot: 'utility',
                },
                {
                    ...base,
                    id: 'TEST_ATTACK_RANGE_1' as any,
                    range: 1,
                    slot: 'offensive',
                }
            ]
        };
        expect(computeActionReach(actor)).toBe(1);
    });

    it('treats sprinter-style basic attack reach as 1', () => {
        const state = generateInitialState(1, 'synapse-sprinter-reach-seed');
        const actor: Actor = {
            ...state.player,
            speed: 2,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill('BASIC_ATTACK') as any
            ]
        };
        expect(computeActionReach(actor)).toBe(1);
    });

    it('suppresses dead-zone emitter weight below z<0.25', () => {
        const state = withSingleEnemyState('synapse-deadzone-seed');
        const enemy = state.enemies[0];
        state.enemies = [
            {
                ...enemy,
                temporaryArmor: (enemy.temporaryArmor || 0) + 1,
            }
        ];

        const preview = buildSynapseThreatPreview(state);
        const source = preview.sources.find(s => s.actorId === 'enemy-a');
        expect(source).toBeDefined();
        expect(source!.zScore).toBeGreaterThanOrEqual(0);
        expect(source!.zScore).toBeLessThan(0.25);
        expect(source!.emitterWeight).toBe(0);
        const threatTile = findThreatTileForSource(preview, 'enemy-a');
        expect(threatTile?.band).toBe('contested_low');
        expect(threatTile?.heat).toBe(1);
    });

    it('marks one low threat source as low danger', () => {
        const state = withSingleEnemyState('synapse-one-low-seed');
        const preview = buildSynapseThreatPreview(state);
        const threatTile = findThreatTileForSource(preview, 'enemy-a');
        expect(threatTile?.band).toBe('contested_low');
        expect(threatTile?.heat).toBe(1);
    });

    it('marks a single high source as high danger', () => {
        const state = withSingleEnemyState('synapse-single-high-seed');
        state.enemies = [{
            ...state.enemies[0],
            temporaryArmor: (state.enemies[0].temporaryArmor || 0) + 40
        }];

        const preview = buildSynapseThreatPreview(state);
        const threatTile = findThreatTileForSource(preview, 'enemy-a');
        expect(threatTile?.band).toBe('contested_high');
        expect(threatTile?.heat).toBe(2);
    });

    it('marks multiple low sources as high danger', () => {
        const state = generateInitialState(1, 'synapse-multi-low-seed');
        const baseline = buildSynapseThreatPreview({
            ...state,
            enemies: [],
            companions: []
        });
        const center = pickCenterTile(baseline.tiles);
        const candidateNeighbors = getNeighbors(center)
            .filter(neighbor => baseline.tiles.some(tile => pointToKey(tile.tile) === pointToKey(neighbor)));
        const enemyA = buildMeleeEnemy(state.player, 'enemy-a', candidateNeighbors[0] || { q: center.q + 1, r: center.r, s: center.s - 1 });
        const enemyB = buildMeleeEnemy(state.player, 'enemy-b', candidateNeighbors[1] || { q: center.q, r: center.r + 1, s: center.s - 1 });
        const preview = buildSynapseThreatPreview({
            ...state,
            enemies: [enemyA, enemyB],
            companions: []
        });
        const centerTile = preview.tiles.find(tile => pointToKey(tile.tile) === pointToKey(center));
        expect(centerTile?.heat).toBe(2);
        expect(centerTile?.band).toBe('contested_high');
        const highTile = preview.tiles.find(tile => tile.band === 'contested_high' && tile.heat >= 2);
        expect(highTile).toBeDefined();
    });

    it('marks stacked high pressure as deadly', () => {
        const state = generateInitialState(1, 'synapse-stacked-high-seed');
        const baseline = buildSynapseThreatPreview({
            ...state,
            enemies: [],
            companions: []
        });
        const center = pickCenterTile(baseline.tiles);
        const neighbors = getNeighbors(center)
            .filter(neighbor => baseline.tiles.some(tile => pointToKey(tile.tile) === pointToKey(neighbor)));
        const enemyA = buildMeleeEnemy(
            state.player,
            'enemy-a',
            neighbors[0] || { q: center.q + 1, r: center.r, s: center.s - 1 },
            { temporaryArmor: 40 }
        );
        const enemyB = buildMeleeEnemy(
            state.player,
            'enemy-b',
            neighbors[1] || { q: center.q, r: center.r + 1, s: center.s - 1 },
            { temporaryArmor: 40 }
        );
        const enemyC = buildMeleeEnemy(
            state.player,
            'enemy-c',
            neighbors[2] || { q: center.q - 1, r: center.r + 1, s: center.s }
        );
        const preview = buildSynapseThreatPreview({
            ...state,
            enemies: [enemyA, enemyB, enemyC],
            companions: []
        });
        const centerTile = preview.tiles.find(tile => pointToKey(tile.tile) === pointToKey(center));
        expect(centerTile?.heat).toBe(5);
        expect(centerTile?.band).toBe('deadly');
        const deadlyTile = preview.tiles.find(tile => tile.band === 'deadly' && tile.heat === 5);
        expect(deadlyTile).toBeDefined();
    });

    it('keeps occupied tiles out of synapse heatmap overlay', () => {
        const state = generateInitialState(1, 'synapse-occupied-filter-seed');
        const preview = buildSynapseThreatPreview(state);
        const occupiedKeys = new Set<string>([
            pointToKey(state.player.position),
            ...state.enemies.filter(enemy => enemy.hp > 0).map(enemy => pointToKey(enemy.position)),
            ...(state.companions || []).filter(companion => companion.hp > 0).map(companion => pointToKey(companion.position))
        ]);
        for (const tile of preview.tiles) {
            expect(occupiedKeys.has(pointToKey(tile.tile))).toBe(false);
        }
    });

    it('projects archer threat as axial only and outside range-1', () => {
        const state = generateInitialState(1, 'synapse-archer-shape-seed');
        const archerPosition = getNeighbors(state.player.position)[0] || { q: state.player.position.q + 1, r: state.player.position.r, s: state.player.position.s - 1 };
        const archer: Actor = {
            ...state.player,
            id: 'enemy-archer',
            type: 'enemy',
            factionId: 'enemy',
            position: archerPosition,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill('ARCHER_SHOT') as any
            ]
        };
        const preview = buildSynapseThreatPreview({
            ...state,
            enemies: [archer],
            companions: []
        });
        const threatened = preview.tiles.filter(tile => tile.sourceActorIds.includes('enemy-archer'));
        expect(threatened.length).toBeGreaterThan(0);
        for (const tile of threatened) {
            const distance = hexDistance(archer.position, tile.tile);
            expect(distance).toBeGreaterThanOrEqual(2);
            expect(distance).toBeLessThanOrEqual(4);
            expect(validateAxialDirection(archer.position, tile.tile).isAxial).toBe(true);
        }
    });

    it('respects line of sight for archer threat projection', () => {
        const state = generateInitialState(1, 'synapse-archer-los-seed');
        const archerPosition = getNeighbors(state.player.position)[0] || { q: state.player.position.q + 1, r: state.player.position.r, s: state.player.position.s - 1 };
        const archer: Actor = {
            ...state.player,
            id: 'enemy-archer',
            type: 'enemy',
            factionId: 'enemy',
            position: archerPosition,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill('ARCHER_SHOT') as any
            ]
        };
        const withArcher: GameState = {
            ...state,
            enemies: [archer],
            companions: []
        };
        const clearPreview = buildSynapseThreatPreview(withArcher);
        const openTile = clearPreview.tiles.find(tile => tile.sourceActorIds.includes('enemy-archer'));
        expect(openTile).toBeDefined();
        const line = getHexLine(archer.position, openTile!.tile);
        expect(line.length).toBeGreaterThan(2);
        const blockedPoint = line[1];
        const blockedPointKey = pointToKey(blockedPoint);
        const blockTile = withArcher.tiles.get(blockedPointKey);
        expect(blockTile).toBeDefined();
        withArcher.tiles.set(blockedPointKey, {
            ...blockTile!,
            traits: new Set([...blockTile!.traits, 'BLOCKS_LOS'])
        });
        const blockedPreview = buildSynapseThreatPreview(withArcher);
        const blockedTarget = blockedPreview.tiles.find(tile => pointToKey(tile.tile) === pointToKey(openTile!.tile));
        expect(blockedTarget?.sourceActorIds.includes('enemy-archer')).toBe(false);
    });

    it('keeps sources/tiles/sourceActorIds stably sorted', () => {
        const state = generateInitialState(1, 'synapse-sort-seed');
        const enemyA: Actor = {
            ...state.player,
            id: 'enemy-b',
            type: 'enemy',
            factionId: 'enemy',
            position: { q: state.player.position.q + 2, r: state.player.position.r, s: state.player.position.s - 2 },
        };
        const enemyB: Actor = {
            ...state.player,
            id: 'enemy-a',
            type: 'enemy',
            factionId: 'enemy',
            position: { q: state.player.position.q + 1, r: state.player.position.r, s: state.player.position.s - 1 },
            temporaryArmor: 2
        };
        const preview = buildSynapseThreatPreview({
            ...state,
            enemies: [enemyA, enemyB],
            companions: []
        });

        const sourceIds = preview.sources.map(source => source.actorId);
        expect(sourceIds).toEqual([...sourceIds].sort((a, b) => a.localeCompare(b)));

        const tileKeys = preview.tiles.map(tile => `${tile.tile.q},${tile.tile.r},${tile.tile.s}`);
        expect(tileKeys).toEqual([...tileKeys].sort((a, b) => a.localeCompare(b)));

        for (const tile of preview.tiles) {
            expect(tile.sourceActorIds).toEqual([...tile.sourceActorIds].sort((a, b) => a.localeCompare(b)));
        }
    });
});
