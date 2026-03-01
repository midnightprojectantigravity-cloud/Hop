import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gameReducer, generateInitialState } from '../src/logic';
import { selectEnemyDecisionWithOracleDiff } from '../src/systems/ai/enemy/selector';
import { createEnemy } from '../src/systems/entities/entity-factory';
import { createHex } from '../src/hex';
import { isPlayerTurn } from '../src/systems/initiative';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import {
    simulateRunDetailed,
    type ArchetypeLoadoutId,
    type BotPolicy
} from '../src/systems/evaluation/balance-harness';
import type { Entity, GameState } from '../src/types';

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

type SourceStats = Record<string, number>;
type SubtypeSourceStats = Record<string, SourceStats>;

interface DependenceReport {
    mode: 'with_policy_exact' | 'synthetic_only';
    includePolicyExact: boolean;
    totalCases: number;
    selectedBySource: SourceStats;
    selectedBySubtype: SubtypeSourceStats;
    nonPolicyExactSelected: number;
    nonPolicyExactParityMatch: number;
    nonPolicyExactMismatch: number;
    oracleMismatchCases: number;
    oracleMismatchRate: number;
    mismatchBySubtype: Record<string, number>;
}

const corpusPath = resolve(process.cwd(), 'src/__tests__/__fixtures__/ai/enemy_decision_corpus/baseline_states.json');
const goldenFixturesDir = resolve(process.cwd(), 'src/__tests__/golden-runs/fixtures');
const descriptors = JSON.parse(readFileSync(corpusPath, 'utf8')) as CorpusStateDescriptor[];
const GOLDEN_EDGE_SUBTYPES = new Set(['warlock', 'bomber', 'archer', 'raider', 'pouncer', 'sentinel']);

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

const increment = (record: Record<string, number>, key: string): void => {
    record[key] = (record[key] || 0) + 1;
};

const collectDependenceReport = (includePolicyExact: boolean): DependenceReport => {
    let totalCases = 0;
    let nonPolicyExactSelected = 0;
    let nonPolicyExactParityMatch = 0;
    let nonPolicyExactMismatch = 0;
    const selectedBySource: SourceStats = {};
    const selectedBySubtype: SubtypeSourceStats = {};
    const mismatchBySubtype: Record<string, number> = {};

    const record = (enemy: Entity, state: GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] }) => {
        const debug = selectEnemyDecisionWithOracleDiff({
            enemy,
            playerPos: state.player.position,
            state
        }, {
            includePolicyExact
        });
        const source = debug.selectedSource || debug.scoredCandidates[0]?.source || 'none';
        const subtype = String(enemy.subtype || 'unknown');

        increment(selectedBySource, source);
        if (!selectedBySubtype[subtype]) selectedBySubtype[subtype] = {};
        increment(selectedBySubtype[subtype], source);

        if (source !== 'policy_exact') {
            nonPolicyExactSelected += 1;
            if (!debug.mismatchReason) {
                nonPolicyExactParityMatch += 1;
            } else {
                nonPolicyExactMismatch += 1;
                increment(mismatchBySubtype, subtype);
            }
        }
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

    return {
        mode: includePolicyExact ? 'with_policy_exact' : 'synthetic_only',
        includePolicyExact,
        totalCases,
        selectedBySource: Object.fromEntries(Object.entries(selectedBySource).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        selectedBySubtype: Object.fromEntries(
            Object.entries(selectedBySubtype)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([subtype, bySource]) => [
                    subtype,
                    Object.fromEntries(Object.entries(bySource).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
                ])
        ),
        nonPolicyExactSelected,
        nonPolicyExactParityMatch,
        nonPolicyExactMismatch,
        oracleMismatchCases: nonPolicyExactMismatch,
        oracleMismatchRate: Number((nonPolicyExactMismatch / Math.max(1, totalCases)).toFixed(4)),
        mismatchBySubtype: Object.fromEntries(Object.entries(mismatchBySubtype).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
    };
};

const includePolicyOnly = process.argv.includes('--with-policy-exact');
const syntheticOnly = process.argv.includes('--synthetic-only');

if (includePolicyOnly && syntheticOnly) {
    console.error('Choose only one of --with-policy-exact or --synthetic-only');
    process.exit(1);
}

if (includePolicyOnly) {
    console.log(JSON.stringify(collectDependenceReport(true), null, 2));
    process.exit(0);
}

if (syntheticOnly) {
    console.log(JSON.stringify(collectDependenceReport(false), null, 2));
    process.exit(0);
}

console.log(JSON.stringify({
    withPolicyExact: collectDependenceReport(true),
    syntheticOnly: collectDependenceReport(false)
}, null, 2));
