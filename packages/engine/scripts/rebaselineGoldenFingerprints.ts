import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    simulateRunDetailed,
    type ArchetypeLoadoutId,
    type BotPolicy,
} from '../src/systems/evaluation/balance-harness';

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
        finalFloor: [number, number];
        totalKills: [number, number];
        totalTurns: [number, number];
        playerHp: [number, number];
        fingerprint?: string;
    };
}

const fixturesDir = resolve(process.cwd(), 'packages/engine/src/__tests__/golden-runs/fixtures');
const checkOnly = process.argv.includes('--check');

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

const fixtureFiles = readdirSync(fixturesDir)
    .filter(name => name.endsWith('.json'))
    .sort();

const changed: Array<{ file: string; fixtureId: string; before: string | null; after: string }> = [];

for (const fileName of fixtureFiles) {
    const fixturePath = resolve(fixturesDir, fileName);
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as GoldenRunFixture;

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

    const strictFingerprint = computeGoldenFingerprint({
        run: detailed.run,
        diagnostics: {
            actionLog: detailed.diagnostics.actionLog,
            stateFingerprint: detailed.diagnostics.stateFingerprint,
        },
    });

    const before = fixture.expected.fingerprint || null;
    if (before !== strictFingerprint) {
        changed.push({ file: fileName, fixtureId: fixture.id, before, after: strictFingerprint });
        if (!checkOnly) {
            fixture.expected.fingerprint = strictFingerprint;
            writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
        }
    }
}

console.log(JSON.stringify({
    mode: checkOnly ? 'check' : 'write',
    fixtures: fixtureFiles.length,
    changed: changed.length,
    changes: changed,
}, null, 2));

if (checkOnly && changed.length > 0) {
    process.exitCode = 2;
}
