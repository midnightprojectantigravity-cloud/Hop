import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameReducer, generateInitialState } from '../logic';
import { createEnemy } from '../systems/entities/entity-factory';
import { createHex } from '../hex';
import { isPlayerTurn } from '../systems/initiative';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import {
    simulateRunDetailed,
    type ArchetypeLoadoutId,
    type BotPolicy
} from '../systems/evaluation/balance-harness';
import { selectEnemyDecisionWithOracleDiff } from '../systems/ai/enemy/selector';
import type { Entity, GameState } from '../types';

interface CorpusStateDescriptor {
    id: string;
    floor: number;
    seed: string;
}

interface GoldenRunFixture {
    id: string;
    version: number;
    seed: string;
    loadoutId: ArchetypeLoadoutId;
    floorsTarget: number;
    maxTurnsPerFloor: number;
    policy?: BotPolicy;
    policyProfileId?: string;
}

type FallbackStats = {
    totalCases: number;
    fallbackCases: number;
    fallbackRate: number;
    bySubtype: Record<string, { total: number; fallback: number; rate: number }>;
    byReason: Record<string, number>;
};

const corpusPath = fileURLToPath(new URL('./__fixtures__/ai/enemy_decision_corpus/baseline_states.json', import.meta.url));
const goldenFixturesDir = fileURLToPath(new URL('./golden-runs/fixtures', import.meta.url));
const descriptors = JSON.parse(readFileSync(corpusPath, 'utf8')) as CorpusStateDescriptor[];
const GOLDEN_EDGE_SUBTYPES = new Set(['warlock', 'bomber', 'archer', 'raider', 'pouncer', 'sentinel']);

const BASELINE_MAX = {
    totalCases: 185,
    fallbackCases: 0,
    fallbackRate: 0,
    bySubtypeFallback: {
        footman: 0,
        archer: 0,
        bomber: 0,
        warlock: 0,
        shieldBearer: 0,
        raider: 0,
        pouncer: 0,
        sprinter: 0,
        assassin: 0,
        golem: 0,
        sentinel: 0,
        shieldbearer: 0,
        skeleton: 0,
        bomb: 0,
    } as Record<string, number>
};

const syntheticSubtypeCases = (baseState: GameState): Entity[] => {
    const position = createHex(2, 2);
    const enemyCases = [
        createEnemy({ id: 'ai_test_assassin', subtype: 'assassin', position, speed: 1, skills: ['BASIC_MOVE', 'BASIC_ATTACK'] }),
        createEnemy({ id: 'ai_test_golem', subtype: 'golem', position, speed: 1, skills: ['BASIC_MOVE', 'BASIC_ATTACK'] }),
        createEnemy({ id: 'ai_test_alias_shieldbearer', subtype: 'shieldbearer', position, speed: 1, skills: ['BASIC_MOVE', 'BASIC_ATTACK'] }),
        createEnemy({
            id: 'ai_test_sentinel',
            subtype: 'sentinel',
            position,
            speed: 1,
            skills: ['BASIC_MOVE', 'SENTINEL_TELEGRAPH', 'SENTINEL_BLAST'],
            enemyType: 'boss'
        })
    ].map(enemy => ({
        ...enemy,
        position,
        factionId: 'enemy',
        actionCooldown: enemy.subtype === 'golem' ? 0 : enemy.actionCooldown
    }));
    const minionCase: Entity = {
        ...createEnemy({ id: 'ai_test_minion_skeleton', subtype: 'skeleton', position, speed: 1, skills: ['BASIC_MOVE', 'BASIC_ATTACK'] }),
        factionId: 'player'
    };
    return [...enemyCases, minionCase];
};

const loadGoldenFixtures = (): GoldenRunFixture[] => {
    return readdirSync(goldenFixturesDir)
        .filter(name => name.endsWith('.json'))
        .sort()
        .map(name => JSON.parse(readFileSync(join(goldenFixturesDir, name), 'utf8')) as GoldenRunFixture);
};

