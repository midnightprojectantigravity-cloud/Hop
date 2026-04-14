import type {
    RuntimeExecutionHandler,
    RuntimeTargetingHandler
} from './types';

const executionHandlers = new Map<string, RuntimeExecutionHandler>();
const targetingHandlers = new Map<string, RuntimeTargetingHandler>();

export const registerRuntimeExecutionHandler = (id: string, handler: RuntimeExecutionHandler): void => {
    executionHandlers.set(id, handler);
};

export const registerRuntimeTargetingHandler = (id: string, handler: RuntimeTargetingHandler): void => {
    targetingHandlers.set(id, handler);
};

export const getRuntimeExecutionHandler = (id?: string): RuntimeExecutionHandler | undefined =>
    id ? executionHandlers.get(id) : undefined;

export const getRuntimeTargetingHandler = (id?: string): RuntimeTargetingHandler | undefined =>
    id ? targetingHandlers.get(id) : undefined;

export const clearRuntimeSkillHandlersForTests = (): void => {
    executionHandlers.clear();
    targetingHandlers.clear();
};
