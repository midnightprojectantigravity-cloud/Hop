import { describe, expect, it } from 'vitest';
import { resolveLifoStack } from '../systems/resolution-stack';

describe('resolution stack', () => {
    it('preserves input order while resolving via LIFO', () => {
        const result = resolveLifoStack<string[], string>(
            [],
            ['A', 'B', 'C'],
            {
                apply: (state, item) => [...state, item],
                describe: item => item,
                preserveInputOrder: true
            }
        );

        expect(result.state).toEqual(['A', 'B', 'C']);
        expect(result.trace.map(t => t.effectType)).toEqual(['A', 'B', 'C']);
    });

    it('pushes reactions to top of stack', () => {
        const result = resolveLifoStack<string[], string>(
            [],
            ['A', 'B'],
            {
                apply: (state, item) => [...state, item],
                describe: item => item,
                preserveInputOrder: true,
                getReactions: (_state, item) => item === 'A' ? ['R1', 'R2'] : []
            }
        );

        expect(result.state).toEqual(['A', 'R1', 'R2', 'B']);
        expect(result.trace.find(t => t.effectType === 'A')?.reactionsQueued).toBe(2);
    });

    it('supports BEFORE_RESOLVE style reaction injection on top-of-stack', () => {
        const result = resolveLifoStack<string[], string>(
            [],
            ['A', 'B'],
            {
                apply: (state, item) => [...state, item],
                describe: item => item,
                preserveInputOrder: true,
                getBeforeReactions: (_state, item) => item === 'A'
                    ? [{ item: 'BR', enqueuePosition: 'top' }]
                    : []
            }
        );

        expect(result.state).toEqual(['BR', 'A', 'B']);
        const tickA = result.trace.find(t => t.effectType === 'A');
        expect(tickA?.beforeReactionsQueued).toBe(1);
        expect(tickA?.topQueued).toBe(1);
        expect(tickA?.bottomQueued).toBe(0);
    });

    it('supports AFTER_RESOLVE style bottom enqueue ordering', () => {
        const result = resolveLifoStack<string[], string>(
            [],
            ['A', 'B'],
            {
                apply: (state, item) => [...state, item],
                describe: item => item,
                preserveInputOrder: true,
                getAfterReactions: (_state, item) => item === 'A'
                    ? [{ item: 'AR', enqueuePosition: 'bottom' }]
                    : []
            }
        );

        expect(result.state).toEqual(['A', 'B', 'AR']);
        const tickA = result.trace.find(t => t.effectType === 'A');
        expect(tickA?.afterReactionsQueued).toBe(1);
        expect(tickA?.bottomQueued).toBe(1);
        expect(tickA?.topQueued).toBe(0);
    });
});
