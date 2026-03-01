import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { applyEffects } from '../systems/effect-engine';

describe('effect engine reaction window hooks', () => {
    it('resolves before top and after bottom injections deterministically', () => {
        const state = generateInitialState(1, 'effect-engine-reaction-hooks');
        const beforeTraceLen = state.stackTrace?.length || 0;

        const next = applyEffects(
            state,
            [
                { type: 'Message', text: 'ROOT' },
                { type: 'Message', text: 'TAIL' }
            ],
            {
                stackReactions: {
                    beforeResolve: (_s, effect) => (
                        effect.type === 'Message' && effect.text === 'ROOT'
                            ? [{ item: { type: 'Message', text: 'BEFORE_TOP' }, enqueuePosition: 'top' }]
                            : []
                    ),
                    afterResolve: (_s, effect) => (
                        effect.type === 'Message' && effect.text === 'ROOT'
                            ? [{ item: { type: 'Message', text: 'AFTER_BOTTOM' }, enqueuePosition: 'bottom' }]
                            : []
                    )
                }
            }
        );

        const appendedTrace = (next.stackTrace || []).slice(beforeTraceLen);
        expect(appendedTrace.length).toBe(4);
        const rootTick = appendedTrace.find(t => (t.beforeReactionsQueued || 0) > 0);
        expect(rootTick?.beforeReactionsQueued).toBe(1);
        expect(rootTick?.topQueued).toBe(1);
        expect(rootTick?.bottomQueued).toBe(1);

        const loggedTexts = (next.simulationEvents || [])
            .filter(ev => ev.type === 'MessageLogged')
            .map(ev => ev.payload?.text);

        expect(loggedTexts).toEqual(['BEFORE_TOP', 'ROOT', 'TAIL', 'AFTER_BOTTOM']);
    });
});
