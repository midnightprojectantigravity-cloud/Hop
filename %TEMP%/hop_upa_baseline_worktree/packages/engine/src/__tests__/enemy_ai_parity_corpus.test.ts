import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameReducer, generateInitialState } from '../logic';
import { computeEnemyAction } from '../systems/ai/ai';
import { createEnemy } from '../systems/entities/entity-factory';
import type { Entity, GameState } from '../types';
import { createHex } from '../hex';
import { isPlayerTurn } from '../systems/initiative';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import {
    simulateRunDetailed,
    type ArchetypeLoadoutId,
    type BotPolicy
} from '../systems/evaluation/balance-harness';

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
interface ExpectedEnemyDecisionCorpus {
    version: number;
    cases: Record<string, ReturnType<typeof summarizeResult>>;
}

const corpusPath = fileURLToPath(new URL('./__fixtures__/ai/enemy_decision_corpus/baseline_states.json', import.meta.url));
const expectedPath = fileURLToPath(new URL('./__fixtures__/ai/enemy_decision_corpus/expected_outputs.v1.json', import.meta.url));
const goldenFixturesDir = fileURLToPath(new URL('./golden-runs/fixtures', import.meta.url));
const descriptors = JSON.parse(readFileSync(corpusPath, 'utf8')) as CorpusStateDescriptor[];
const expectedCorpus = JSON.parse(readFileSync(expectedPath, 'utf8')) as ExpectedEnemyDecisionCorpus;
const GOLDEN_EDGE_SUBTYPES = new Set(['warlock', 'bomber', 'archer', 'raider', 'pouncer', 'sentinel']);

const summarizeResult = (result: ReturnType<typeof computeEnemyAction>) => ({
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
        createEnemy({ id: 'ai_test_sentinel', subtype: 'sentinel', position, speed: 1, skills: ['BASIC_MOVE', 'SENTINEL_TELEGRAPH', 'SENTINEL_BLAST'], enemyType: 'boss' })
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

const addEnemyDecisionCasesForState = (
    cases: Record<string, ReturnType<typeof summarizeResult>>,
    state: GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] },
    label: string,
    seenSubtypes: Set<string>
): void => {
    const enemies = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy');
    for (const enemy of enemies) {
        seenSubtypes.add(String(enemy.subtype || 'unknown'));
        const next = computeEnemyAction(enemy, state.player.position, state);
        cases[`${label}:${enemy.id}:${enemy.subtype || 'unknown'}`] = summarizeResult(next);
    }
};

const addGoldenDerivedEdgeCases = (
    cases: Record<string, ReturnType<typeof summarizeResult>>,
    seenSubtypes: Set<string>
): void => {
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
                    `golden:${fixture.id}:subtype:${subtype}:a${i}`,
                    seenSubtypes
                );
                capturedSubtypes.add(subtype);
            }
        }

        if (lastPlayerTurnStateWithEnemies) {
            addEnemyDecisionCasesForState(
                cases,
                { ...lastPlayerTurnStateWithEnemies.state, occupiedCurrentTurn: lastPlayerTurnStateWithEnemies.state.occupiedCurrentTurn },
                `golden:${fixture.id}:late:a${lastPlayerTurnStateWithEnemies.actionIndex}`,
                seenSubtypes
            );
        }
    }
};

describe('enemy ai parity corpus', () => {
    it('matches fixture-expected enemy decisions exactly for generated enemy states', () => {
        const seenSubtypes = new Set<string>();
        const actualCases: Record<string, ReturnType<typeof summarizeResult>> = {};

        for (const descriptor of descriptors) {
            const state = generateInitialState(descriptor.floor, descriptor.seed, descriptor.seed);
            const enemies = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy');
            expect(enemies.length, `${descriptor.id} should spawn enemies`).toBeGreaterThan(0);

            for (const enemy of enemies) {
                seenSubtypes.add(String(enemy.subtype || 'unknown'));
                const next = computeEnemyAction(enemy, state.player.position, { ...state, occupiedCurrentTurn: state.occupiedCurrentTurn });
                actualCases[`${descriptor.id}:${enemy.id}:${enemy.subtype || 'unknown'}`] = summarizeResult(next);
            }
        }

        const syntheticBase = generateInitialState(3, 'enemy-parity-synth', 'enemy-parity-synth');
        for (const enemy of syntheticSubtypeCases(syntheticBase)) {
            const state = { ...syntheticBase, enemies: [enemy], occupiedCurrentTurn: syntheticBase.occupiedCurrentTurn };
            const next = computeEnemyAction(enemy, state.player.position, state);
            seenSubtypes.add(String(enemy.subtype || 'unknown'));
            actualCases[`synthetic:${enemy.id}:${enemy.subtype || 'unknown'}:${enemy.factionId || 'enemy'}`] = summarizeResult(next);
        }

        addGoldenDerivedEdgeCases(actualCases, seenSubtypes);

        expect(expectedCorpus.version).toBe(1);
        expect(Object.keys(actualCases).sort()).toEqual(Object.keys(expectedCorpus.cases).sort());
        expect(actualCases).toEqual(expectedCorpus.cases);
        expect(seenSubtypes.has('footman')).toBe(true);
        expect(seenSubtypes.has('archer') || seenSubtypes.has('sprinter') || seenSubtypes.has('bomber')).toBe(true);
        expect(seenSubtypes.has('sentinel')).toBe(true);
    });
});
