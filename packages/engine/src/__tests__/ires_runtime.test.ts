import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { previewActionOutcome } from '../systems/action-preview';
import { buildInitiativeQueue, isPlayerTurn } from '../systems/initiative';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibilityFromScratch } from '../systems/visibility';
import { resolveCombatPressureMode } from '../systems/free-move';
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
    return recomputeVisibilityFromScratch(withQueue);
};

const prepareReadyPlayerState = ({
    seed,
    playerPos,
    enemyPos,
    mutatePlayer
}: {
    seed: string;
    playerPos: ReturnType<typeof createHex>;
    enemyPos?: ReturnType<typeof createHex>;
    mutatePlayer?: (player: ReturnType<typeof generateInitialState>['player']) => ReturnType<typeof generateInitialState>['player'];
}) => {
    const base = generateInitialState(1, seed);
    const nextPlayer = mutatePlayer
        ? mutatePlayer({
            ...base.player,
            position: playerPos,
            previousPosition: playerPos
        })
        : {
            ...base.player,
            position: playerPos,
            previousPosition: playerPos
        };
    const nextState = {
        ...base,
        player: nextPlayer,
        enemies: enemyPos
            ? [{
                ...base.enemies[0]!,
                position: enemyPos,
                previousPosition: enemyPos,
                hp: 99,
                maxHp: 99
            }]
            : []
    };
    const withQueue = {
        ...nextState,
        initiativeQueue: buildInitiativeQueue(nextState),
        occupancyMask: SpatialSystem.refreshOccupancyMask(nextState)
    };
    return gameReducer(recomputeVisibilityFromScratch(withQueue), { type: 'ADVANCE_TURN' });
};

