import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { previewActionOutcome } from '../systems/action-preview';
import { buildInitiativeQueue, isPlayerTurn } from '../systems/initiative';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibility } from '../systems/visibility';
import { applyIresMutationToActor, resolveIresActionPreview, resolveIresRuleset } from '../systems/ires';
import { getSkillDefinition } from '../skillRegistry';

const prepareAdjacentEnemyState = () => {
    const base = generateInitialState(1, 'ires-test-seed');
    const playerPos = createHex(4, 5);
    const enemyPos = createHex(5, 5);
    const enemy = {
        ...base.enemies[0]!,
        position: enemyPos,
        previousPosition: enemyPos,
        hp: 99,
        maxHp: 99
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
    return recomputeVisibility(withQueue);
};

describe('IRES runtime', () => {
    it('keeps exhausted state latched until recovery drops below the hysteresis floor', () => {
        const state = generateInitialState(1, 'ires-hysteresis-seed');
        const config = resolveIresRuleset(state.ruleset);
        const entered = applyIresMutationToActor(state.player, { exhaustionDelta: 80 }, config);
        expect(entered.ires?.isExhausted).toBe(true);
        expect(entered.ires?.currentState).toBe('exhausted');

        const stillLatched = applyIresMutationToActor(entered, { exhaustionDelta: -1 }, config);
        expect(stillLatched.ires?.exhaustion).toBe(79);
        expect(stillLatched.ires?.isExhausted).toBe(true);

        const cleared = applyIresMutationToActor(stillLatched, { exhaustionDelta: -30 }, config);
        expect(cleared.ires?.exhaustion).toBe(49);
        expect(cleared.ires?.isExhausted).toBe(false);
        expect(cleared.ires?.currentState).toBe('base');
    });

    it('converts spark actions into Spark Burn while exhausted', () => {
        const state = generateInitialState(1, 'ires-burn-seed');
        const config = resolveIresRuleset(state.ruleset);
        const exhausted = applyIresMutationToActor(state.player, { exhaustionDelta: 80 }, config);
        const preview = resolveIresActionPreview(
            exhausted,
            'BASIC_ATTACK',
            getSkillDefinition('BASIC_ATTACK')?.resourceProfile
        );

        expect(preview.blockedReason).toBeUndefined();
        expect(preview.sparkDelta).toBe(0);
        expect(preview.sparkBurnHpDelta).toBeGreaterThan(0);
        expect(preview.bandAfter).toBe('exhausted');
    });

    it('matches preview and committed resource state and keeps the player turn open after an action', () => {
        let state = prepareAdjacentEnemyState();
        state = gameReducer(state, { type: 'ADVANCE_TURN' });
        expect(isPlayerTurn(state)).toBe(true);

        const enemyPos = state.enemies[0]!.position;
        const preview = previewActionOutcome(state, {
            actorId: state.player.id,
            skillId: 'BASIC_ATTACK',
            target: enemyPos
        });

        expect(preview.ok).toBe(true);
        expect(preview.resourcePreview?.sparkDelta).toBeLessThan(0);
        expect(preview.resourcePreview?.exhaustionDelta).toBeGreaterThan(0);

        const committed = gameReducer(state, {
            type: 'USE_SKILL',
            payload: {
                skillId: 'BASIC_ATTACK',
                target: enemyPos
            }
        });

        expect(committed.turnNumber).toBe(state.turnNumber);
        expect(isPlayerTurn(committed)).toBe(true);
        expect(committed.initiativeQueue?.entries.find(entry => entry.actorId === committed.player.id)?.hasActed).toBe(false);
        expect(committed.player.ires?.spark).toBe(preview.predictedState?.player.ires?.spark);
        expect(committed.player.ires?.exhaustion).toBe(preview.predictedState?.player.ires?.exhaustion);
        expect(committed.player.ires?.actionCountThisTurn).toBe(1);
    });

    it('supports chained player actions before End Turn and resets the IRES turn state after waiting', () => {
        let state = prepareAdjacentEnemyState();
        state = gameReducer(state, { type: 'ADVANCE_TURN' });
        const enemyPos = state.enemies[0]!.position;

        const first = gameReducer(state, {
            type: 'USE_SKILL',
            payload: {
                skillId: 'BASIC_ATTACK',
                target: enemyPos
            }
        });
        const second = gameReducer(first, {
            type: 'USE_SKILL',
            payload: {
                skillId: 'BASIC_ATTACK',
                target: enemyPos
            }
        });

        expect(second.turnNumber).toBe(state.turnNumber);
        expect(second.player.ires?.actionCountThisTurn).toBe(2);
        expect(second.player.ires?.spark).toBeLessThan(first.player.ires?.spark || 0);
        expect(isPlayerTurn(second)).toBe(true);

        const ended = gameReducer(second, { type: 'WAIT' });
        expect(ended.turnNumber).toBeGreaterThan(second.turnNumber);
        expect(ended.player.ires?.actionCountThisTurn).toBe(0);
        expect(ended.player.ires?.spark).toBeGreaterThanOrEqual(second.player.ires?.spark || 0);
    });
});
