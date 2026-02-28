import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
    simulateRunDetailed,
    type ArchetypeLoadoutId,
    type BotPolicy
} from '../src/systems/evaluation/balance-harness';
import type {
    EnemyAiTurnTraceEvent,
    EnemyAiTurnTraceSelectionSnapshot
} from '../src/systems/ai/enemy/selector';

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

interface TurnModeDiffSample {
    runId: string;
    enemyId: string;
    subtype: string;
    floor: number;
    turnNumber: number;
    rngCounter?: number;
    mismatchReason: string;
    withPolicyExact: EnemyAiTurnTraceSelectionSnapshot;
    syntheticOnly: EnemyAiTurnTraceSelectionSnapshot;
}

interface TurnModeDiffReport {
    runs: Array<{
        runId: string;
        result: 'won' | 'lost' | 'timeout';
        floor: number;
        turnsSpent: number;
        events: number;
    }>;
    totalEvents: number;
    mismatchEvents: number;
    mismatchRate: number;
    bySubtype: Record<string, number>;
    byReason: Record<string, number>;
    byRun: Record<string, number>;
    firstMismatchByRun: Record<string, TurnModeDiffSample>;
    sample: TurnModeDiffSample[];
}

const goldenFixturesDir = resolve(process.cwd(), 'src/__tests__/golden-runs/fixtures');

const loadGoldenFixtures = (): GoldenRunFixture[] => {
    return readdirSync(goldenFixturesDir)
        .filter(name => name.endsWith('.json'))
        .sort()
        .map(name => JSON.parse(readFileSync(join(goldenFixturesDir, name), 'utf8')) as GoldenRunFixture);
};

const compareSelection = (
    withPolicyExact: EnemyAiTurnTraceSelectionSnapshot,
    syntheticOnly: EnemyAiTurnTraceSelectionSnapshot
): string | undefined => {
    if (withPolicyExact.intent !== syntheticOnly.intent) return 'intent';
    if (!!withPolicyExact.intentPosition !== !!syntheticOnly.intentPosition) return 'intentPosition_presence';
    if (withPolicyExact.intentPosition && syntheticOnly.intentPosition) {
        if (
            withPolicyExact.intentPosition.q !== syntheticOnly.intentPosition.q
            || withPolicyExact.intentPosition.r !== syntheticOnly.intentPosition.r
            || withPolicyExact.intentPosition.s !== syntheticOnly.intentPosition.s
        ) {
            return 'intentPosition';
        }
    }
    if (
        withPolicyExact.position.q !== syntheticOnly.position.q
        || withPolicyExact.position.r !== syntheticOnly.position.r
        || withPolicyExact.position.s !== syntheticOnly.position.s
    ) {
        return 'position';
    }
    if ((withPolicyExact.actionCooldown ?? undefined) !== (syntheticOnly.actionCooldown ?? undefined)) return 'actionCooldown';
    if ((withPolicyExact.facing ?? undefined) !== (syntheticOnly.facing ?? undefined)) return 'facing';
    if ((withPolicyExact.isVisible ?? undefined) !== (syntheticOnly.isVisible ?? undefined)) return 'isVisible';
    if ((withPolicyExact.nextRngCounter ?? undefined) !== (syntheticOnly.nextRngCounter ?? undefined)) return 'nextRngCounter';
    if ((withPolicyExact.message || '') !== (syntheticOnly.message || '')) return 'message';
    return undefined;
};

const recordCount = (record: Record<string, number>, key: string): void => {
    record[key] = (record[key] || 0) + 1;
};

const runTurnModeDiffReport = (): TurnModeDiffReport => {
    const events: EnemyAiTurnTraceEvent[] = [];
    const runs: TurnModeDiffReport['runs'] = [];
    const bySubtype: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    const byRun: Record<string, number> = {};
    const sample: TurnModeDiffSample[] = [];
    const firstMismatchByRun: Record<string, TurnModeDiffSample> = {};

    (globalThis as any).__HOP_ENEMY_AI_TURN_TRACE_HOOK__ = (event: EnemyAiTurnTraceEvent) => {
        events.push(event);
    };

    const fixtures = loadGoldenFixtures();

    try {
        for (const fixture of fixtures) {
            const runId = fixture.id;
            (globalThis as any).__HOP_ENEMY_AI_TRACE_RUN_ID__ = runId;
            const before = events.length;

            const detailed = simulateRunDetailed(
                fixture.seed,
                fixture.policy || 'heuristic',
                Math.max(1, fixture.maxTurnsPerFloor * fixture.floorsTarget),
                fixture.loadoutId,
                fixture.policyProfileId || 'sp-v1-default'
            );

            const after = events.length;
            runs.push({
                runId,
                result: detailed.run.result,
                floor: detailed.run.floor,
                turnsSpent: detailed.run.turnsSpent,
                events: after - before
            });
        }
    } finally {
        delete (globalThis as any).__HOP_ENEMY_AI_TURN_TRACE_HOOK__;
        delete (globalThis as any).__HOP_ENEMY_AI_TRACE_RUN_ID__;
    }

    let mismatchEvents = 0;
    for (const event of events) {
        const reason = compareSelection(event.withPolicyExact, event.syntheticOnly);
        if (!reason) continue;
        mismatchEvents += 1;
        const runId = event.runId || 'unknown';
        const subtype = String(event.enemySubtype || 'unknown');
        recordCount(bySubtype, subtype);
        recordCount(byReason, reason);
        recordCount(byRun, runId);

        const item: TurnModeDiffSample = {
            runId,
            enemyId: event.enemyId,
            subtype,
            floor: event.floor,
            turnNumber: event.turnNumber,
            rngCounter: event.rngCounter,
            mismatchReason: reason,
            withPolicyExact: event.withPolicyExact,
            syntheticOnly: event.syntheticOnly
        };

        if (!firstMismatchByRun[runId]) {
            firstMismatchByRun[runId] = item;
        }
        if (sample.length < 20) {
            sample.push(item);
        }
    }

    return {
        runs,
        totalEvents: events.length,
        mismatchEvents,
        mismatchRate: Number((mismatchEvents / Math.max(1, events.length)).toFixed(4)),
        bySubtype: Object.fromEntries(Object.entries(bySubtype).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        byReason: Object.fromEntries(Object.entries(byReason).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        byRun: Object.fromEntries(Object.entries(byRun).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        firstMismatchByRun,
        sample
    };
};

console.log(JSON.stringify(runTurnModeDiffReport(), null, 2));
