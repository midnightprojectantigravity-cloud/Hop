import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gameReducer, generateInitialState } from '../src/logic';
import { hexEquals } from '../src/hex';
import { isPlayerTurn } from '../src/systems/initiative';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import {
    simulateRunDetailed,
    type ArchetypeLoadoutId,
    type BotPolicy
} from '../src/systems/evaluation/balance-harness';
import { selectEnemyDecisionWithOracleDiff } from '../src/systems/ai/enemy/selector';
import type { EnemyAiDecisionResult } from '../src/systems/ai/enemy/types';
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

interface ModeDiffCase {
    caseId: string;
    source: string;
    enemyId: string;
    subtype: string;
    mismatchReason: string;
    withPolicy: {
        intent?: string;
        intentPosition?: { q: number; r: number; s: number };
        position: { q: number; r: number; s: number };
        actionCooldown?: number;
        facing?: number;
        isVisible?: boolean;
        rngCounter?: number;
        message?: string;
        selectedSource?: string;
    };
    syntheticOnly: {
        intent?: string;
        intentPosition?: { q: number; r: number; s: number };
        position: { q: number; r: number; s: number };
        actionCooldown?: number;
        facing?: number;
        isVisible?: boolean;
        rngCounter?: number;
        message?: string;
        selectedSource?: string;
    };
}

interface ModeDiffReport {
    examinedCases: number;
    mismatchCases: number;
    mismatchRate: number;
    bySubtype: Record<string, number>;
    byReason: Record<string, number>;
    bySource: Record<string, number>;
    sample: ModeDiffCase[];
}

const corpusPath = resolve(process.cwd(), 'src/__tests__/__fixtures__/ai/enemy_decision_corpus/baseline_states.json');
const goldenFixturesDir = resolve(process.cwd(), 'src/__tests__/golden-runs/fixtures');
const descriptors = JSON.parse(readFileSync(corpusPath, 'utf8')) as CorpusStateDescriptor[];

const loadGoldenFixtures = (): GoldenRunFixture[] => {
    return readdirSync(goldenFixturesDir)
        .filter(name => name.endsWith('.json'))
        .sort()
        .map(name => JSON.parse(readFileSync(join(goldenFixturesDir, name), 'utf8')) as GoldenRunFixture);
};

const samePoint = (
    a?: { q: number; r: number; s: number },
    b?: { q: number; r: number; s: number }
): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return hexEquals(a, b);
};

const comparePlanned = (
    a: EnemyAiDecisionResult,
    b: EnemyAiDecisionResult
): string | undefined => {
    if (!samePoint(a.plannedEntity.position, b.plannedEntity.position)) return 'position';
    if (String(a.plannedEntity.intent || '') !== String(b.plannedEntity.intent || '')) return 'intent';
    if (!samePoint(a.plannedEntity.intentPosition, b.plannedEntity.intentPosition)) return 'intentPosition';
    if ((a.plannedEntity.actionCooldown ?? undefined) !== (b.plannedEntity.actionCooldown ?? undefined)) return 'actionCooldown';
    if ((a.plannedEntity.facing ?? undefined) !== (b.plannedEntity.facing ?? undefined)) return 'facing';
    if ((a.plannedEntity.isVisible ?? undefined) !== (b.plannedEntity.isVisible ?? undefined)) return 'isVisible';
    if ((a.nextState.rngCounter ?? undefined) !== (b.nextState.rngCounter ?? undefined)) return 'rngCounter';
    if (String(a.message || '') !== String(b.message || '')) return 'message';
    return undefined;
};

const summarizeSelection = (
    result: ReturnType<typeof selectEnemyDecisionWithOracleDiff>
) => ({
    intent: result.selected.plannedEntity.intent,
    intentPosition: result.selected.plannedEntity.intentPosition,
    position: result.selected.plannedEntity.position,
    actionCooldown: result.selected.plannedEntity.actionCooldown,
    facing: result.selected.plannedEntity.facing,
    isVisible: result.selected.plannedEntity.isVisible,
    rngCounter: result.selected.nextState.rngCounter,
    message: result.selected.message,
    selectedSource: result.selectedSource
});

const collectModeDiffReport = (): ModeDiffReport => {
    let examinedCases = 0;
    let mismatchCases = 0;
    const bySubtype: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const sample: ModeDiffCase[] = [];

    const recordState = (state: GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] }, source: string): void => {
        for (const enemy of state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy')) {
            examinedCases += 1;
            const context = {
                enemy,
                playerPos: state.player.position,
                state
            };
            const withPolicy = selectEnemyDecisionWithOracleDiff(context, { includePolicyExact: true });
            const syntheticOnly = selectEnemyDecisionWithOracleDiff(context, { includePolicyExact: false });
            const reason = comparePlanned(withPolicy.selected, syntheticOnly.selected);

            if (!reason) continue;

            mismatchCases += 1;
            const subtype = String(enemy.subtype || 'unknown');
            bySubtype[subtype] = (bySubtype[subtype] || 0) + 1;
            byReason[reason] = (byReason[reason] || 0) + 1;
            bySource[source] = (bySource[source] || 0) + 1;

            if (sample.length < 40) {
                sample.push({
                    caseId: `${source}:${enemy.id}:${subtype}`,
                    source,
                    enemyId: enemy.id,
                    subtype,
                    mismatchReason: reason,
                    withPolicy: summarizeSelection(withPolicy),
                    syntheticOnly: summarizeSelection(syntheticOnly)
                });
            }
        }
    };

    for (const descriptor of descriptors) {
        const state = generateInitialState(descriptor.floor, descriptor.seed, descriptor.seed);
        recordState({ ...state, occupiedCurrentTurn: state.occupiedCurrentTurn }, `baseline:${descriptor.id}`);
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
        for (let i = 0; i < detailed.diagnostics.actionLog.length; i++) {
            state = gameReducer(state, detailed.diagnostics.actionLog[i]);
            if (!isPlayerTurn(state)) continue;
            if (!state.enemies.some(e => e.hp > 0 && e.factionId === 'enemy')) continue;
            recordState(
                { ...state, occupiedCurrentTurn: state.occupiedCurrentTurn },
                `golden:${fixture.id}:a${i}`
            );
        }
    }

    return {
        examinedCases,
        mismatchCases,
        mismatchRate: Number((mismatchCases / Math.max(1, examinedCases)).toFixed(4)),
        bySubtype: Object.fromEntries(Object.entries(bySubtype).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        byReason: Object.fromEntries(Object.entries(byReason).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        bySource: Object.fromEntries(Object.entries(bySource).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        sample
    };
};

console.log(JSON.stringify(collectModeDiffReport(), null, 2));
