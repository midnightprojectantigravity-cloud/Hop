import { describe, expect, it, vi } from 'vitest';
import { fingerprintFromState, gameReducer, generateInitialState, processNextTurn } from '../logic';
import * as combatSystem from '../systems/combat';
import { getNeighbors } from '../hex';
import { UnifiedTileService } from '../systems/unified-tile-service';
import { applyEffects } from '../systems/effect-engine';

describe('turn stack guard rails', () => {
    it('blocks ADVANCE_TURN while pendingStatus is active', () => {
        const seed = 'turn-stack-pending-guard-seed';
        const base = generateInitialState(1, seed, seed);
        const pendingState = {
            ...base,
            pendingStatus: { status: 'playing' as const }
        };

        const beforeFingerprint = fingerprintFromState(pendingState);
        const beforeTurn = pendingState.turnNumber;
        const beforeQueue = JSON.stringify(pendingState.initiativeQueue);

        const next = gameReducer(pendingState, { type: 'ADVANCE_TURN' });

        expect(next.turnNumber).toBe(beforeTurn);
        expect(JSON.stringify(next.initiativeQueue)).toBe(beforeQueue);
        expect(next.pendingStatus?.status).toBe('playing');
        expect(fingerprintFromState(next)).toBe(beforeFingerprint);
        expect(next.actionLog?.at(-1)?.type).toBe('ADVANCE_TURN');
    });

    it('returns early when processNextTurn is called directly with pendingStatus', () => {
        const seed = 'turn-stack-process-guard-seed';
        const base = generateInitialState(1, seed, seed);
        const pendingState = {
            ...base,
            pendingStatus: { status: 'playing' as const }
        };

        const next = processNextTurn(pendingState, false);
        expect(next).toBe(pendingState);
    });

    it('blocks ADVANCE_TURN while pending frame stack is non-empty', () => {
        const seed = 'turn-stack-frame-guard-seed';
        const base = generateInitialState(1, seed, seed);
        const pendingFrameState = {
            ...base,
            pendingFrames: [{
                id: 'frame:stairs',
                type: 'STAIRS_TRANSITION' as const,
                status: 'playing' as const,
                createdTurn: base.turnNumber,
                blocking: true,
                payload: { nextFloor: base.floor + 1 }
            }]
        };

        const beforeFingerprint = fingerprintFromState(pendingFrameState);
        const beforeQueue = JSON.stringify(pendingFrameState.initiativeQueue);
        const next = gameReducer(pendingFrameState, { type: 'ADVANCE_TURN' });

        expect(next.turnNumber).toBe(pendingFrameState.turnNumber);
        expect(JSON.stringify(next.initiativeQueue)).toBe(beforeQueue);
        expect(next.pendingFrames?.length).toBe(1);
        expect(fingerprintFromState(next)).toBe(beforeFingerprint);
    });

    it('runs telegraph resolution once per eligible actor step (no duplicate pass)', () => {
        const teleSpy = vi.spyOn(combatSystem, 'resolveTelegraphedAttacks');

        const seed = 'turn-stack-telegraph-seed';
        let state = generateInitialState(1, seed, seed);
        state = { ...state, enemies: [] };

        // Prime control to player turn window first.
        state = gameReducer(state, { type: 'ADVANCE_TURN' });
        teleSpy.mockClear();

        // Commit one action and let engine hand back to next player window.
        state = gameReducer(state, { type: 'WAIT' });

        expect(teleSpy).toHaveBeenCalledTimes(1);
        teleSpy.mockRestore();
        expect(state.gameStatus).toBe('playing');
    });

    it('attaches step envelope metadata to emitted timeline events', () => {
        const seed = 'turn-stack-step-envelope-seed';
        let state = generateInitialState(1, seed, seed);
        state = { ...state, enemies: [] };

        const origin = state.player.position;
        const destination = getNeighbors(origin).find(p => UnifiedTileService.isWalkable(state, p));
        expect(destination).toBeTruthy();

        const stepId = 'test-step-envelope';
        state = applyEffects(state, [{
            type: 'Displacement',
            target: 'self',
            source: origin,
            destination: destination!,
            path: [origin, destination!],
            simulatePath: true
        }], {
            sourceId: state.player.id,
            stepId
        });

        const events = state.timelineEvents || [];
        expect(events.length).toBeGreaterThan(0);
        expect(events.every(ev => ev.stepId === stepId)).toBe(true);
    });
});
