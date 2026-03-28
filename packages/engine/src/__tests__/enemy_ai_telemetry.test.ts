import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { createEnemy } from '../systems/entities/entity-factory';
import { isPlayerTurn, buildInitiativeQueue } from '../systems/initiative';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import { resolvePending } from '../systems/ai/player/selector';
import { deriveEnemyCombatTelemetryFromState } from '../systems/ai/enemy/runtime-telemetry';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibilityFromScratch } from '../systems/visibility';

const advanceToPlayerTurn = <T extends ReturnType<typeof generateInitialState>>(state: T): T => {
    let cur = state;
    let safety = 0;
    while (!isPlayerTurn(cur) && safety < 12) {
        cur = resolvePending(gameReducer(cur, { type: 'ADVANCE_TURN' })) as T;
        safety += 1;
    }
    return cur;
};

const buildArcherRuntimeState = (seed: string) => {
    const base = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS.VANGUARD);
    const playerPos = createHex(4, 4);
    const enemyPos = createHex(4, 2);
    const enemy = {
        ...createEnemy({
        id: `${seed}-archer`,
        subtype: 'archer',
        position: enemyPos,
        hp: 18,
        maxHp: 18,
        speed: 1,
        skills: ['ARCHER_SHOT']
        }),
        previousPosition: enemyPos
    };
    const seeded = {
        ...base,
        player: {
            ...base.player,
            position: playerPos,
            previousPosition: playerPos
        },
        enemies: [enemy]
    };
    const withQueue = {
        ...seeded,
        initiativeQueue: buildInitiativeQueue(seeded),
        occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
    };
    return advanceToPlayerTurn(recomputeVisibilityFromScratch(withQueue));
};

describe('enemy ai telemetry', () => {
    it('records runtime enemy visibility and idle-loop telemetry on the live turn loop', () => {
        const state = buildArcherRuntimeState('enemy-ai-telemetry-runtime');
        const next = resolvePending(gameReducer(state, { type: 'WAIT' }));
        const telemetry = next.enemyAiTelemetry;

        expect(telemetry).toBeDefined();
        expect(telemetry?.visiblePlayerTurns || 0).toBeGreaterThan(0);
        expect((telemetry?.actionCounts.WAIT || 0) + (telemetry?.actionCounts.MOVE || 0) + (telemetry?.actionCounts.USE_SKILL || 0)).toBeGreaterThan(0);
    });

    it('derives offensive casts and player damage from combat score events for evaluation summaries', () => {
        const state = {
            ...generateInitialState(1, 'enemy-ai-telemetry-derived'),
            combatScoreEvents: [{
                skillId: 'ARCHER_SHOT',
                attackerId: 'enemy_archer_1',
                targetId: 'player',
                finalPower: 3,
                efficiency: 1,
                riskBonusApplied: false,
                damageClass: 'physical' as const,
                hitPressure: 0,
                mitigationPressure: 0,
                rangePressure: 0,
                critPressure: 0,
                resistancePressure: 0,
                bodyContribution: 0,
                mindContribution: 0,
                instinctContribution: 0
            }]
        };

        const derived = deriveEnemyCombatTelemetryFromState(state);

        expect(derived.skillUsage?.ARCHER_SHOT || 0).toBeGreaterThan(0);
        expect(derived.offensiveSkillCasts || 0).toBeGreaterThan(0);
        expect(derived.damageToPlayer || 0).toBe(3);
        expect(derived.attackOpportunityTurns || 0).toBeGreaterThan(0);
        expect(derived.attackConversionTurns || 0).toBeGreaterThan(0);
    });
});
