import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    simulateRunDetailed,
    type ArchetypeLoadoutId,
    type BotPolicy,
} from '../../systems/evaluation/balance-harness';

type RangeTuple = [number, number];

interface GoldenRunFixture {
    id: string;
    version: number;
    seed: string;
    loadoutId: string;
    floorsTarget: number;
    maxTurnsPerFloor: number;
    policy?: BotPolicy;
    policyProfileId?: string;
    expected: {
        outcome: 'won' | 'lost' | 'timeout';
        finalFloor: RangeTuple;
        totalKills: RangeTuple;
        totalTurns: RangeTuple;
        playerHp: RangeTuple;
        fingerprint?: string;
    };
}

const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url));
const failureArtifactsDir = fileURLToPath(new URL('./artifacts/', import.meta.url));
const strictMode = process.env.HOP_GOLDEN_STRICT === '1';

const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return Object.keys(record)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = normalize(record[key]);
                return acc;
            }, {});
    }
    return value;
};

const computeGoldenFingerprint = (payload: unknown): string => {
    const json = JSON.stringify(normalize(payload));
    return createHash('sha256').update(json).digest('hex').slice(0, 16);
};

const expectInRange = (label: string, value: number, [min, max]: RangeTuple) => {
    expect(value, `${label} should be >= ${min}`).toBeGreaterThanOrEqual(min);
    expect(value, `${label} should be <= ${max}`).toBeLessThanOrEqual(max);
};

const loadFixtures = (): GoldenRunFixture[] => {
    return readdirSync(fixturesDir)
        .filter(name => name.endsWith('.json'))
        .sort()
        .map(name => {
            const raw = readFileSync(join(fixturesDir, name), 'utf8');
            return JSON.parse(raw) as GoldenRunFixture;
        });
};

const writeFailureArtifact = (fixture: GoldenRunFixture, payload: unknown): string => {
    mkdirSync(failureArtifactsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = join(failureArtifactsDir, `${fixture.id}.${timestamp}.json`);
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return path;
};

describe('golden run integration envelopes', () => {
    const fixtures = loadFixtures();

    for (const fixture of fixtures) {
        it(fixture.id, () => {
            const maxTurns = Math.max(1, fixture.maxTurnsPerFloor * fixture.floorsTarget);
            const policy = fixture.policy || 'heuristic';
            const policyProfileId = fixture.policyProfileId || 'sp-v1-default';
            const detailed = simulateRunDetailed(
                fixture.seed,
                policy,
                maxTurns,
                fixture.loadoutId as ArchetypeLoadoutId,
                policyProfileId
            );

            const { run, diagnostics } = detailed;
            const strictFingerprint = computeGoldenFingerprint({
                run,
                diagnostics: {
                    actionLog: diagnostics.actionLog,
                    stateFingerprint: diagnostics.stateFingerprint
                }
            });

            const failurePayload = {
                fixture,
                maxTurns,
                strictMode,
                run,
                diagnostics: {
                    actionCount: diagnostics.actionLog.length,
                    stateFingerprint: diagnostics.stateFingerprint
                },
                strictFingerprint,
                actions: diagnostics.actionLog
            };

            try {
                expect(run.result).toBe(fixture.expected.outcome);
                expect(run.floor).toBeGreaterThanOrEqual(fixture.floorsTarget);
                expectInRange('finalFloor', run.floor, fixture.expected.finalFloor);
                expectInRange('totalKills', run.kills, fixture.expected.totalKills);
                expectInRange('totalTurns', run.turnsSpent, fixture.expected.totalTurns);
                expectInRange('playerHp', run.finalPlayerHp, fixture.expected.playerHp);

                if (strictMode && fixture.expected.fingerprint) {
                    expect(strictFingerprint).toBe(fixture.expected.fingerprint);
                }
            } catch (error) {
                const artifactPath = writeFailureArtifact(fixture, failurePayload);
                // Surface artifact path in the test output for quick triage.
                throw new Error(`${(error as Error).message}\nGolden run artifact: ${artifactPath}`);
            }
        });
    }
});