const collectFallbackStats = (): FallbackStats => {
    let totalCases = 0;
    let fallbackCases = 0;
    const bySubtypeCounts = new Map<string, { total: number; fallback: number }>();
    const byReason = new Map<string, number>();

    const record = (enemy: Entity, state: GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] }) => {
        const debug = selectEnemyDecisionWithOracleDiff({
            enemy,
            playerPos: state.player.position,
            state
        });
        const subtype = String(enemy.subtype || 'unknown');
        const cur = bySubtypeCounts.get(subtype) || { total: 0, fallback: 0 };
        cur.total += 1;
        if (debug.usedOracleFallback) {
            cur.fallback += 1;
            fallbackCases += 1;
            const reasonKey = `${subtype}:${debug.mismatchReason || 'unknown'}`;
            byReason.set(reasonKey, (byReason.get(reasonKey) || 0) + 1);
        }
        bySubtypeCounts.set(subtype, cur);
        totalCases += 1;
    };

    const recordEnemiesForState = (state: GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] }) => {
        for (const enemy of state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy')) {
            record(enemy, state);
        }
    };

    for (const descriptor of descriptors) {
        const state = generateInitialState(descriptor.floor, descriptor.seed, descriptor.seed);
        recordEnemiesForState({ ...state, occupiedCurrentTurn: state.occupiedCurrentTurn });
    }

    const syntheticBase = generateInitialState(3, 'enemy-parity-synth', 'enemy-parity-synth');
    for (const enemy of syntheticSubtypeCases(syntheticBase)) {
        record(enemy, { ...syntheticBase, enemies: [enemy], occupiedCurrentTurn: syntheticBase.occupiedCurrentTurn });
    }

    for (const fixture of loadGoldenFixtures()) {
        const maxTurns = Math.max(1, fixture.maxTurnsPerFloor * fixture.floorsTarget);
        const detailed = simulateRunDetailed(
            fixture.seed,
            fixture.policy || 'heuristic',
            maxTurns,
            fixture.loadoutId,
            fixture.policyProfileId || 'sp-v1-default'
        );

        let state = generateInitialState(1, fixture.seed, fixture.seed, undefined, DEFAULT_LOADOUTS[fixture.loadoutId]);
        const capturedSubtypes = new Set<string>();
        let lastPlayerTurnStateWithEnemies: { state: GameState; actionIndex: number } | null = null;

        for (let i = 0; i < detailed.diagnostics.actionLog.length; i++) {
            state = gameReducer(state, detailed.diagnostics.actionLog[i]);
            const livingEnemies = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy');
            if (livingEnemies.length === 0) continue;
            if (!isPlayerTurn(state)) continue;

            lastPlayerTurnStateWithEnemies = { state, actionIndex: i };

            const presentTargetSubtypes = new Set(
                livingEnemies
                    .map(e => String(e.subtype || 'unknown'))
                    .filter(subtype => GOLDEN_EDGE_SUBTYPES.has(subtype))
            );

            for (const subtype of presentTargetSubtypes) {
                if (capturedSubtypes.has(subtype)) continue;
                recordEnemiesForState({ ...state, occupiedCurrentTurn: state.occupiedCurrentTurn });
                capturedSubtypes.add(subtype);
            }
        }

        if (lastPlayerTurnStateWithEnemies) {
            recordEnemiesForState({
                ...lastPlayerTurnStateWithEnemies.state,
                occupiedCurrentTurn: lastPlayerTurnStateWithEnemies.state.occupiedCurrentTurn
            });
        }
    }

    const bySubtype = Object.fromEntries(
        [...bySubtypeCounts.entries()]
            .sort((a, b) => b[1].fallback - a[1].fallback || b[1].total - a[1].total || a[0].localeCompare(b[0]))
            .map(([subtype, counts]) => [
                subtype,
                {
                    total: counts.total,
                    fallback: counts.fallback,
                    rate: Number((counts.fallback / counts.total).toFixed(4))
                }
            ])
    ) as FallbackStats['bySubtype'];

    return {
        totalCases,
        fallbackCases,
        fallbackRate: Number((fallbackCases / Math.max(1, totalCases)).toFixed(4)),
        bySubtype,
        byReason: Object.fromEntries([...byReason.entries()].sort((a, b) => b[1] - a[1]))
    };
};

describe('enemy ai shadow fallback regression', () => {
    it('does not increase oracle fallback usage on the parity corpus', () => {
        const stats = collectFallbackStats();

        expect(stats.totalCases).toBe(BASELINE_MAX.totalCases);
        expect(stats.fallbackCases).toBeLessThanOrEqual(BASELINE_MAX.fallbackCases);
        expect(stats.fallbackRate).toBeLessThanOrEqual(BASELINE_MAX.fallbackRate);

        for (const [subtype, maxFallback] of Object.entries(BASELINE_MAX.bySubtypeFallback)) {
            expect(stats.bySubtype[subtype], `missing subtype in fallback stats: ${subtype}`).toBeDefined();
            expect(stats.bySubtype[subtype].fallback, `${subtype} fallback count regression`).toBeLessThanOrEqual(maxFallback);
        }

        // Current shadow mode only falls back on planned-entity mismatches. New reasons indicate a regression
        // in selector/oracle diff accounting and should be investigated before merge.
        expect(Object.keys(stats.byReason).every(key => key.endsWith(':plannedEntity'))).toBe(true);
    });
});
