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
});

