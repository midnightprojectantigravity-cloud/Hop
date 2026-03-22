import { describe, expect, it } from 'vitest';
import { applyEffects } from '../systems/effect-engine';
import { consumeActionPhaseStatuses, tickStatuses } from '../systems/status';
import { generateInitialState } from '../logic';
import type { StatusEffect } from '../types';

describe('action phase control statuses', () => {
    it('marks hard action denial statuses as action-phase under trinity_ratio_v2', () => {
        const state = generateInitialState(1, 'status-action-phase');
        const enemy = state.enemies[0]!;
        state.ruleset = {
            ...(state.ruleset || {}),
            combat: { version: 'trinity_ratio_v2' }
        };

        const next = applyEffects(state, [
            { type: 'ApplyStatus', target: enemy.id, status: 'stunned', duration: 1 }
        ], { sourceId: state.player.id, targetId: enemy.id });

        const stunned = next.enemies.find(e => e.id === enemy.id)?.statusEffects.find(status => status.type === 'stunned');
        expect(stunned?.durationModel).toBe('action_phase');
        expect(stunned?.remainingActionPhases).toBeGreaterThanOrEqual(1);
    });

    it('keeps soft debuffs on tick-window durations under trinity_ratio_v2', () => {
        const state = generateInitialState(1, 'status-soft-debuff');
        const enemy = state.enemies[0]!;
        state.ruleset = {
            ...(state.ruleset || {}),
            combat: { version: 'trinity_ratio_v2' }
        };

        const next = applyEffects(state, [
            { type: 'ApplyStatus', target: enemy.id, status: 'blinded', duration: 2 }
        ], { sourceId: state.player.id, targetId: enemy.id });

        const blinded = next.enemies.find(e => e.id === enemy.id)?.statusEffects.find(status => status.type === 'blinded');
        expect(blinded?.durationModel ?? 'tick_window').toBe('tick_window');
        expect(blinded?.remainingActionPhases).toBeUndefined();
    });

    it('keeps rooted on tick-window durations until movement-phase consumption exists', () => {
        const state = generateInitialState(1, 'status-rooted-taxonomy');
        const enemy = state.enemies[0]!;
        state.ruleset = {
            ...(state.ruleset || {}),
            combat: { version: 'trinity_ratio_v2' }
        };

        const next = applyEffects(state, [
            { type: 'ApplyStatus', target: enemy.id, status: 'rooted', duration: 2 }
        ], { sourceId: state.player.id, targetId: enemy.id });

        const rooted = next.enemies.find(e => e.id === enemy.id)?.statusEffects.find(status => status.type === 'rooted');
        expect(rooted?.durationModel ?? 'tick_window').toBe('tick_window');
        expect(rooted?.remainingActionPhases).toBeUndefined();
    });

    it('does not tick action-phase statuses on tick windows and consumes them on action', () => {
        const state = generateInitialState(1, 'status-action-consume');
        const actor = {
            ...state.player,
            statusEffects: [{
                id: 'STUNNED',
                type: 'stunned',
                duration: 1,
                tickWindow: 'START_OF_TURN' as const,
                durationModel: 'action_phase' as const,
                remainingActionPhases: 1,
                consumedOnPhase: 'ACTION' as const
            }] satisfies StatusEffect[]
        };

        const unticked = tickStatuses(actor);
        expect(unticked.statusEffects[0]?.remainingActionPhases).toBe(1);

        const consumed = consumeActionPhaseStatuses(unticked);
        expect(consumed.statusEffects).toHaveLength(0);
    });

    it('still ticks soft debuffs down on normal tick windows', () => {
        const state = generateInitialState(1, 'status-soft-debuff-tick');
        const actor = {
            ...state.player,
            statusEffects: [{
                id: 'BLINDED',
                type: 'blinded',
                duration: 2,
                tickWindow: 'END_OF_TURN' as const
            }] satisfies StatusEffect[]
        };

        const ticked = tickStatuses(actor);
        expect(ticked.statusEffects[0]?.duration).toBe(1);
    });
});