describe('IRES runtime', () => {
    it('derives travel vs battle mode from enemy alert state', () => {
        const noHostiles = recomputeVisibilityFromScratch({
            ...generateInitialState(1, 'ires-travel-no-hostiles'),
            enemies: []
        });
        expect(resolveCombatPressureMode(noHostiles)).toBe('travel');

        const unawareBase = generateInitialState(1, 'ires-travel-unaware-hostile');
        const unawareHostile = recomputeVisibilityFromScratch({
            ...unawareBase,
            player: {
                ...unawareBase.player,
                position: createHex(4, 8),
                previousPosition: createHex(4, 8)
            },
            enemies: [{
                ...unawareBase.enemies[0]!,
                position: createHex(0, 2),
                previousPosition: createHex(0, 2),
                hp: 99,
                maxHp: 99
            }]
        });
        expect(resolveCombatPressureMode(unawareHostile)).toBe('travel');

        const awareBase = generateInitialState(1, 'ires-travel-aware-hostile');
        const awareHostile = recomputeVisibilityFromScratch({
            ...awareBase,
            player: {
                ...awareBase.player,
                position: createHex(4, 8),
                previousPosition: createHex(4, 8)
            },
            enemies: [{
                ...awareBase.enemies[0]!,
                position: createHex(4, 7),
                previousPosition: createHex(4, 7),
                hp: 99,
                maxHp: 99
            }]
        });
        expect(resolveCombatPressureMode(awareHostile)).toBe('battle');

        expect(resolveCombatPressureMode({
            ...unawareHostile,
            visibility: undefined
        })).toBe('battle');
    });

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
        expect(preview.sparkDelta).toBeLessThan(0);
        expect(preview.sparkBurnOutcome).toBe('burn_now');
        expect(preview.sparkBurnHpDelta).toBeGreaterThan(0);
        expect(preview.bandAfter).toBe('exhausted');
    });

    it('caps Spark Burn actions at one per turn', () => {
        const state = generateInitialState(1, 'ires-burn-cap-seed');
        const config = resolveIresRuleset(state.ruleset);
        const exhaustedBase = applyIresMutationToActor(state.player, { exhaustionDelta: 80 }, config);
        const exhausted = {
            ...exhaustedBase,
            ires: {
                ...exhaustedBase.ires!,
                spark: 80,
                maxSpark: 400,
                exhaustion: 80,
                isExhausted: true,
                currentState: 'exhausted' as const
            }
        };
        const firstPreview = resolveIresActionPreview(
            exhausted,
            'BASIC_ATTACK',
            getSkillDefinition('BASIC_ATTACK')?.resourceProfile
        );
        const afterFirstBurn = applyIresMutationToActor(exhausted, {
            actionCountDelta: 1,
            sparkBurnActionsThisTurnDelta: 1,
            actedThisTurn: true
        }, config);
        const secondPreview = resolveIresActionPreview(
            afterFirstBurn,
            'BASIC_ATTACK',
            getSkillDefinition('BASIC_ATTACK')?.resourceProfile
        );

        expect(firstPreview.blockedReason).toBeUndefined();
        expect(firstPreview.sparkBurnOutcome).toBe('burn_now');
        expect(firstPreview.sparkBurnHpDelta).toBeGreaterThan(0);
        expect(afterFirstBurn.ires?.sparkBurnActionsThisTurn).toBe(1);
        expect(secondPreview.blockedReason).toBeUndefined();
        expect(secondPreview.sparkDelta).toBeLessThan(0);
        expect(secondPreview.sparkBurnHpDelta).toBe(0);
        expect(secondPreview.sparkBurnOutcome).toBe('burn_blocked_cap');
    });

    it('self-settles pure movement in travel mode and resets turn burden without arming rest bonuses', () => {
        const state = prepareReadyPlayerState({
            seed: 'ires-travel-settle',
            playerPos: createHex(4, 8),
            mutatePlayer: (player) => applyIresMutationToActor(
                player,
                { sparkDelta: -40, exhaustionDelta: 20 },
                resolveIresRuleset()
            )
        });
        const target = getSkillDefinition('BASIC_MOVE')!.getValidTargets!(state, state.player.position)[0]!;
        const preview = previewActionOutcome(state, {
            actorId: state.player.id,
            skillId: 'BASIC_MOVE',
            target
        });

        expect(preview.ok).toBe(true);
        expect(preview.resourcePreview?.modeBefore).toBe('travel');
        expect(preview.resourcePreview?.modeAfter).toBe('travel');
        expect(preview.resourcePreview?.travelRecoveryApplied).toBe(true);
        expect(preview.resourcePreview?.travelRecoverySuppressedReason).toBeUndefined();

        const committed = gameReducer(state, {
            type: 'USE_SKILL',
            payload: {
                skillId: 'BASIC_MOVE',
                target
            }
        });

        expect(isPlayerTurn(committed)).toBe(true);
        expect(resolveCombatPressureMode(committed)).toBe('travel');
        expect(committed.player.ires?.spark).toBe(preview.predictedState?.player.ires?.spark);
        expect(committed.player.ires?.mana).toBe(preview.predictedState?.player.ires?.mana);
        expect(committed.player.ires?.exhaustion).toBe(preview.predictedState?.player.ires?.exhaustion);
        expect(committed.player.ires?.actionCountThisTurn).toBe(0);
        expect(committed.player.ires?.movedThisTurn).toBe(false);
        expect(committed.player.ires?.actedThisTurn).toBe(false);
        expect(committed.player.ires?.pendingRestedBonus).toBe(false);
    });

    it('suppresses travel recovery for the opening move that flips alert on', () => {
        const state = prepareReadyPlayerState({
            seed: 'travel-flip-search',
            playerPos: createHex(4, 8),
            enemyPos: createHex(0, 2)
        });
        const target = createHex(4, 2);
        const preview = previewActionOutcome(state, {
            actorId: state.player.id,
            skillId: 'BASIC_MOVE',
            target
        });

        expect(preview.ok).toBe(true);
        expect(preview.resourcePreview?.modeBefore).toBe('travel');
        expect(preview.resourcePreview?.modeAfter).toBe('battle');
        expect(preview.resourcePreview?.travelRecoveryApplied).toBe(false);
        expect(preview.resourcePreview?.travelRecoverySuppressedReason).toBe('alert_triggered');

        const committed = gameReducer(state, {
            type: 'USE_SKILL',
            payload: {
                skillId: 'BASIC_MOVE',
                target
            }
        });

        expect(resolveCombatPressureMode(committed)).toBe('battle');
        expect(committed.player.position).toEqual(preview.predictedState?.player.position);
        expect(committed.player.ires?.spark).toBe(preview.predictedState?.player.ires?.spark);
        expect(committed.player.ires?.exhaustion).toBe(preview.predictedState?.player.ires?.exhaustion);
        expect(committed.player.ires?.actionCountThisTurn).toBe(1);
        expect(committed.player.ires?.movedThisTurn).toBe(true);
        expect(committed.player.ires?.actedThisTurn).toBe(false);
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
