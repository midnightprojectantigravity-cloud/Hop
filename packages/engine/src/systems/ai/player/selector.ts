import { gameReducer } from '../../../logic';
import { SkillRegistry } from '../../../skillRegistry';
import type { Action, GameState } from '../../../types';
import { seededChoiceSource } from '../core/tiebreak';
import type { GenericUnitAiCandidateFacts, GenericUnitAiSelectionSummary } from '../generic-unit-ai';
import { selectGenericUnitAiAction } from '../generic-unit-ai';
import { chooseStrategicIntent } from './policy';
import type { StrategicIntent, StrategicPolicyProfile } from '../strategic-policy';

export type HarnessBotPolicy = 'random' | 'heuristic';

export interface HarnessPlayerSelection {
    action: Action;
    strategicIntent: StrategicIntent;
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
    strategicIntent: StrategicIntent,
    _profile: StrategicPolicyProfile,
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
        strategicIntent
    });
    return result.selected.action;
};

export const selectHarnessPlayerAction = (
    state: GameState,
    policy: HarnessBotPolicy,
    profile: StrategicPolicyProfile,
    simSeed: string,
    decisionCounter: number
): HarnessPlayerSelection => {
    let strategicIntent = chooseStrategicIntent(state, profile);

    if (policy === 'random') {
        const options = listRandomOptions(state);
        const tie = seededChoiceSource.chooseIndex(options.length, { seed: simSeed, counter: decisionCounter });
        return {
            action: options[tie.index] || { type: 'WAIT' },
            strategicIntent
        };
    }

    const selection = selectGenericUnitAiAction({
        state,
        actor: state.player,
        side: 'player',
        simSeed,
        decisionCounter,
        strategicIntent
    });
    if (selection.selected.action.type === 'WAIT' && selection.summary.selectedWaitForBandPreservation) {
        strategicIntent = 'defense';
    }
    return {
        action: selection.selected.action,
        strategicIntent,
        selectedFacts: selection.selected.facts,
        selectionSummary: selection.summary
    };
};
