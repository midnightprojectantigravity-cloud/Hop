import { fileURLToPath } from 'node:url';
import type { GenericAiGoal } from '../../../types';

export interface DungeonLabFixtureBand {
    min: number;
    max: number;
}

export interface DungeonLabFixtureExpectationV1 {
    id: string;
    bundleFile: string;
    floorId: string;
    simulation: {
        batchCount: number;
        maxTurns: number;
        focusActorId: string;
        policy: 'heuristic';
        policyProfileId: string;
        goalBySide: Partial<Record<'player' | 'enemy', GenericAiGoal>>;
    };
    structural: {
        authoredEnemyCount: number;
        exactEnemyCount?: number;
        generatedEnemyCountExceedsAuthored?: boolean;
    };
    metrics: {
        winRate: DungeonLabFixtureBand;
        timeoutRate: DungeonLabFixtureBand;
        medianSurvivalTurns: DungeonLabFixtureBand;
        p95DamageDealt?: DungeonLabFixtureBand;
        p95DamageTaken?: DungeonLabFixtureBand;
        avgFirstContactTurn?: DungeonLabFixtureBand;
        avgFirstDamageTurn?: DungeonLabFixtureBand;
    };
    focus: {
        endedAliveRate: DungeonLabFixtureBand;
        resultCounts: {
            won: number;
            lost: number;
            timeout: number;
        };
        playerFocused: boolean;
    };
    openingPressure?: {
        maxFirstContactTurn: number;
        maxFirstDamageTurn: number;
        minTurnsSpent: number;
        forbidTimeouts: boolean;
    };
}

export const resolveDungeonLabFixtureBundlePath = (bundleFile: string): string =>
    fileURLToPath(new URL(`./${bundleFile}`, import.meta.url));

export const DUNGEON_LAB_FIXTURE_EXPECTATIONS: DungeonLabFixtureExpectationV1[] = [
    {
        id: 'floor10_vanguard_vs_butcher_control',
        bundleFile: 'floor10_vanguard_vs_butcher_control.bundle.json',
        floorId: 'floor10-vanguard-vs-butcher-control',
        simulation: {
            batchCount: 2,
            maxTurns: 24,
            focusActorId: 'vanguard',
            policy: 'heuristic',
            policyProfileId: 'sp-v1-default',
            goalBySide: { player: 'engage', enemy: 'engage' }
        },
        structural: {
            authoredEnemyCount: 1,
            exactEnemyCount: 1
        },
        metrics: {
            winRate: { min: 1, max: 1 },
            timeoutRate: { min: 0, max: 0 },
            medianSurvivalTurns: { min: 24, max: 24 },
            p95DamageDealt: { min: 207, max: 207 },
            p95DamageTaken: { min: 224, max: 224 },
            avgFirstContactTurn: { min: 0, max: 0 },
            avgFirstDamageTurn: { min: 0, max: 0 }
        },
        focus: {
            endedAliveRate: { min: 1, max: 1 },
            resultCounts: { won: 2, lost: 0, timeout: 0 },
            playerFocused: true
        }
    },
    {
        id: 'floor10_vanguard_vs_butcher_full',
        bundleFile: 'floor10_vanguard_vs_butcher_full.bundle.json',
        floorId: 'floor10-vanguard-vs-butcher-full',
        simulation: {
            batchCount: 2,
            maxTurns: 24,
            focusActorId: 'vanguard',
            policy: 'heuristic',
            policyProfileId: 'sp-v1-default',
            goalBySide: { player: 'explore', enemy: 'engage' }
        },
        structural: {
            authoredEnemyCount: 1,
            exactEnemyCount: 1
        },
        metrics: {
            winRate: { min: 0, max: 0 },
            timeoutRate: { min: 0, max: 0 },
            medianSurvivalTurns: { min: 7, max: 7 },
            p95DamageDealt: { min: 84, max: 84 },
            p95DamageTaken: { min: 252, max: 252 },
            avgFirstContactTurn: { min: 0, max: 0 },
            avgFirstDamageTurn: { min: 0, max: 0 }
        },
        focus: {
            endedAliveRate: { min: 0, max: 0 },
            resultCounts: { won: 0, lost: 2, timeout: 0 },
            playerFocused: true
        },
        openingPressure: {
            maxFirstContactTurn: 0,
            maxFirstDamageTurn: 0,
            minTurnsSpent: 5,
            forbidTimeouts: true
        }
    },
    {
        id: 'inferno_f5_firemage_vs_vanguard_control',
        bundleFile: 'inferno_f5_firemage_vs_vanguard_control.bundle.json',
        floorId: 'inferno-f5-firemage-vs-vanguard-control',
        simulation: {
            batchCount: 2,
            maxTurns: 20,
            focusActorId: 'firemage',
            policy: 'heuristic',
            policyProfileId: 'sp-v1-default',
            goalBySide: { player: 'engage', enemy: 'engage' }
        },
        structural: {
            authoredEnemyCount: 1,
            exactEnemyCount: 1
        },
        metrics: {
            winRate: { min: 0, max: 0 },
            timeoutRate: { min: 1, max: 1 },
            medianSurvivalTurns: { min: 9.5, max: 9.5 },
            p95DamageDealt: { min: 397, max: 397 },
            p95DamageTaken: { min: 110, max: 110 },
            avgFirstDamageTurn: { min: 0, max: 0 }
        },
        focus: {
            endedAliveRate: { min: 0.5, max: 0.5 },
            resultCounts: { won: 0, lost: 0, timeout: 2 },
            playerFocused: false
        }
    },
    {
        id: 'inferno_f5_vanguard_spawn_fill_control',
        bundleFile: 'inferno_f5_vanguard_spawn_fill_control.bundle.json',
        floorId: 'inferno-f5-vanguard-spawn-fill-control',
        simulation: {
            batchCount: 2,
            maxTurns: 24,
            focusActorId: 'vanguard',
            policy: 'heuristic',
            policyProfileId: 'sp-v1-default',
            goalBySide: { player: 'explore', enemy: 'engage' }
        },
        structural: {
            authoredEnemyCount: 1,
            generatedEnemyCountExceedsAuthored: true
        },
        metrics: {
            winRate: { min: 0, max: 0 },
            timeoutRate: { min: 1, max: 1 },
            medianSurvivalTurns: { min: 19, max: 19 },
            p95DamageTaken: { min: 80, max: 80 },
            avgFirstContactTurn: { min: 0, max: 0 }
        },
        focus: {
            endedAliveRate: { min: 1, max: 1 },
            resultCounts: { won: 0, lost: 0, timeout: 2 },
            playerFocused: true
        }
    }
];
