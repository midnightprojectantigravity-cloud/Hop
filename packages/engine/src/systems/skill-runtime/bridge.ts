import { GENERATED_RUNTIME_SKILLS, GENERATED_RUNTIME_SKILL_LIBRARY_METADATA } from '../../generated/skill-runtime.generated';
import type { SkillDefinition } from '../../types';
import { materializeSkillDefinition, resolveAndExecuteSkillRuntime } from './executor';
import type {
    SkillLibraryMetadata,
    SkillRuntimeDefinition
} from './types';

const runtimeDefinitions = new Map<string, SkillRuntimeDefinition>();

const registerRuntimeDefinition = (definition: SkillRuntimeDefinition): void => {
    runtimeDefinitions.set(definition.id, definition);
};

const getMaterializedSkillDefinitionRegistry = (): Record<string, SkillDefinition> =>
    Object.fromEntries(
        Array.from(runtimeDefinitions.values(), definition => [definition.id, materializeSkillDefinition(definition)])
    );

for (const definition of GENERATED_RUNTIME_SKILLS) {
    registerRuntimeDefinition(definition);
}

export const SkillRuntimeRegistry = {
    get: (id: string): SkillRuntimeDefinition | undefined => runtimeDefinitions.get(id),
    getAll: (): SkillRuntimeDefinition[] => Array.from(runtimeDefinitions.values()),
    getSkillDefinitionRegistry: getMaterializedSkillDefinitionRegistry,
    getMetadata: (): SkillLibraryMetadata => GENERATED_RUNTIME_SKILL_LIBRARY_METADATA,
    resolveAndExecute: (
        id: string,
        ...args: Parameters<typeof resolveAndExecuteSkillRuntime> extends [any, ...infer Rest] ? Rest : never
    ) => {
        const definition = runtimeDefinitions.get(id);
        if (!definition) return undefined;
        return resolveAndExecuteSkillRuntime(definition, ...args);
    },
    register: (definition: SkillRuntimeDefinition): void => {
        registerRuntimeDefinition(definition);
    },
    clearForTests: (): void => {
        runtimeDefinitions.clear();
    }
};

export const getRuntimeSkillDefinition = SkillRuntimeRegistry.get;
export const getRuntimeSkillDefinitionRegistry = SkillRuntimeRegistry.getSkillDefinitionRegistry;
export const getRuntimeSkillLibraryMetadata = SkillRuntimeRegistry.getMetadata;
