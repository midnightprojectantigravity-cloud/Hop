export interface ResolutionStackTick {
    tick: number;
    effectType: string;
    depthBefore: number;
    depthAfter: number;
    reactionsQueued: number;
}

export interface ResolveLifoStackOptions<S, T> {
    apply: (state: S, item: T) => S;
    getReactions?: (state: S, resolvedItem: T) => T[] | undefined;
    describe?: (item: T) => string;
    preserveInputOrder?: boolean;
    startTick?: number;
}

export interface ResolveLifoStackResult<S> {
    state: S;
    trace: ResolutionStackTick[];
    resolvedCount: number;
}

/**
 * Deterministic LIFO resolver with optional reaction injection.
 * - Initial items can preserve input order by reversing pre-push.
 * - Reactions are pushed to top-of-stack and resolve before older items.
 */
export const resolveLifoStack = <S, T>(
    initialState: S,
    items: T[],
    options: ResolveLifoStackOptions<S, T>
): ResolveLifoStackResult<S> => {
    const stack = options.preserveInputOrder === false ? [...items] : [...items].reverse();
    const describe = options.describe || (() => 'UNKNOWN');

    let state = initialState;
    const trace: ResolutionStackTick[] = [];
    let tick = options.startTick || 1;

    while (stack.length > 0) {
        const depthBefore = stack.length;
        const item = stack.pop() as T;
        state = options.apply(state, item);

        const reactions = options.getReactions?.(state, item) || [];
        if (reactions.length > 0) {
            for (let i = reactions.length - 1; i >= 0; i--) {
                stack.push(reactions[i] as T);
            }
        }

        trace.push({
            tick: tick++,
            effectType: describe(item),
            depthBefore,
            depthAfter: stack.length,
            reactionsQueued: reactions.length
        });
    }

    return {
        state,
        trace,
        resolvedCount: trace.length
    };
};

