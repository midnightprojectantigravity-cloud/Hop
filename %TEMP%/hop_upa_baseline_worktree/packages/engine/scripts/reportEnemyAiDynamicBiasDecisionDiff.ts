import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameReducer, generateInitialState } from '../src/logic';
import { hexEquals } from '../src/hex';
import { isPlayerTurn } from '../src/systems/initiative';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import {
    simulateRunDetailed,
    type ArchetypeLoadoutId,
    type BotPolicy
} from '../src/systems/evaluation/balance-harness';
import { selectEnemyDecision } from '../src/systems/ai/enemy/selector';
import type { EnemyAiDecisionResult } from '../src/systems/ai/enemy/types';
import type { Entity, GameState } from '../src/types';

interface CorpusStateDescriptor {
    id: string;
    floor: number;
    seed: string;
    enemyHpRatio?: number;
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

interface DynamicBiasDecisionDiffCase {
    caseId: string;
    source: string;
    enemyId: string;
    subtype: string;
    mismatchReason: string;
    baseline: {
        intent?: string;
        intentPosition?: { q: number; r: number; s: number };
        position: { q: number; r: number; s: number };
        actionCooldown?: number;
        facing?: number;
        isVisible?: boolean;
        rngCounter?: number;
        message?: string;
        reasoningCode?: string;
    };
    dynamicBias: {
        intent?: string;
        intentPosition?: { q: number; r: number; s: number };
        position: { q: number; r: number; s: number };
        actionCooldown?: number;
        facing?: number;
        isVisible?: boolean;
        rngCounter?: number;
        message?: string;
        reasoningCode?: string;
    };
}

interface DynamicBiasDecisionDiffReport {
    dynamicBiasStrength: number;
    calibration: {
        bomberBombWindowBonus: number;
        bomberRepositionBonus: number;
    };
    examinedCases: number;
    mismatchCases: number;
    mismatchRate: number;
    bySubtype: Record<string, number>;
    byReason: Record<string, number>;
    bySource: Record<string, number>;
    sample: DynamicBiasDecisionDiffCase[];
}

const toEnvKeySuffix = (name: string): string => name.replace(/-/g, '_').toUpperCase();
const positionalArgs = process.argv.slice(2).filter(v => !v.startsWith('--') && v !== 'true');
const positionByName: Partial<Record<string, number>> = {
    'bias-strength': 0,
    'bomber-bomb-bonus': 1,
    'bomber-reposition-bonus': 2,
    'sample-limit': 3
};

const parseArg = (name: string): string | undefined => {
    const eqPrefix = `--${name}=`;
    const eqArg = process.argv.find(v => v.startsWith(eqPrefix));
    if (eqArg) return eqArg.slice(eqPrefix.length);

    const index = process.argv.indexOf(`--${name}`);
    if (index >= 0) {
        const next = process.argv[index + 1];
        if (next && !next.startsWith('--')) return next;
    }

    const directEnv = process.env[`HOP_AI_DECISION_DIFF_${toEnvKeySuffix(name)}`];
    if (directEnv !== undefined && directEnv !== '') return directEnv;

    const npmConfigEnv = process.env[`npm_config_${name.replace(/-/g, '_')}`];
    if (npmConfigEnv !== undefined && npmConfigEnv !== '' && npmConfigEnv !== 'true') return npmConfigEnv;

    const positionalIndex = positionByName[name];
    if (positionalIndex !== undefined) {
        const positional = positionalArgs[positionalIndex];
        if (positional) return positional;
    }

    return undefined;
};

const parseFloatArg = (name: string, defaultValue: number, min: number, max: number): number => {
    const raw = parseArg(name);
    if (!raw) return defaultValue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        throw new Error(`Invalid value for ${name}: ${raw}`);
    }
    return parsed;
};

const sampleLimitRaw = parseArg('sample-limit');
const sampleLimit = sampleLimitRaw ? Math.max(1, Number.parseInt(sampleLimitRaw, 10) || 40) : 40;
const dynamicBiasStrength = parseFloatArg('bias-strength', 1, 0, 8);
const bomberBombWindowBonus = parseFloatArg('bomber-bomb-bonus', 0, -50, 50);
const bomberRepositionBonus = parseFloatArg('bomber-reposition-bonus', 0, -50, 50);

const engineRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const corpusPath = resolve(engineRoot, 'src/__tests__/__fixtures__/ai/enemy_decision_corpus/baseline_states.json');
const lowHpCorpusPath = resolve(engineRoot, 'src/__tests__/__fixtures__/ai/enemy_decision_corpus/low_hp_states.json');
const goldenFixturesDir = resolve(engineRoot, 'src/__tests__/golden-runs/fixtures');
const descriptors = JSON.parse(readFileSync(corpusPath, 'utf8')) as CorpusStateDescriptor[];
const lowHpDescriptors = JSON.parse(readFileSync(lowHpCorpusPath, 'utf8')) as CorpusStateDescriptor[];

const loadGoldenFixtures = (): GoldenRunFixture[] => {
    return readdirSync(goldenFixturesDir)
        .filter(name => name.endsWith('.json'))
        .sort()
        .map(name => JSON.parse(readFileSync(join(goldenFixturesDir, name), 'utf8')) as GoldenRunFixture);
};

