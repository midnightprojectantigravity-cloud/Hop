import { gameReducer } from '../../../logic';
import { SkillRegistry } from '../../../skillRegistry';
import type { Action, GameState } from '../../../types';
import { seededChoiceSource } from '../core/tiebreak';
import type { GenericUnitAiCandidateFacts, GenericUnitAiSelectionSummary } from '../generic-unit-ai';
import { selectGenericUnitAiAction } from '../generic-unit-ai';
import { chooseGenericAiGoal } from './policy';
import type { GenericAiGoal, GenericAiGoalProfile } from './policy';

export type HarnessBotPolicy = 'random' | 'heuristic';

export interface HarnessPlayerSelection {
    action: Action;
    goal: GenericAiGoal;
    selectedFacts?: GenericUnitAiCandidateFacts;
    selectionSummary?: GenericUnitAiSelectionSummary;
}

export const resolvePending = (state: GameState): GameState => {
    let cur = state;
    let safety = 0;
    while (cur.pendingStatus && safety < 20) {
        cur = gameReducer(cur, { type: 'RESOLVE_PENDING' });
        safety += 1;
    }
    return cur;
};

const listRandomOptions = (state: GameState): Action[] => {
    const moveTargets = state.player.activeSkills.some(skill => skill.id === 'BASIC_MOVE')
        ? SkillRegistry.get('BASIC_MOVE')?.getValidTargets?.(state, state.player.position) || []
        : [];
    return [
        { type: 'WAIT' },
        ...moveTargets.map(target => ({ type: 'MOVE' as const, payload: target }))
    ];
};

export const selectByOnePlySimulation = (
    state: GameState,
    goal: GenericAiGoal,
    simSeed: string,
    decisionCounter: number,
    _topK = 6
): Action => {
    const result = selectGenericUnitAiAction({
        state,
        actor: state.player,
        side: 'player',
        simSeed,
        decisionCounter,
        goal
    });
    return result.selected.action;
};

export const selectHarnessPlayerAction = (
    state: GameState,
    policy: HarnessBotPolicy,
    profile: GenericAiGoalProfile,
    simSeed: string,
    decisionCounter: number
): HarnessPlayerSelection => {
    const goal = chooseGenericAiGoal(state, profile);

    if (policy === 'random') {
        const options = listRandomOptions(state);
        const tie = seededChoiceSource.chooseIndex(options.length, { seed: simSeed, counter: decisionCounter });
        return {
            action: options[tie.index] || { type: 'WAIT' },
            goal
        };
    }

    const selection = selectGenericUnitAiAction({
        state,
        actor: state.player,
        side: 'player',
        simSeed,
        decisionCounter,
        goal
    });
    return {
        action: selection.selected.action,
        goal,
        selectedFacts: selection.selected.facts,
        selectionSummary: selection.summary
    };
};
