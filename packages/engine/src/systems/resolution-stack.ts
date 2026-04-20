export interface ResolutionStackTick {
    tick: number;
    effectType: string;
    depthBefore: number;
    depthAfter: number;
    reactionsQueued: number;
    beforeReactionsQueued?: number;
    afterReactionsQueued?: number;
    topQueued?: number;
    bottomQueued?: number;
}

export type StackReactionEnqueuePosition = 'top' | 'bottom';

export interface StackReactionItem<T> {
    item: T;
    enqueuePosition?: StackReactionEnqueuePosition;
}

export type StackReactionSet<T> = Array<T | StackReactionItem<T>> | undefined;

export interface ResolveLifoStackOptions<S, T> {
    apply: (state: S, item: T) => S;
    getReactions?: (state: S, resolvedItem: T) => T[] | undefined;
    getBeforeReactions?: (state: S, pendingItem: T) => StackReactionSet<T>;
    getAfterReactions?: (state: S, resolvedItem: T) => StackReactionSet<T>;
    describe?: (item: T) => string;
    preserveInputOrder?: boolean;
    startTick?: number;
    maxDepth?: number;
}

export class ResolutionStackOverflowError extends Error {
    readonly maxDepth: number;
    readonly currentDepth: number;

    constructor(maxDepth: number, currentDepth: number) {
        super(`Resolution stack exceeded max depth ${maxDepth} (depth=${currentDepth})`);
        this.name = 'ResolutionStackOverflowError';
        this.maxDepth = maxDepth;
        this.currentDepth = currentDepth;
    }
}

export interface ResolveLifoStackResult<S> {
    state: S;
    trace: ResolutionStackTick[];
    resolvedCount: number;
}

interface StackEntry<T> {
    item: T;
    beforeInjected: boolean;
    beforeQueued: number;
    beforeTopQueued: number;
    beforeBottomQueued: number;
}

interface NormalizedReaction<T> {
    item: T;
    enqueuePosition: StackReactionEnqueuePosition;
}

const isStackReactionItem = <T>(value: T | StackReactionItem<T>): value is StackReactionItem<T> =>
    typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'item');

const normalizeReactions = <T>(input: StackReactionSet<T>, defaultPosition: StackReactionEnqueuePosition = 'top'): NormalizedReaction<T>[] => {
    if (!input || input.length === 0) return [];
    const normalized: NormalizedReaction<T>[] = [];
    for (const reaction of input) {
        if (isStackReactionItem(reaction)) {
            normalized.push({
                item: reaction.item,
                enqueuePosition: reaction.enqueuePosition === 'bottom' ? 'bottom' : defaultPosition
            });
            continue;
        }
        normalized.push({
            item: reaction,
            enqueuePosition: defaultPosition
        });
    }
    return normalized;
};

const enqueueReactionEntries = <T>(stack: StackEntry<T>[], reactions: NormalizedReaction<T>[]): { topQueued: number; bottomQueued: number } => {
    let topQueued = 0;
    let bottomQueued = 0;
    const top = reactions.filter(r => r.enqueuePosition === 'top');
    const bottom = reactions.filter(r => r.enqueuePosition === 'bottom');

    // Push top-of-stack reactions so they resolve before older stack entries.
    for (let i = top.length - 1; i >= 0; i--) {
        stack.push({
            item: top[i].item,
            beforeInjected: false,
            beforeQueued: 0,
            beforeTopQueued: 0,
            beforeBottomQueued: 0
        });
        topQueued += 1;
    }

    // Unshift bottom-of-stack reactions so they resolve after older stack entries.
    for (let i = 0; i < bottom.length; i++) {
        stack.unshift({
            item: bottom[i].item,
            beforeInjected: false,
            beforeQueued: 0,
            beforeTopQueued: 0,
            beforeBottomQueued: 0
        });
        bottomQueued += 1;
    }

    return { topQueued, bottomQueued };
};

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
    const maxDepth = options.maxDepth ?? 200;
    const ordered = options.preserveInputOrder === false ? [...items] : [...items].reverse();
    const stack: StackEntry<T>[] = ordered.map(item => ({
        item,
        beforeInjected: false,
        beforeQueued: 0,
        beforeTopQueued: 0,
        beforeBottomQueued: 0
    }));
    const describe = options.describe || (() => 'UNKNOWN');

    let state = initialState;
    const trace: ResolutionStackTick[] = [];
    let tick = options.startTick || 1;

    while (stack.length > 0) {
        if (stack.length > maxDepth) {
            throw new ResolutionStackOverflowError(maxDepth, stack.length);
        }
        const depthBefore = stack.length;
        const entry = stack.pop() as StackEntry<T>;

        if (!entry.beforeInjected) {
            const beforeReactions = normalizeReactions(options.getBeforeReactions?.(state, entry.item));
            if (beforeReactions.length > 0) {
                const beforeTopQueued = beforeReactions.filter(r => r.enqueuePosition === 'top').length;
                const beforeBottomQueued = beforeReactions.length - beforeTopQueued;
                stack.push({
                    ...entry,
                    beforeInjected: true,
                    beforeQueued: beforeReactions.length,
                    beforeTopQueued,
                    beforeBottomQueued
                });
                enqueueReactionEntries(stack, beforeReactions);
                continue;
            }
        }

        state = options.apply(state, entry.item);

        const afterReactions = normalizeReactions(options.getAfterReactions?.(state, entry.item));
        const legacyAfter = normalizeReactions(options.getReactions?.(state, entry.item));
        const allAfter = [...afterReactions, ...legacyAfter];
        const afterCounts = enqueueReactionEntries(stack, allAfter);

        const topQueued = entry.beforeTopQueued + afterCounts.topQueued;
        const bottomQueued = entry.beforeBottomQueued + afterCounts.bottomQueued;
        const afterQueued = allAfter.length;

        trace.push({
            tick: tick++,
            effectType: describe(entry.item),
            depthBefore,
            depthAfter: stack.length,
            reactionsQueued: entry.beforeQueued + afterQueued,
            beforeReactionsQueued: entry.beforeQueued,
            afterReactionsQueued: afterQueued,
            topQueued,
            bottomQueued
        });
    }

    return {
        state,
        trace,
        resolvedCount: trace.length
    };
};