const withDynamicIntentBias = <T>(enabled: boolean, biasStrength: number | undefined, fn: () => T): T => {
    const key = 'HOP_ENEMY_AI_DYNAMIC_INTENT_BIAS';
    const strengthKey = 'HOP_ENEMY_AI_DYNAMIC_INTENT_BIAS_STRENGTH';
    const bombWindowKey = 'HOP_ENEMY_AI_BOMBER_BOMB_WINDOW_BONUS';
    const repositionKey = 'HOP_ENEMY_AI_BOMBER_REPOSITION_BONUS';
    const previous = process.env[key];
    const previousStrength = process.env[strengthKey];
    const previousBombWindow = process.env[bombWindowKey];
    const previousReposition = process.env[repositionKey];
    if (enabled) {
        process.env[key] = '1';
        if (biasStrength !== undefined) {
            process.env[strengthKey] = String(biasStrength);
        } else {
            delete process.env[strengthKey];
        }
        process.env[bombWindowKey] = String(bomberBombWindowBonus);
        process.env[repositionKey] = String(bomberRepositionBonus);
    } else {
        delete process.env[key];
        delete process.env[strengthKey];
        delete process.env[bombWindowKey];
        delete process.env[repositionKey];
    }
    try {
        return fn();
    } finally {
        if (previous === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = previous;
        }
        if (previousStrength === undefined) {
            delete process.env[strengthKey];
        } else {
            process.env[strengthKey] = previousStrength;
        }
        if (previousBombWindow === undefined) {
            delete process.env[bombWindowKey];
        } else {
            process.env[bombWindowKey] = previousBombWindow;
        }
        if (previousReposition === undefined) {
            delete process.env[repositionKey];
        } else {
            process.env[repositionKey] = previousReposition;
        }
    }
};

const toLowHpState = (
    state: GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] },
    ratio: number
): GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] } => {
    const clampedRatio = Math.max(0.05, Math.min(1, ratio));
    const enemies = state.enemies.map((enemy: Entity) => {
        const maxHp = Math.max(1, Number(enemy.maxHp || 1));
        const hp = Math.max(1, Math.min(maxHp, Math.floor(maxHp * clampedRatio)));
        return {
            ...enemy,
            hp
        };
    });
    return {
        ...state,
        enemies
    };
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
    result: EnemyAiDecisionResult
) => ({
    intent: result.plannedEntity.intent,
    intentPosition: result.plannedEntity.intentPosition,
    position: result.plannedEntity.position,
    actionCooldown: result.plannedEntity.actionCooldown,
    facing: result.plannedEntity.facing,
    isVisible: result.plannedEntity.isVisible,
    rngCounter: result.nextState.rngCounter,
    message: result.message,
    reasoningCode: result.decision.reasoningCode
});

const collectDynamicBiasDecisionDiffReport = (): DynamicBiasDecisionDiffReport => {
    let examinedCases = 0;
    let mismatchCases = 0;
    const bySubtype: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const sample: DynamicBiasDecisionDiffCase[] = [];

    const recordState = (state: GameState & { occupiedCurrentTurn?: { q: number; r: number; s: number }[] }, source: string): void => {
        for (const enemy of state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy')) {
            examinedCases += 1;
            const context = {
                enemy,
                playerPos: state.player.position,
                state
            };
            const baseline = withDynamicIntentBias(false, undefined, () => selectEnemyDecision(context));
            const dynamicBias = withDynamicIntentBias(true, dynamicBiasStrength, () => selectEnemyDecision(context));
            const reason = comparePlanned(baseline, dynamicBias);

            if (!reason) continue;

            mismatchCases += 1;
            const subtype = String(enemy.subtype || 'unknown');
            bySubtype[subtype] = (bySubtype[subtype] || 0) + 1;
            byReason[reason] = (byReason[reason] || 0) + 1;
            bySource[source] = (bySource[source] || 0) + 1;

            if (sample.length < sampleLimit) {
                sample.push({
                    caseId: `${source}:${enemy.id}:${subtype}`,
                    source,
                    enemyId: enemy.id,
                    subtype,
                    mismatchReason: reason,
                    baseline: summarizeSelection(baseline),
                    dynamicBias: summarizeSelection(dynamicBias)
                });
            }
        }
    };

    for (const descriptor of descriptors) {
        const state = generateInitialState(descriptor.floor, descriptor.seed, descriptor.seed);
        recordState({ ...state, occupiedCurrentTurn: state.occupiedCurrentTurn }, `baseline:${descriptor.id}`);
    }

    for (const descriptor of lowHpDescriptors) {
        const state = generateInitialState(descriptor.floor, descriptor.seed, descriptor.seed);
        const lowHpState = toLowHpState(
            { ...state, occupiedCurrentTurn: state.occupiedCurrentTurn },
            descriptor.enemyHpRatio ?? 0.2
        );
        recordState(lowHpState, `lowhp:${descriptor.id}`);
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
        dynamicBiasStrength,
        calibration: {
            bomberBombWindowBonus,
            bomberRepositionBonus
        },
        examinedCases,
        mismatchCases,
        mismatchRate: Number((mismatchCases / Math.max(1, examinedCases)).toFixed(4)),
        bySubtype: Object.fromEntries(Object.entries(bySubtype).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        byReason: Object.fromEntries(Object.entries(byReason).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        bySource: Object.fromEntries(Object.entries(bySource).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        sample
    };
};

console.log(JSON.stringify(collectDynamicBiasDecisionDiffReport(), null, 2));
