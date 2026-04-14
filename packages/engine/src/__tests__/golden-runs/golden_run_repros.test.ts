import { describe, expect, it } from 'vitest';
import { gameReducer, generateInitialState } from '../../logic';
import { resolveStartRunMapConfig } from '../../constants';
import { DEFAULT_LOADOUTS } from '../../systems/loadout';
import { isPlayerTurn } from '../../systems/initiative';
import { getGenericAiGoalProfile } from '../../systems/ai/player/policy';
import { resolvePending, selectHarnessPlayerAction } from '../../systems/ai/player/selector';
import type { GameState } from '../../types';

type LoadoutId = keyof typeof DEFAULT_LOADOUTS;

const createHarnessState = (seed: string, loadoutId: LoadoutId): GameState => {
    const mapConfig = resolveStartRunMapConfig(undefined, undefined);
    return generateInitialState(
        1,
        seed,
        seed,
        undefined,
        DEFAULT_LOADOUTS[loadoutId],
        mapConfig,
        mapConfig.mapShape
    );
};

const hostileCount = (state: GameState): number =>
    state.enemies.filter(enemy => enemy.hp > 0 && enemy.factionId === 'enemy' && enemy.subtype !== 'bomb').length;

const driveToPredicate = (
    seed: string,
    loadoutId: LoadoutId,
    predicate: (state: GameState) => boolean,
    maxSteps = 80
): { state: GameState; decisionCounter: number } => {
    const profile = getGenericAiGoalProfile('sp-v1-default');
    let state = createHarnessState(seed, loadoutId);
    let decisionCounter = 0;
    let steps = 0;

    while (!predicate(state) && steps < maxSteps && state.gameStatus !== 'won' && state.gameStatus !== 'lost') {
        steps += 1;
        if (state.gameStatus === 'choosing_upgrade') {
            const option = state.shrineOptions?.[0] || 'EXTRA_HP';
            state = gameReducer(state, { type: 'SELECT_UPGRADE', payload: option });
            state = resolvePending(state);
            continue;
        }

        if (isPlayerTurn(state)) {
            const selection = selectHarnessPlayerAction(
                state,
                'heuristic',
                profile,
                `${seed}:heuristic`,
                decisionCounter++
            );
            state = gameReducer(state, selection.action);
            state = resolvePending(state);
            continue;
        }

        state = gameReducer(state, { type: 'ADVANCE_TURN' });
        state = resolvePending(state);
    }

    expect(predicate(state), `Failed to reach repro state for ${loadoutId}/${seed} within ${maxSteps} steps`).toBe(true);
    return { state, decisionCounter };
};

describe('golden run repro guards', () => {
    it('firemage holds position after the room is clear instead of sprinting to the stairs', () => {
        const seed = 'firemage-10';
        const { state, decisionCounter } = driveToPredicate(
            seed,
            'FIREMAGE',
            current =>
                current.gameStatus === 'playing'
                && isPlayerTurn(current)
                && hostileCount(current) === 0
        );
        const selection = selectHarnessPlayerAction(
            state,
            'heuristic',
            getGenericAiGoalProfile('sp-v1-default'),
            `${seed}:heuristic`,
            decisionCounter
        );

        expect(selection.action.type).not.toBe('MOVE');
        expect(selection.action.type).toBe('WAIT');
    });

    it('vanguard breaks out of the floor-1 stall and reaches floor 2', () => {
        const seed = 'vanguard-17';
        const { state } = driveToPredicate(
            seed,
            'VANGUARD',
            current => current.floor >= 2,
            120
        );
        expect(state.floor).toBeGreaterThanOrEqual(2);
        expect(state.gameStatus).toBe('playing');
    });

    it('necromancer keeps making objective progress after combat instead of stalling out', () => {
        const seed = 'necromancer-4';
        const { state, decisionCounter } = driveToPredicate(
            seed,
            'NECROMANCER',
            current =>
                current.gameStatus === 'playing'
                && isPlayerTurn(current)
                && hostileCount(current) === 0
                && !current.shrinePosition
        );
        const selection = selectHarnessPlayerAction(
            state,
            'heuristic',
            getGenericAiGoalProfile('sp-v1-default'),
            `${seed}:heuristic`,
            decisionCounter
        );

        expect(selection.action.type).toBe('MOVE');
        expect(selection.selectedFacts?.improvesObjective).toBe(true);
        expect(selection.selectionSummary?.coherenceTargetKind).toBe('objective');
    });

    it('hunter avoids an empty wait when the next approach step is available', () => {
        const seed = 'hunter-23';
        const { state, decisionCounter } = driveToPredicate(
            seed,
            'HUNTER',
            current =>
                current.gameStatus === 'playing'
                && isPlayerTurn(current)
                && hostileCount(current) > 0
                && (current.turnsSpent || 0) >= 1
        );
        const selection = selectHarnessPlayerAction(
            state,
            'heuristic',
            getGenericAiGoalProfile('sp-v1-default'),
            `${seed}:heuristic`,
            decisionCounter
        );

        expect(selection.action.type).not.toBe('WAIT');
        expect(
            !!selection.selectedFacts?.canDamageNow
            || !!selection.selectedFacts?.createsThreatNextDecision
            || !!selection.selectedFacts?.improvesObjective
        ).toBe(true);
    });
});
