import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gameReducer, generateInitialState } from '../src/logic';
import { computeEnemyAction } from '../src/systems/ai/ai';
import { createEnemy } from '../src/systems/entities/entity-factory';
import { createHex } from '../src/hex';
import { isPlayerTurn } from '../src/systems/initiative';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { simulateRunDetailed, type ArchetypeLoadoutId, type BotPolicy } from '../src/systems/evaluation/balance-harness';
import type { Entity, GameState } from '../src/types';

type CorpusStateDescriptor = {
    id: string;
    floor: number;
    seed: string;
};

type EnemyActionSummary = {
    entity: {
        subtype: string | undefined;
        position: { q: number; r: number; s: number };
        intent: string | undefined;
        intentPosition: { q: number; r: number; s: number } | undefined;
        actionCooldown: number | undefined;
        facing: number | undefined;
        isVisible: boolean | undefined;
    };
    nextState: {
        rngCounter: number | undefined;
        enemyCount: number;
    };
    message: string | undefined;
};

type ExpectedEnemyDecisionCorpus = {
    version: 1;
    cases: Record<string, EnemyActionSummary>;
};

type GoldenRunFixture = {
    id: string;
    version: number;
    seed: string;
    loadoutId: ArchetypeLoadoutId;
    floorsTarget: number;
    maxTurnsPerFloor: number;
    policy?: BotPolicy;
    policyProfileId?: string;
};

const FIXTURE_DIR = resolve(process.cwd(), 'src/__tests__/__fixtures__/ai/enemy_decision_corpus');
const BASELINE_STATES_PATH = resolve(FIXTURE_DIR, 'baseline_states.json');
const EXPECTED_OUTPUTS_PATH = resolve(FIXTURE_DIR, 'expected_outputs.v1.json');
const GOLDEN_FIXTURES_DIR = resolve(process.cwd(), 'src/__tests__/golden-runs/fixtures');
const GOLDEN_EDGE_SUBTYPES = new Set(['warlock', 'bomber', 'archer', 'raider', 'pouncer', 'sentinel']);

const summarizeResult = (result: ReturnType<typeof computeEnemyAction>): EnemyActionSummary => ({
    entity: {
        subtype: result.entity.subtype,
        position: result.entity.position,
        intent: result.entity.intent,
        intentPosition: result.entity.intentPosition,
        actionCooldown: result.entity.actionCooldown,
        facing: result.entity.facing,
        isVisible: result.entity.isVisible
    },
    nextState: {
        rngCounter: result.nextState.rngCounter,
        enemyCount: result.nextState.enemies.length
    },
    message: result.message
});

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
    ].map(enemy => {
        return {
            ...enemy,
            position,
            factionId: 'enemy',
            actionCooldown: enemy.subtype === 'golem' ? 0 : enemy.actionCooldown
        };
    });
    const minionCase: Entity = {
        ...createEnemy({
            id: 'ai_test_minion_skeleton',
            subtype: 'skeleton',
            position,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        }),
        factionId: 'player'
    };
    return [...enemyCases, minionCase];
};

const loadGoldenFixtures = (): GoldenRunFixture[] => {
    return readdirSync(GOLDEN_FIXTURES_DIR)
        .filter(name => name.endsWith('.json'))
        .sort()
        .map(name => JSON.parse(readFileSync(join(GOLDEN_FIXTURES_DIR, name), 'utf8')) as GoldenRunFixture);
};

const addEnemyDecisionCasesForState = (
    cases: Record<string, EnemyActionSummary>,
    state: GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] },
    label: string
): void => {
    const enemies = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy');
    for (const enemy of enemies) {
        const next = computeEnemyAction(enemy, state.player.position, state);
        cases[`${label}:${enemy.id}:${enemy.subtype || 'unknown'}`] = summarizeResult(next);
    }
};

const addGoldenDerivedEdgeCases = (cases: Record<string, EnemyActionSummary>): void => {
    const fixtures = loadGoldenFixtures();

    for (const fixture of fixtures) {
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
                addEnemyDecisionCasesForState(
                    cases,
                    { ...state, occupiedCurrentTurn: state.occupiedCurrentTurn },
                    `golden:${fixture.id}:subtype:${subtype}:a${i}`
                );
                capturedSubtypes.add(subtype);
            }
        }

        if (lastPlayerTurnStateWithEnemies) {
            addEnemyDecisionCasesForState(
                cases,
                { ...lastPlayerTurnStateWithEnemies.state, occupiedCurrentTurn: lastPlayerTurnStateWithEnemies.state.occupiedCurrentTurn },
                `golden:${fixture.id}:late:a${lastPlayerTurnStateWithEnemies.actionIndex}`
            );
        }
    }
};

const buildExpectedCorpus = (): ExpectedEnemyDecisionCorpus => {
    const descriptors = JSON.parse(readFileSync(BASELINE_STATES_PATH, 'utf8')) as CorpusStateDescriptor[];
    const cases: Record<string, EnemyActionSummary> = {};

    for (const descriptor of descriptors) {
        const state = generateInitialState(descriptor.floor, descriptor.seed, descriptor.seed);
        const enemies = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy');
        for (const enemy of enemies) {
            const next = computeEnemyAction(enemy, state.player.position, {
                ...state,
                occupiedCurrentTurn: state.occupiedCurrentTurn
            });
            cases[`${descriptor.id}:${enemy.id}:${enemy.subtype || 'unknown'}`] = summarizeResult(next);
        }
    }

    const syntheticBase = generateInitialState(3, 'enemy-parity-synth', 'enemy-parity-synth');
    for (const enemy of syntheticSubtypeCases(syntheticBase)) {
        const state = { ...syntheticBase, enemies: [enemy], occupiedCurrentTurn: syntheticBase.occupiedCurrentTurn };
        const next = computeEnemyAction(enemy, state.player.position, state);
        cases[`synthetic:${enemy.id}:${enemy.subtype || 'unknown'}:${enemy.factionId || 'enemy'}`] = summarizeResult(next);
    }

    addGoldenDerivedEdgeCases(cases);

    return {
        version: 1,
        cases
    };
};

const sortForJson = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortForJson);
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return Object.keys(record)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = sortForJson(record[key]);
                return acc;
            }, {});
    }
    return value;
};

const normalizeJson = (value: unknown): string => `${JSON.stringify(sortForJson(value), null, 2)}\n`;

const main = () => {
    const checkMode = process.argv.includes('--check');
    const expected = buildExpectedCorpus();
    const nextJson = normalizeJson(expected);

    if (checkMode) {
        const current = readFileSync(EXPECTED_OUTPUTS_PATH, 'utf8');
        if (current !== nextJson) {
            console.error('Enemy AI parity fixture is out of date. Run: npm --workspace @hop/engine run generate-enemy-ai-parity-fixture');
            process.exit(1);
        }
        console.log(`Enemy AI parity fixture is up to date (${Object.keys(expected.cases).length} cases).`);
        return;
    }

    writeFileSync(EXPECTED_OUTPUTS_PATH, nextJson, 'utf8');
    console.log(`Wrote ${Object.keys(expected.cases).length} cases to ${EXPECTED_OUTPUTS_PATH}`);
};

main();
